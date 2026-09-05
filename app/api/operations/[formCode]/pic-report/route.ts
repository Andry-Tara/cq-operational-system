import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getOperationConfig,
  normalizeOperationCode,
} from "@/lib/operations/config";

type RouteContext = {
  params: Promise<{
    formCode: string;
  }>;
};

function readAnswerValue(
  rawValue: any
) {
  if (
    rawValue &&
    typeof rawValue === "object" &&
    "value" in rawValue
  ) {
    return rawValue.value;
  }

  return rawValue;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const {
      formCode,
    } = await context.params;

    const config =
      getOperationConfig(
        formCode
      );

    if (!config) {
      return NextResponse.json(
        {
          error:
            "Operation tidak dikenal.",
        },
        {
          status: 404,
        }
      );
    }

    // PIC PDF aggregation is only for section-scoped CK.
    if (!config.sectionScoped) {
      return NextResponse.json(
        {
          error:
            "PIC report hanya tersedia untuk Central Kitchen.",
        },
        {
          status: 409,
        }
      );
    }

    const reportId =
      req.nextUrl.searchParams
        .get("reportId")
        ?.trim();

    if (!reportId) {
      return NextResponse.json(
        {
          error:
            "reportId wajib diisi.",
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
      await supabase.auth.getUser();

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

    // ========================================================
    // REPORT
    // ========================================================

    const {
      data: report,
      error: reportError,
    } = await supabase
      .from("reports")
      .select(`
        id,
        report_number,
        outlet_id,
        form_id,
        form_version_id,
        business_date,
        status
      `)
      .eq(
        "id",
        reportId
      )
      .single();

    if (
      reportError ||
      !report
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak ditemukan atau tidak dapat diakses.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // FORM
    // ========================================================

    const {
      data: form,
      error: formError,
    } = await supabase
      .from("forms")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "id",
        report.form_id
      )
      .single();

    if (
      formError ||
      !form
    ) {
      throw (
        formError ||
        new Error(
          "Form report tidak ditemukan."
        )
      );
    }

    if (
      normalizeOperationCode(
        form.code
      ) !==
      config.formCode
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak sesuai dengan operation route.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // OUTLET
    // ========================================================

    const {
      data: outlet,
      error: outletError,
    } = await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        timezone
      `)
      .eq(
        "id",
        report.outlet_id
      )
      .single();

    if (
      outletError ||
      !outlet
    ) {
      throw (
        outletError ||
        new Error(
          "Outlet report tidak ditemukan."
        )
      );
    }

    // ========================================================
    // PIC PROFILE
    // ========================================================

    const {
      data: profile,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        job_title
      `)
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

    // ========================================================
    // PIC SECTION ASSIGNMENTS
    // ========================================================

    const {
      data:
        permissionRows,
      error:
        permissionError,
    } = await supabase
      .from(
        "user_section_permissions"
      )
      .select(
        "section_id"
      )
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "outlet_id",
        report.outlet_id
      )
      .eq(
        "form_id",
        report.form_id
      )
      .eq(
        "can_submit",
        true
      );

    if (permissionError) {
      throw permissionError;
    }

    const permissionSectionIds =
      [
        ...new Set(
          (
            permissionRows ??
            []
          )
            .map(
              (
                item: any
              ) =>
                item.section_id
            )
            .filter(Boolean)
        ),
      ];

    if (
      permissionSectionIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Tidak ada section CK yang ditugaskan ke user ini.",
          code:
            "NO_PIC_ASSIGNMENT",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // REQUIRED VERSION SECTIONS FOR CURRENT PIC
    // ========================================================

    const {
      data:
        versionSectionRows,
      error:
        versionSectionError,
    } = await supabase
      .from(
        "form_version_sections"
      )
      .select(`
        id,
        section_id,
        display_name,
        description,
        sort_order,
        is_required,
        is_active
      `)
      .eq(
        "form_version_id",
        report.form_version_id
      )
      .eq(
        "is_required",
        true
      )
      .eq(
        "is_active",
        true
      )
      .in(
        "section_id",
        permissionSectionIds
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

    if (versionSectionError) {
      throw versionSectionError;
    }

    const versionSections =
      versionSectionRows ??
      [];

    const assignedSectionIds =
      versionSections.map(
        (
          item: any
        ) =>
          item.section_id
      );

    if (
      assignedSectionIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Tidak ada required section CK yang ditugaskan ke PIC ini.",
          code:
            "NO_REQUIRED_PIC_SECTION",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // REPORT SECTIONS COMPLETED BY CURRENT PIC
    // ========================================================

    const {
      data:
        reportSectionRows,
      error:
        reportSectionError,
    } = await supabase
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
        report.id
      )
      .in(
        "section_id",
        assignedSectionIds
      );

    if (reportSectionError) {
      throw reportSectionError;
    }

    const completedReportSections =
      (
        reportSectionRows ??
        []
      ).filter(
        (
          item: any
        ) =>
          [
            "submitted",
            "reviewed",
          ].includes(
            String(
              item.status ||
              ""
            ).toLowerCase()
          ) &&
          item.submitted_by ===
            user.id
      );

    const completedSectionIds =
      new Set(
        completedReportSections.map(
          (
            item: any
          ) =>
            item.section_id
        )
      );

    const picAssignedCount =
      assignedSectionIds.length;

    const picCompletedCount =
      completedSectionIds.size;

    const picCompleted =
      assignedSectionIds.every(
        (
          sectionId: string
        ) =>
          completedSectionIds.has(
            sectionId
          )
      );

    // Independent safety gate:
    // endpoint cannot aggregate an unfinished PIC report.
    if (!picCompleted) {
      return NextResponse.json(
        {
          success:
            false,
          readyForPdf:
            false,
          code:
            "PIC_NOT_COMPLETED",
          picAssignedCount,
          picCompletedCount,
          error:
            `Checklist PIC belum lengkap (${picCompletedCount}/${picAssignedCount}).`,
        },
        {
          status: 409,
        }
      );
    }

    const reportSectionIds =
      completedReportSections.map(
        (
          item: any
        ) =>
          item.id
      );

    const versionSectionIds =
      versionSections.map(
        (
          item: any
        ) =>
          item.id
      );

    // ========================================================
    // SECTION DEFINITIONS
    // ========================================================

    const {
      data:
        sectionRows,
      error:
        sectionError,
    } = await supabase
      .from("sections")
      .select(`
        id,
        code,
        name,
        description
      `)
      .eq(
        "form_id",
        report.form_id
      )
      .in(
        "id",
        assignedSectionIds
      );

    if (sectionError) {
      throw sectionError;
    }

    // ========================================================
    // QUESTION GROUPS
    // ========================================================

    const {
      data:
        groupRows,
      error:
        groupError,
    } = await supabase
      .from(
        "question_groups"
      )
      .select(`
        id,
        version_section_id,
        code,
        name,
        description,
        sort_order
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

    // ========================================================
    // QUESTIONS
    // ========================================================

    const {
      data:
        questionRows,
      error:
        questionError,
    } = await supabase
      .from("questions")
      .select(`
        id,
        version_section_id,
        question_group_id,
        code,
        question_text,
        help_text,
        question_type,
        is_required,
        unit,
        min_value,
        max_value,
        config,
        sort_order
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

    // ========================================================
    // ANSWERS
    // ========================================================

    const {
      data:
        answerRows,
      error:
        answerError,
    } = await supabase
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
        (
          item: any
        ) =>
          item.id
      );

    // ========================================================
    // PHOTOS
    // ========================================================

    let photoRows:
      any[] = [];

    if (answerIds.length) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "report_photos"
        )
        .select(`
          id,
          answer_id,
          storage_bucket,
          storage_path,
          original_filename,
          mime_type,
          file_size
        `)
        .in(
          "answer_id",
          answerIds
        );

      if (error) {
        throw error;
      }

      photoRows =
        data ?? [];
    }

    // ========================================================
    // ISSUES
    // ========================================================

    let issueRows:
      any[] = [];

    if (answerIds.length) {
      const {
        data,
        error,
      } = await supabase
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
          report.id
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
        );

      if (error) {
        throw error;
      }

      issueRows =
        data ?? [];
    }

    // ========================================================
    // CORRECTIVE ACTIONS
    // ========================================================

    const issueIds =
      issueRows.map(
        (
          item: any
        ) =>
          item.id
      );

    let correctiveRows:
      any[] = [];

    if (issueIds.length) {
      const {
        data,
        error,
      } = await supabase
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

    // ========================================================
    // LOOKUP MAPS
    // ========================================================

    const sectionById =
      new Map(
        (
          sectionRows ??
          []
        ).map(
          (
            item: any
          ) => [
            item.id,
            item,
          ]
        )
      );

    const reportSectionBySectionId =
      new Map(
        completedReportSections.map(
          (
            item: any
          ) => [
            item.section_id,
            item,
          ]
        )
      );

    const groupsByVersionSection =
      new Map<
        string,
        any[]
      >();

    for (
      const group of
      groupRows ?? []
    ) {
      const current =
        groupsByVersionSection.get(
          group.version_section_id
        ) ?? [];

      current.push(group);

      groupsByVersionSection.set(
        group.version_section_id,
        current
      );
    }

    const questionsByVersionSection =
      new Map<
        string,
        any[]
      >();

    for (
      const question of
      questionRows ?? []
    ) {
      const current =
        questionsByVersionSection.get(
          question.version_section_id
        ) ?? [];

      current.push(
        question
      );

      questionsByVersionSection.set(
        question.version_section_id,
        current
      );
    }

    const answersByReportSection =
      new Map<
        string,
        any[]
      >();

    for (
      const answer of
      answerRows ?? []
    ) {
      const current =
        answersByReportSection.get(
          answer.report_section_id
        ) ?? [];

      current.push(
        answer
      );

      answersByReportSection.set(
        answer.report_section_id,
        current
      );
    }

    // Same behavior as session route:
    // first available photo per answer.
    const photoByAnswer =
      new Map<
        string,
        any
      >();

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

    // issueRows is newest first.
    const issueByAnswer =
      new Map<
        string,
        any
      >();

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

    // correctiveRows is newest first.
    const correctiveByIssue =
      new Map<
        string,
        any
      >();

    for (
      const corrective of
      correctiveRows
    ) {
      if (
        corrective.issue_id &&
        !correctiveByIssue.has(
          corrective.issue_id
        )
      ) {
        correctiveByIssue.set(
          corrective.issue_id,
          corrective
        );
      }
    }

    // ========================================================
    // BUILD PIC SECTION PAYLOAD
    // ========================================================

    const sections =
      versionSections.map(
        (
          versionSection: any
        ) => {
          const section =
            sectionById.get(
              versionSection.section_id
            );

          const reportSection =
            reportSectionBySectionId.get(
              versionSection.section_id
            );

          const sectionGroups =
            groupsByVersionSection.get(
              versionSection.id
            ) ?? [];

          const sectionQuestions =
            questionsByVersionSection.get(
              versionSection.id
            ) ?? [];

          const rawAnswers =
            reportSection
              ? answersByReportSection.get(
                  reportSection.id
                ) ?? []
              : [];

          const answers =
            rawAnswers.map(
              (
                answer: any
              ) => {
                const photo =
                  photoByAnswer.get(
                    answer.id
                  ) ??
                  null;

                const issue =
                  issueByAnswer.get(
                    answer.id
                  ) ??
                  null;

                const corrective =
                  issue
                    ? correctiveByIssue.get(
                        issue.id
                      ) ??
                      null
                    : null;

                return {
                  answerId:
                    answer.id,

                  questionId:
                    answer.question_id,

                  value:
                    readAnswerValue(
                      answer.answer_value
                    ),

                  notes:
                    answer.notes ??
                    "",

                  isCompliant:
                    answer.is_compliant,

                  correctiveAction:
                    corrective
                      ?.action_text ??
                    "",

                  existingPhoto:
                    photo
                      ? {
                          storageBucket:
                            photo.storage_bucket,

                          storagePath:
                            photo.storage_path,

                          originalFilename:
                            photo.original_filename,

                          mimeType:
                            photo.mime_type,

                          fileSize:
                            photo.file_size,
                        }
                      : null,
                };
              }
            );

          return {
            sectionId:
              versionSection.section_id,

            versionSectionId:
              versionSection.id,

            reportSectionId:
              reportSection?.id ??
              null,

            code:
              section?.code ??
              "",

            name:
              section?.name ??
              versionSection.display_name ??
              "Section",

            displayName:
              versionSection.display_name ||
              section?.name ||
              "Section",

            description:
              versionSection.description ??
              section?.description ??
              null,

            sortOrder:
              versionSection.sort_order,

            status:
              reportSection?.status ??
              null,

            submittedAt:
              reportSection?.submitted_at ??
              null,

            groups:
              sectionGroups,

            questions:
              sectionQuestions,

            answers,
          };
        }
      );

    // ========================================================
    // EXISTING PIC PDF EXPORT
    // ========================================================

    const {
      data:
        existingExport,
      error:
        existingExportError,
    } = await supabase
      .from(
        "report_pic_exports"
      )
      .select(`
        pdf_storage_path,
        pdf_generated_at
      `)
      .eq(
        "report_id",
        report.id
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (existingExportError) {
      throw existingExportError;
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success:
        true,

      readyForPdf:
        true,

      report: {
        id:
          report.id,

        reportNumber:
          report.report_number,

        businessDate:
          report.business_date,

        status:
          report.status,
      },

      operation: {
        formCode:
          config.formCode,

        displayName:
          config.displayName,

        formName:
          form.name,
      },

      outlet: {
        id:
          outlet.id,

        code:
          outlet.code,

        name:
          outlet.name,

        timezone:
          outlet.timezone ||
          "Asia/Jakarta",
      },

      pic: {
        id:
          user.id,

        name:
          profile?.full_name ||
          user.email ||
          "CQ Operational User",

        jobTitle:
          profile?.job_title ??
          null,
      },

      picAssignedCount,
      picCompletedCount,

      existingExport:
        existingExport
          ? {
              pdfStoragePath:
                existingExport.pdf_storage_path,

              pdfGeneratedAt:
                existingExport.pdf_generated_at,
            }
          : null,

      sections,
    });
  } catch (
    error: any
  ) {
    console.error(
      "PIC report aggregation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to prepare PIC report.",
      },
      {
        status: 500,
      }
    );
  }
}
