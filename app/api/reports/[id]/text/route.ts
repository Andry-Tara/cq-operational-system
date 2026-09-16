import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";
import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  getActiveOutlet,
} from "@/lib/active-outlet";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const SPLIT_FORM_CODES =
  new Set([
    "OPENING_FOH",
    "OPENING_BOH",
    "CLOSING_FOH",
    "CLOSING_BOH",
  ]);

function normalized(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toUpperCase();
}

function unwrapAnswerValue(
  raw: any
) {
  if (
    raw &&
    typeof raw ===
      "object" &&
    "value" in raw
  ) {
    return raw.value;
  }

  return raw;
}

function formatAnswer(
  value: unknown,
  locale: string
) {
  if (value === true) {
    return locale === "en"
      ? "YES"
      : "YA";
  }

  if (value === false) {
    return locale === "en"
      ? "NO"
      : "TIDAK";
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}

function formatBusinessDate(
  value: string,
  locale: string
) {
  try {
    return new Intl.DateTimeFormat(
      locale === "en"
        ? "en-GB"
        : "id-ID",
      {
        dateStyle: "long",
        timeZone: "UTC",
      }
    ).format(
      new Date(
        `${value}T12:00:00Z`
      )
    );
  } catch {
    return value;
  }
}

function formatTime(
  value: string | null,
  locale: string,
  timeZone: string
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "en"
        ? "en-GB"
        : "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone:
          timeZone ||
          "Asia/Jakarta",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return value;
  }
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const reportId =
      String(id || "")
        .trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        reportId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Report ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth
        .getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const activeOutlet =
      await getActiveOutlet();

    if (!activeOutlet) {
      return NextResponse.json(
        {
          error:
            "Outlet belum dipilih.",
        },
        {
          status: 400,
        }
      );
    }

    // Authorization boundary: the current user/RLS client
    // must be able to read the report at the active outlet.
    const {
      data:
        authorizedReport,
      error:
        authorizedReportError,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          report_number,
          organization_id,
          outlet_id,
          form_id,
          form_version_id,
          business_date,
          status,
          locale_snapshot,
          pdf_storage_path
        `)
        .eq(
          "id",
          reportId
        )
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .maybeSingle();

    if (
      authorizedReportError ||
      !authorizedReport
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak ditemukan atau Anda tidak memiliki akses.",
        },
        {
          status: 404,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data: form,
      error: formError,
    } =
      await admin
        .from("forms")
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "id",
          authorizedReport.form_id
        )
        .maybeSingle();

    if (
      formError ||
      !form
    ) {
      return NextResponse.json(
        {
          error:
            "Form report tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const formCode =
      normalized(
        form.code
      );

    if (
      !SPLIT_FORM_CODES.has(
        formCode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Copy rekap endpoint ini hanya untuk split Restaurant Outlet forms.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: outlet,
      error: outletError,
    } =
      await admin
        .from("outlets")
        .select(`
          id,
          code,
          name,
          timezone,
          default_locale
        `)
        .eq(
          "id",
          authorizedReport.outlet_id
        )
        .maybeSingle();

    if (
      outletError ||
      !outlet
    ) {
      return NextResponse.json(
        {
          error:
            "Outlet report tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data:
        reportSections,
      error:
        reportSectionsError,
    } =
      await admin
        .from(
          "report_sections"
        )
        .select(`
          id,
          section_id,
          version_section_id,
          status,
          submitted_by,
          submitted_at
        `)
        .eq(
          "report_id",
          authorizedReport.id
        );

    if (
      reportSectionsError
    ) {
      throw reportSectionsError;
    }

    const sections =
      reportSections ?? [];

    if (!sections.length) {
      return NextResponse.json(
        {
          error:
            "Report section tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const versionSectionIds =
      [
        ...new Set(
          sections.map(
            (item: any) =>
              item.version_section_id
          )
        ),
      ];

    const sectionIds =
      [
        ...new Set(
          sections.map(
            (item: any) =>
              item.section_id
          )
        ),
      ];

    const {
      data:
        sectionDefinitions,
      error:
        sectionDefinitionError,
    } =
      await admin
        .from("sections")
        .select(`
          id,
          code,
          name
        `)
        .in(
          "id",
          sectionIds
        );

    if (
      sectionDefinitionError
    ) {
      throw sectionDefinitionError;
    }

    const {
      data:
        groupRows,
      error:
        groupError,
    } =
      await admin
        .from(
          "question_groups"
        )
        .select(`
          id,
          version_section_id,
          code,
          name,
          sort_order,
          is_active
        `)
        .in(
          "version_section_id",
          versionSectionIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        );

    if (groupError) {
      throw groupError;
    }

    const {
      data:
        questionRows,
      error:
        questionError,
    } =
      await admin
        .from("questions")
        .select(`
          id,
          version_section_id,
          question_group_id,
          code,
          question_text,
          question_type,
          sort_order,
          is_active,
          config
        `)
        .in(
          "version_section_id",
          versionSectionIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        );

    if (questionError) {
      throw questionError;
    }

    const reportSectionIds =
      sections.map(
        (item: any) =>
          item.id
      );

    const {
      data:
        applicabilityRows,
      error:
        applicabilityError,
    } =
      await admin
        .from(
          "report_question_applicability"
        )
        .select(`
          report_section_id,
          question_id,
          is_applicable
        `)
        .in(
          "report_section_id",
          reportSectionIds
        );

    if (
      applicabilityError
    ) {
      throw applicabilityError;
    }

    const {
      data:
        answerRows,
      error:
        answerError,
    } =
      await admin
        .from(
          "report_answers"
        )
        .select(`
          id,
          report_section_id,
          question_id,
          answer_value,
          notes,
          is_compliant
        `)
        .in(
          "report_section_id",
          reportSectionIds
        );

    if (answerError) {
      throw answerError;
    }

    const answerIds =
      (
        answerRows ??
        []
      ).map(
        (item: any) =>
          item.id
      );

    let photoRows:
      any[] = [];
    let issueRows:
      any[] = [];

    if (
      answerIds.length
    ) {
      const [
        photoResult,
        issueResult,
      ] =
        await Promise.all([
          admin
            .from(
              "report_photos"
            )
            .select(`
              id,
              answer_id,
              created_at
            `)
            .in(
              "answer_id",
              answerIds
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            ),

          admin
            .from("issues")
            .select(`
              id,
              answer_id,
              status,
              description,
              created_at
            `)
            .eq(
              "report_id",
              authorizedReport.id
            )
            .in(
              "answer_id",
              answerIds
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            ),
        ]);

      if (photoResult.error) {
        throw photoResult.error;
      }
      if (issueResult.error) {
        throw issueResult.error;
      }

      photoRows =
        photoResult.data ??
        [];
      issueRows =
        issueResult.data ??
        [];
    }

    const issueIds =
      issueRows.map(
        (item: any) =>
          item.id
      );

    let correctiveRows:
      any[] = [];

    if (
      issueIds.length
    ) {
      const {
        data,
        error,
      } =
        await admin
          .from(
            "corrective_actions"
          )
          .select(`
            id,
            issue_id,
            action_text,
            created_at
          `)
          .in(
            "issue_id",
            issueIds
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (error) {
        throw error;
      }

      correctiveRows =
        data ?? [];
    }

    const questionIds =
      (
        questionRows ??
        []
      ).map(
        (item: any) =>
          item.id
      );

    const groupIds =
      (
        groupRows ??
        []
      ).map(
        (item: any) =>
          item.id
      );

    const locale =
      authorizedReport.locale_snapshot ===
        "en"
        ? "en"
        : "id-ID";

    let questionTranslations:
      any[] = [];
    let groupTranslations:
      any[] = [];

    const [
      questionTranslationResult,
      groupTranslationResult,
    ] =
      await Promise.all([
        questionIds.length
          ? admin
              .from(
                "question_translations"
              )
              .select(`
                question_id,
                locale,
                question_text
              `)
              .in(
                "question_id",
                questionIds
              )
              .eq(
                "locale",
                locale
              )
          : Promise.resolve(
              {
                data: [],
                error: null,
              }
            ),

        groupIds.length
          ? admin
              .from(
                "question_group_translations"
              )
              .select(`
                question_group_id,
                locale,
                display_name
              `)
              .in(
                "question_group_id",
                groupIds
              )
              .eq(
                "locale",
                locale
              )
          : Promise.resolve(
              {
                data: [],
                error: null,
              }
            ),
      ]);

    if (
      questionTranslationResult.error
    ) {
      throw (
        questionTranslationResult.error
      );
    }
    if (
      groupTranslationResult.error
    ) {
      throw (
        groupTranslationResult.error
      );
    }

    questionTranslations =
      questionTranslationResult.data ??
      [];
    groupTranslations =
      groupTranslationResult.data ??
      [];

    const submittedByIds =
      [
        ...new Set(
          sections
            .map(
              (item: any) =>
                item.submitted_by
            )
            .filter(Boolean)
        ),
      ];

    let profileRows:
      any[] = [];

    if (
      submittedByIds.length
    ) {
      const {
        data,
        error,
      } =
        await admin
          .from("profiles")
          .select(`
            id,
            full_name,
            job_title
          `)
          .in(
            "id",
            submittedByIds
          );

      if (error) {
        throw error;
      }

      profileRows =
        data ?? [];
    }

    const sectionById =
      new Map(
        (
          sectionDefinitions ??
          []
        ).map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const profileById =
      new Map(
        profileRows.map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const questionTranslationById =
      new Map(
        questionTranslations.map(
          (item: any) => [
            item.question_id,
            item,
          ]
        )
      );

    const groupTranslationById =
      new Map(
        groupTranslations.map(
          (item: any) => [
            item.question_group_id,
            item,
          ]
        )
      );

    const applicabilityByKey =
      new Map(
        (
          applicabilityRows ??
          []
        ).map(
          (item: any) => [
            `${item.report_section_id}:${item.question_id}`,
            item,
          ]
        )
      );

    const answerByQuestion =
      new Map<string, any>();

    for (
      const answer of
      answerRows ?? []
    ) {
      answerByQuestion.set(
        `${answer.report_section_id}:${answer.question_id}`,
        answer
      );
    }

    const photoByAnswer =
      new Map<string, any>();

    for (
      const photo of
      photoRows
    ) {
      if (
        photo.answer_id &&
        !photoByAnswer.has(
          photo.answer_id
        )
      ) {
        photoByAnswer.set(
          photo.answer_id,
          photo
        );
      }
    }

    const issueByAnswer =
      new Map<string, any>();

    for (
      const issue of
      issueRows
    ) {
      if (
        issue.answer_id &&
        !issueByAnswer.has(
          issue.answer_id
        )
      ) {
        issueByAnswer.set(
          issue.answer_id,
          issue
        );
      }
    }

    const correctiveByIssue =
      new Map<string, any>();

    for (
      const action of
      correctiveRows
    ) {
      if (
        action.issue_id &&
        !correctiveByIssue.has(
          action.issue_id
        )
      ) {
        correctiveByIssue.set(
          action.issue_id,
          action
        );
      }
    }

    const latestSubmittedAt =
      sections
        .map(
          (item: any) =>
            item.submitted_at
        )
        .filter(Boolean)
        .sort()
        .at(-1) ??
      null;

    const picNames =
      [
        ...new Set(
          sections
            .map(
              (item: any) =>
                profileById.get(
                  item.submitted_by
                )?.full_name
            )
            .filter(Boolean)
        ),
      ];

    const titleByCode:
      Record<string, string> = {
        OPENING_FOH:
          "OPENING FOH",
        OPENING_BOH:
          "OPENING BOH",
        CLOSING_FOH:
          "CLOSING FOH",
        CLOSING_BOH:
          "CLOSING BOH",
      };

    const reportTitle =
      titleByCode[
        formCode
      ] ||
      normalized(
        form.name
      );

    const isEnglish =
      locale === "en";

    const lines:
      string[] = [
        `*${reportTitle} REPORT*`,
        "*CHONG QING HOT POT*",
        "",
        `📍 Outlet: ${outlet.name}`,
        `👤 PIC: ${
          picNames.length
            ? picNames.join(", ")
            : "-"
        }`,
        `📅 ${
          isEnglish
            ? "Date"
            : "Tanggal"
        }: ${formatBusinessDate(
          authorizedReport.business_date,
          locale
        )}`,
        `⏰ ${
          isEnglish
            ? "Submitted"
            : "Dikirim"
        }: ${formatTime(
          latestSubmittedAt,
          locale,
          outlet.timezone ||
            "Asia/Jakarta"
        )}`,
        "",
      ];

    let applicableQuestionCount =
      0;
    let answeredCount =
      0;
    let photoCount =
      0;
    let issueCount =
      0;

    const detailLines:
      string[] = [];

    function pushQuestion(
      reportSection: any,
      question: any
    ) {
      const answer =
        answerByQuestion.get(
          `${reportSection.id}:${question.id}`
        );

      if (answer) {
        answeredCount += 1;

        if (
          photoByAnswer.has(
            answer.id
          )
        ) {
          photoCount += 1;
        }
      }

      const issue =
        answer
          ? issueByAnswer.get(
              answer.id
            )
          : null;

      if (issue) {
        issueCount += 1;
      }

      const corrective =
        issue
          ? correctiveByIssue.get(
              issue.id
            )
          : null;

      const rawValue =
        answer
          ? unwrapAnswerValue(
              answer.answer_value
            )
          : null;

      const exception =
        answer
          ? (
              answer.is_compliant ===
                false ||
              rawValue === false
            )
          : false;

      const localizedQuestion =
        questionTranslationById.get(
          question.id
        )?.question_text ||
        question.question_text ||
        question.code;

      detailLines.push(
        `- ${localizedQuestion}: ${formatAnswer(
          rawValue,
          locale
        )} ${
          exception
            ? "❌"
            : "✅"
        }`
      );

      if (
        exception &&
        answer?.notes
          ?.trim()
      ) {
        detailLines.push(
          `  _${
            isEnglish
              ? "Notes"
              : "Catatan"
          }: ${answer.notes.trim()}_`
        );
      }

      if (
        exception &&
        corrective
          ?.action_text
          ?.trim()
      ) {
        detailLines.push(
          `  _${
            isEnglish
              ? "Corrective"
              : "Tindakan"
          }: ${corrective.action_text.trim()}_`
        );
      }
    }

    for (
      const reportSection of
      sections
    ) {
      const sectionDefinition =
        sectionById.get(
          reportSection.section_id
        );

      const sectionQuestions =
        (
          questionRows ??
          []
        ).filter(
          (question: any) =>
            question.version_section_id ===
            reportSection.version_section_id
        );

      const applicableQuestions =
        sectionQuestions.filter(
          (question: any) => {
            const snapshot =
              applicabilityByKey.get(
                `${reportSection.id}:${question.id}`
              );

            return snapshot
              ? snapshot.is_applicable === true
              : true;
          }
        );

      applicableQuestionCount +=
        applicableQuestions.length;

      const sectionGroups =
        (
          groupRows ??
          []
        ).filter(
          (group: any) =>
            group.version_section_id ===
            reportSection.version_section_id
        );

      const groupedQuestionIds =
        new Set<string>();

      for (
        const group of
        sectionGroups
      ) {
        const questions =
          applicableQuestions.filter(
            (question: any) =>
              question.question_group_id ===
              group.id
          );

        if (!questions.length) {
          continue;
        }

        const localizedGroup =
          groupTranslationById.get(
            group.id
          )?.display_name ||
          group.name ||
          group.code ||
          "General";

        detailLines.push(
          `*${String(
            localizedGroup
          ).toUpperCase()}*`
        );

        for (
          const question of
          questions
        ) {
          groupedQuestionIds.add(
            question.id
          );
          pushQuestion(
            reportSection,
            question
          );
        }

        detailLines.push("");
      }

      const ungrouped =
        applicableQuestions.filter(
          (question: any) =>
            !groupedQuestionIds.has(
              question.id
            )
        );

      if (
        ungrouped.length
      ) {
        const sectionName =
          sectionDefinition?.name ||
          sectionDefinition?.code ||
          "General";

        detailLines.push(
          `*${String(
            sectionName
          ).toUpperCase()}*`
        );

        for (
          const question of
          ungrouped
        ) {
          pushQuestion(
            reportSection,
            question
          );
        }

        detailLines.push("");
      }
    }

    lines.push(
      `*${
        isEnglish
          ? "SUMMARY"
          : "RINGKASAN"
      }*`,
      `- Checklist: ${answeredCount}/${applicableQuestionCount}`,
      `- ${
        isEnglish
          ? "Photo Evidence"
          : "Bukti Foto"
      }: ${photoCount}/${applicableQuestionCount}`,
      `- ${
        isEnglish
          ? "Issues"
          : "Masalah"
      }: ${issueCount}`,
      `- Status: ${
        isEnglish
          ? "Completed"
          : "Selesai"
      }`,
      "",
      ...detailLines,
      `*${
        isEnglish
          ? "REPORT INFO"
          : "INFO REPORT"
      }*`,
      `- Report ID: ${authorizedReport.report_number}`,
      "",
      `✅ *${reportTitle} ${
        isEnglish
          ? "COMPLETED"
          : "SELESAI"
      }*`
    );

    return NextResponse.json(
      {
        success: true,
        reportId:
          authorizedReport.id,
        reportNumber:
          authorizedReport.report_number,
        formCode,
        locale,
        pdfAvailable:
          Boolean(
            authorizedReport.pdf_storage_path
          ),
        text:
          lines.join(
            "\n"
          ),
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "Completed report text error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to build completed report text.",
      },
      {
        status: 500,
      }
    );
  }
}
