import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getOperationConfig,
  normalizeOperationCode,
} from "@/lib/operations/config";


type RouteContext = {
  params: Promise<{
    formCode: string;
  }>;
};


const PRODUCTION_SECTION_CODES = [
  "BEVERAGE",
  "BUTCHER",
  "STEWARD",
  "PREMIX",
  "COLD_KITCHEN",
  "HOT_KITCHEN",
  "HDS",
] as const;


const COMPLETED_SECTION_STATUSES =
  new Set([
    "submitted",
    "reviewed",
    "completed",
  ]);


function normalizeStatus(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function readAnswerValue(
  rawValue: any
) {
  if (
    rawValue &&
    typeof rawValue ===
      "object" &&
    "value" in rawValue
  ) {
    return rawValue.value;
  }

  return rawValue;
}


async function loadProductionContext({
  reportId,
  userId,
  formCode,
}: {
  reportId: string;
  userId: string;
  formCode: string;
}) {
  const admin =
    createAdminClient();

  const config =
    getOperationConfig(
      formCode
    );

  if (
    !config ||
    !config.sectionScoped ||
    config.formCode !==
      "CLOSING_CK"
  ) {
    return {
      error:
        "Production Finalization hanya tersedia untuk Closing Central Kitchen.",
      status: 409,
    } as const;
  }


  // ==========================================================
  // REPORT
  // ==========================================================

  const {
    data: report,
    error: reportError,
  } = await admin
    .from("reports")
    .select(`
      id,
      report_number,
      outlet_id,
      form_id,
      form_version_id,
      business_date,
      status,
      completed_at
    `)
    .eq(
      "id",
      reportId
    )
    .maybeSingle();

  if (
    reportError ||
    !report
  ) {
    return {
      error:
        "Report tidak ditemukan.",
      status: 404,
    } as const;
  }


  // ==========================================================
  // FORM
  // ==========================================================

  const {
    data: form,
    error: formError,
  } = await admin
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
    .maybeSingle();

  if (
    formError ||
    !form
  ) {
    return {
      error:
        "Form report tidak ditemukan.",
      status: 404,
    } as const;
  }

  if (
    normalizeOperationCode(
      form.code
    ) !==
    config.formCode
  ) {
    return {
      error:
        "Report tidak sesuai dengan operation route.",
      status: 409,
    } as const;
  }


  // ==========================================================
  // OUTLET
  // ==========================================================

  const {
    data: outlet,
    error: outletError,
  } = await admin
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
    .maybeSingle();

  if (
    outletError ||
    !outlet
  ) {
    return {
      error:
        "Outlet report tidak ditemukan.",
      status: 404,
    } as const;
  }


  // ==========================================================
  // EXPLICIT PRODUCTION LEADER AUTHORIZATION
  //
  // IMPORTANT:
  // Finalize authority comes ONLY from form_area_leaders.
  // can_review / can_submit do not grant Finalize.
  // ==========================================================

  const {
    data: leaderAssignment,
    error: leaderError,
  } = await admin
    .from(
      "form_area_leaders"
    )
    .select(`
      id,
      outlet_id,
      form_id,
      area_code,
      user_id
    `)
    .eq(
      "outlet_id",
      report.outlet_id
    )
    .eq(
      "form_id",
      report.form_id
    )
    .eq(
      "area_code",
      "PRODUCTION"
    )
    .eq(
      "user_id",
      userId
    )
    .maybeSingle();

  if (leaderError) {
    throw leaderError;
  }

  if (!leaderAssignment) {
    return {
      error:
        "Anda bukan Production Leader untuk report ini.",
      code:
        "NOT_PRODUCTION_LEADER",
      status: 403,
    } as const;
  }


  // ==========================================================
  // REQUIRED PRODUCTION SECTIONS
  // ==========================================================

  const {
    data: productionSections,
    error:
      productionSectionsError,
  } = await admin
    .from("sections")
    .select(`
      id,
      code,
      name
    `)
    .eq(
      "form_id",
      report.form_id
    )
    .in(
      "code",
      [
        ...PRODUCTION_SECTION_CODES,
      ]
    );

  if (
    productionSectionsError
  ) {
    throw productionSectionsError;
  }

  const sectionRows =
    productionSections ?? [];

  const sectionByCode =
    new Map(
      sectionRows.map(
        (item: any) => [
          String(
            item.code
          ).toUpperCase(),
          item,
        ]
      )
    );

  const missingDefinitions =
    PRODUCTION_SECTION_CODES.filter(
      code =>
        !sectionByCode.has(
          code
        )
    );

  if (
    missingDefinitions.length
  ) {
    return {
      error:
        `Production section definition tidak lengkap: ${missingDefinitions.join(
          ", "
        )}.`,
      code:
        "PRODUCTION_SECTION_CONFIG_ERROR",
      status: 409,
    } as const;
  }


  const requiredSectionIds =
    PRODUCTION_SECTION_CODES.map(
      code =>
        sectionByCode.get(
          code
        )!.id
    );


  // ==========================================================
  // ACTIVE VERSION SECTION CHECK
  // ==========================================================

  const {
    data: versionSections,
    error:
      versionSectionsError,
  } = await admin
    .from(
      "form_version_sections"
    )
    .select(`
      id,
      section_id,
      display_name,
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
      requiredSectionIds
    )
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (
    versionSectionsError
  ) {
    throw versionSectionsError;
  }

  const activeVersionSections =
    versionSections ?? [];

  const activeSectionIds =
    new Set(
      activeVersionSections.map(
        (item: any) =>
          item.section_id
      )
    );

  const missingVersionCodes =
    PRODUCTION_SECTION_CODES.filter(
      code =>
        !activeSectionIds.has(
          sectionByCode.get(
            code
          )!.id
        )
    );

  if (
    missingVersionCodes.length
  ) {
    return {
      error:
        `Required Production section belum aktif di form version: ${missingVersionCodes.join(
          ", "
        )}.`,
      code:
        "PRODUCTION_VERSION_CONFIG_ERROR",
      status: 409,
    } as const;
  }


  // ==========================================================
  // REPORT SECTION STATUS
  // ==========================================================

  const {
    data: reportSections,
    error:
      reportSectionsError,
  } = await admin
    .from(
      "report_sections"
    )
    .select(`
      id,
      section_id,
      version_section_id,
      status,
      submitted_by,
      submitted_at,
      reviewed_by,
      reviewed_at,
      created_by_email
    `)
    .eq(
      "report_id",
      report.id
    )
    .in(
      "section_id",
      requiredSectionIds
    );

  if (
    reportSectionsError
  ) {
    throw reportSectionsError;
  }

  const reportSectionBySectionId =
    new Map(
      (
        reportSections ??
        []
      ).map(
        (item: any) => [
          item.section_id,
          item,
        ]
      )
    );


  // ==========================================================
  // SUBMITTER PROFILES
  // ==========================================================

  const submitterIds =
    Array.from(
      new Set(
        (
          reportSections ??
          []
        )
          .map(
            (item: any) =>
              item.submitted_by
          )
          .filter(Boolean)
      )
    ) as string[];

  const {
    data: submitterProfiles,
    error:
      submitterProfilesError,
  } =
    submitterIds.length
      ? await admin
          .from("profiles")
          .select(`
            id,
            full_name,
            job_title
          `)
          .in(
            "id",
            submitterIds
          )
      : {
          data: [],
          error: null,
        };

  if (
    submitterProfilesError
  ) {
    throw submitterProfilesError;
  }

  const submitterById =
    new Map(
      (
        submitterProfiles ??
        []
      ).map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );


  // ==========================================================
  // PRODUCTION PDF PAYLOAD
  //
  // Reuses the same shape as CK PIC PDF:
  // section -> groups/questions/answers/photos/issues.
  // ==========================================================

  const versionSectionIds =
    activeVersionSections.map(
      (item: any) =>
        item.id
    );

  const completedReportSections =
    (
      reportSections ??
      []
    ).filter(
      (item: any) =>
        COMPLETED_SECTION_STATUSES.has(
          normalizeStatus(
            item.status
          )
        ) &&
        Boolean(
          item.submitted_by
        )
    );

  const reportSectionIds =
    completedReportSections.map(
      (item: any) =>
        item.id
    );


  // ----------------------------------------------------------
  // QUESTION GROUPS
  // ----------------------------------------------------------

  const {
    data: groupRows,
    error: groupError,
  } =
    versionSectionIds.length
      ? await admin
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
          )
      : {
          data: [],
          error: null,
        };

  if (groupError) {
    throw groupError;
  }


  // ----------------------------------------------------------
  // QUESTIONS
  // ----------------------------------------------------------

  const {
    data: questionRows,
    error: questionError,
  } =
    versionSectionIds.length
      ? await admin
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
          )
      : {
          data: [],
          error: null,
        };

  if (questionError) {
    throw questionError;
  }


  // ----------------------------------------------------------
  // ANSWERS
  // ----------------------------------------------------------

  const {
    data: answerRows,
    error: answerError,
  } =
    reportSectionIds.length
      ? await admin
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
          )
      : {
          data: [],
          error: null,
        };

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


  // ----------------------------------------------------------
  // PHOTOS
  // ----------------------------------------------------------

  const {
    data: photoRows,
    error: photoError,
  } =
    answerIds.length
      ? await admin
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
            file_size,
            created_at
          `)
          .in(
            "answer_id",
            answerIds
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
      : {
          data: [],
          error: null,
        };

  if (photoError) {
    throw photoError;
  }


  // ----------------------------------------------------------
  // ISSUES
  // ----------------------------------------------------------

  const {
    data: issueRows,
    error: issueError,
  } =
    answerIds.length
      ? await admin
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
              ascending: false,
            }
          )
      : {
          data: [],
          error: null,
        };

  if (issueError) {
    throw issueError;
  }


  // ----------------------------------------------------------
  // CORRECTIVE ACTIONS
  // ----------------------------------------------------------

  const issueIds =
    (
      issueRows ??
      []
    ).map(
      (item: any) =>
        item.id
    );

  const {
    data: correctiveRows,
    error: correctiveError,
  } =
    issueIds.length
      ? await admin
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
              ascending: false,
            }
          )
      : {
          data: [],
          error: null,
        };

  if (correctiveError) {
    throw correctiveError;
  }


  // ----------------------------------------------------------
  // LOOKUP MAPS
  // ----------------------------------------------------------

  const groupsByVersionSection =
    new Map<
      string,
      any[]
    >();

  for (
    const group of
    groupRows ??
    []
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
    questionRows ??
    []
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
    answerRows ??
    []
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


  // report_photos intentionally keeps historical evidence.
  //
  // photoRows is ordered newest-first above, so the first
  // photo encountered for each answer_id is the current/latest
  // evidence that must be used by the Final Production PDF.
  //
  // Older rows remain in the database for audit history.
  const photoByAnswer =
    new Map<
      string,
      any
    >();

  for (
    const photo of
    photoRows ??
    []
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
    new Map<
      string,
      any
    >();

  for (
    const issue of
    issueRows ??
    []
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
    new Map<
      string,
      any
    >();

  for (
    const corrective of
    correctiveRows ??
    []
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


  // ==========================================================
  // PRODUCTION PROGRESS
  // ==========================================================

  const sections =
    activeVersionSections.map(
      (versionSection: any) => {
        const section =
          sectionRows.find(
            (item: any) =>
              item.id ===
              versionSection.section_id
          );

        const reportSection =
          reportSectionBySectionId.get(
            versionSection.section_id
          );

        const normalizedStatus =
          normalizeStatus(
            reportSection?.status
          );

        const submitted =
          Boolean(
            reportSection &&
            COMPLETED_SECTION_STATUSES.has(
              normalizedStatus
            ) &&
            reportSection.submitted_by
          );

        const reviewed =
          Boolean(
            reportSection &&
            [
              "reviewed",
              "completed",
            ].includes(
              normalizedStatus
            ) &&
            reportSection.reviewed_by &&
            reportSection.reviewed_at
          );

        const submitter =
          reportSection
            ?.submitted_by
            ? submitterById.get(
                reportSection
                  .submitted_by
              )
            : null;

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
            (answer: any) => {
              const photo =
                photoByAnswer.get(
                  answer.id
                ) ?? null;

              const issue =
                issueByAnswer.get(
                  answer.id
                ) ?? null;

              const corrective =
                issue
                  ? correctiveByIssue.get(
                      issue.id
                    ) ?? null
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
            versionSection
              .display_name ??
            "Section",

          displayName:
            versionSection
              .display_name ||
            section?.name ||
            "Section",

          sortOrder:
            versionSection
              .sort_order,

          status:
            reportSection
              ?.status ??
            null,

          submitted,

          reviewed,

          submittedAt:
            reportSection
              ?.submitted_at ??
            null,

          reviewedAt:
            reportSection
              ?.reviewed_at ??
            null,

          reviewedBy:
            reportSection
              ?.reviewed_by ??
            null,

          submittedBy:
            reportSection
              ?.submitted_by
              ? {
                  id:
                    reportSection
                      .submitted_by,

                  name:
                    submitter
                      ?.full_name ||
                    reportSection
                      ?.created_by_email ||
                    "Unknown",

                  jobTitle:
                    submitter
                      ?.job_title ??
                    null,
                }
              : null,

          groups:
            sectionGroups,

          questions:
            sectionQuestions,

          answers,
        };
      }
    );

  const submittedSections =
    sections.filter(
      item =>
        item.submitted
    );

  const reviewedSections =
    sections.filter(
      item =>
        item.reviewed
    );

  const missingSections =
    sections.filter(
      item =>
        !item.submitted
    );

  const pendingReviewSections =
    sections.filter(
      item =>
        item.submitted &&
        !item.reviewed
    );

  const readyForFinalize =
    sections.length ===
      PRODUCTION_SECTION_CODES.length &&
    reviewedSections.length ===
      PRODUCTION_SECTION_CODES.length;


  // ==========================================================
  // EXISTING FINALIZATION
  // ==========================================================

  const {
    data:
      existingFinalization,
    error:
      existingFinalizationError,
  } = await admin
    .from(
      "report_area_finalizations"
    )
    .select(`
      id,
      area_code,
      leader_user_id,
      leader_name,
      finalized_at,
      pdf_storage_path,
      pdf_generated_at
    `)
    .eq(
      "report_id",
      report.id
    )
    .eq(
      "area_code",
      "PRODUCTION"
    )
    .maybeSingle();

  if (
    existingFinalizationError
  ) {
    throw existingFinalizationError;
  }


  return {
    admin,
    config,
    report,
    form,
    outlet,
    leaderAssignment,
    sections,
    readyForFinalize,
    submittedCount:
      submittedSections.length,

    reviewedCount:
      reviewedSections.length,

    requiredCount:
      PRODUCTION_SECTION_CODES.length,

    missingSections,

    pendingReviewSections,
    existingFinalization:
      existingFinalization ??
      null,
  } as const;
}


// ============================================================
// GET
//
// Read-only readiness endpoint.
// Safe to call before 7/7.
// ============================================================

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const {
      formCode,
    } = await context.params;

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

    const contextData =
      await loadProductionContext(
        {
          reportId,
          userId:
            user.id,
          formCode,
        }
      );

    if (
      "error" in contextData
    ) {
      return NextResponse.json(
        {
          error:
            contextData.error,
          code:
            "code" in
            contextData
              ? contextData.code
              : undefined,
        },
        {
          status:
            contextData.status,
        }
      );
    }

    return NextResponse.json({
      success:
        true,

      readyForFinalize:
        contextData
          .readyForFinalize,

      requiredCount:
        contextData
          .requiredCount,

      submittedCount:
        contextData
          .submittedCount,

      reviewedCount:
        contextData
          .reviewedCount,

      pendingReviewSections:
        contextData
          .pendingReviewSections.map(
            item => ({
              code:
                item.code,
              name:
                item.displayName,
              status:
                item.status,
            })
          ),

      missingSections:
        contextData
          .missingSections.map(
            item => ({
              code:
                item.code,
              name:
                item.displayName,
              status:
                item.status,
            })
          ),

      report: {
        id:
          contextData.report.id,

        reportNumber:
          contextData.report
            .report_number,

        businessDate:
          contextData.report
            .business_date,

        status:
          contextData.report.status,
      },

      operation: {
        formCode:
          contextData.config
            .formCode,

        displayName:
          contextData.config
            .displayName,

        formName:
          contextData.form.name,
      },

      outlet: {
        id:
          contextData.outlet.id,

        code:
          contextData.outlet.code,

        name:
          contextData.outlet.name,

        timezone:
          contextData.outlet
            .timezone ||
          "Asia/Jakarta",
      },

      leader: {
        id:
          user.id,
      },

      existingFinalization:
        contextData
          .existingFinalization,

      sections:
        contextData.sections,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Production finalization readiness error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to check Production finalization.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// POST
//
// Commits Production finalization AFTER the PDF has already
// been generated and uploaded by the trusted Leader UI.
//
// Expected body:
// {
//   reportId: string,
//   pdfStoragePath: string
// }
// ============================================================

export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const {
      formCode,
    } = await context.params;

    const body =
      await req.json();

    const reportId =
      String(
        body?.reportId ||
        ""
      ).trim();

    const pdfStoragePath =
      String(
        body?.pdfStoragePath ||
        ""
      ).trim();

    const regeneratePdf =
      body?.regeneratePdf ===
      true;

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

    if (!pdfStoragePath) {
      return NextResponse.json(
        {
          error:
            "pdfStoragePath wajib diisi sebelum Finalize Production.",
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

    const contextData =
      await loadProductionContext(
        {
          reportId,
          userId:
            user.id,
          formCode,
        }
      );

    if (
      "error" in contextData
    ) {
      return NextResponse.json(
        {
          error:
            contextData.error,
          code:
            "code" in
            contextData
              ? contextData.code
              : undefined,
        },
        {
          status:
            contextData.status,
        }
      );
    }


    // ========================================================
    // 7/7 SAFETY GATE
    // ========================================================

    if (
      !contextData
        .readyForFinalize
    ) {
      return NextResponse.json(
        {
          success:
            false,

          readyForFinalize:
            false,

          code:
            "PRODUCTION_NOT_READY",

          requiredCount:
            contextData
              .requiredCount,

          submittedCount:
            contextData
              .submittedCount,

          reviewedCount:
            contextData
              .reviewedCount,

          missingSections:
            contextData
              .missingSections.map(
                item =>
                  item.code
              ),

          pendingReviewSections:
            contextData
              .pendingReviewSections.map(
                item =>
                  item.code
              ),

          error:
            `Production belum siap difinalisasi. Submitted ${contextData.submittedCount}/${contextData.requiredCount}, Reviewed ${contextData.reviewedCount}/${contextData.requiredCount}.`,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // STORAGE PATH SAFETY
    // ========================================================

    const expectedPrefix =
      `reports/${contextData.report.id}/area/production/`;

    if (
      !pdfStoragePath.startsWith(
        expectedPrefix
      ) ||
      !pdfStoragePath
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          error:
            "Production PDF storage path tidak valid.",
          code:
            "INVALID_PRODUCTION_PDF_PATH",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // VERIFY PRODUCTION PDF EXISTS
    //
    // Do not record a finalization based only on a path string.
    // The uploaded PDF must actually exist in operational-reports.
    // ========================================================

    const pdfPathParts =
      pdfStoragePath.split("/");

    const pdfFilename =
      pdfPathParts.pop();

    const pdfFolder =
      pdfPathParts.join("/");

    if (
      !pdfFilename ||
      !pdfFolder
    ) {
      return NextResponse.json(
        {
          error:
            "Production PDF storage path tidak valid.",
          code:
            "INVALID_PRODUCTION_PDF_PATH",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: storedPdfFiles,
      error: storedPdfError,
    } =
      await contextData.admin
        .storage
        .from(
          "operational-reports"
        )
        .list(
          pdfFolder,
          {
            limit: 100,
            search:
              pdfFilename,
          }
        );

    if (storedPdfError) {
      throw new Error(
        `Unable to verify Production PDF: ${storedPdfError.message}`
      );
    }

    const storedPdf =
      (
        storedPdfFiles ??
        []
      ).find(
        item =>
          item.name ===
          pdfFilename
      );

    if (!storedPdf) {
      return NextResponse.json(
        {
          error:
            "Production PDF belum ditemukan di storage. Finalization dibatalkan.",
          code:
            "PRODUCTION_PDF_NOT_FOUND",
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // REGENERATE EXISTING FINAL PDF
    //
    // Keeps:
    // - original finalized_at
    // - original leader snapshot
    // - parent report state
    //
    // Only refreshes the PDF artifact metadata.
    // ========================================================

    if (
      regeneratePdf
    ) {
      const existing =
        contextData
          .existingFinalization;

      if (
        !existing
      ) {
        return NextResponse.json(
          {
            error:
              "Production belum pernah difinalisasi. Gunakan Finalize Production terlebih dahulu.",
            code:
              "PRODUCTION_NOT_FINALIZED",
          },
          {
            status: 409,
          }
        );
      }

      const generatedAt =
        new Date()
          .toISOString();

      const {
        data:
          regeneratedFinalization,
        error:
          regenerateError,
      } =
        await contextData.admin
          .from(
            "report_area_finalizations"
          )
          .update({
            pdf_storage_path:
              pdfStoragePath,
            pdf_generated_at:
              generatedAt,
            updated_at:
              generatedAt,
          })
          .eq(
            "id",
            existing.id
          )
          .eq(
            "report_id",
            contextData
              .report.id
          )
          .eq(
            "area_code",
            "PRODUCTION"
          )
          .select(`
            id,
            report_id,
            area_code,
            leader_user_id,
            leader_name,
            finalized_at,
            pdf_storage_path,
            pdf_generated_at
          `)
          .single();

      if (
        regenerateError
      ) {
        throw regenerateError;
      }

      return NextResponse.json(
        {
          success: true,
          regenerated: true,
          finalization:
            regeneratedFinalization,
        }
      );
    }


    // ========================================================
    // LEADER SNAPSHOT
    // ========================================================

    const {
      data: leaderProfile,
      error:
        leaderProfileError,
    } =
      await contextData.admin
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

    if (
      leaderProfileError
    ) {
      throw leaderProfileError;
    }

    const finalizedAt =
      new Date()
        .toISOString();

    const leaderName =
      leaderProfile
        ?.full_name ||
      user.email ||
      "Production Leader";


    // ========================================================
    // FINALIZE PRODUCTION
    // ========================================================

    const {
      data: finalization,
      error:
        finalizationError,
    } =
      await contextData.admin
        .from(
          "report_area_finalizations"
        )
        .upsert(
          {
            report_id:
              contextData.report.id,

            area_code:
              "PRODUCTION",

            leader_user_id:
              user.id,

            leader_name:
              leaderName,

            finalized_at:
              finalizedAt,

            pdf_storage_path:
              pdfStoragePath,

            pdf_generated_at:
              finalizedAt,

            updated_at:
              finalizedAt,
          },
          {
            onConflict:
              "report_id,area_code",
          }
        )
        .select(`
          id,
          report_id,
          area_code,
          leader_user_id,
          leader_name,
          finalized_at,
          pdf_storage_path,
          pdf_generated_at
        `)
        .single();

    if (
      finalizationError
    ) {
      throw finalizationError;
    }


    // ========================================================
    // PARENT REPORT COMPLETION
    //
    // Parent CK report is only COMPLETED when BOTH:
    // STORE + PRODUCTION have explicit area finalization.
    // ========================================================

    const {
      data:
        areaFinalizationRows,
      error:
        areaFinalizationRowsError,
    } =
      await contextData.admin
        .from(
          "report_area_finalizations"
        )
        .select(`
          area_code
        `)
        .eq(
          "report_id",
          contextData.report.id
        );

    if (
      areaFinalizationRowsError
    ) {
      throw areaFinalizationRowsError;
    }

    const finalizedAreas =
      new Set(
        (
          areaFinalizationRows ??
          []
        ).map(
          (item: any) =>
            item.area_code
        )
      );

    const parentCompleted =
      finalizedAreas.has(
        "STORE"
      ) &&
      finalizedAreas.has(
        "PRODUCTION"
      );

    if (parentCompleted) {
      const {
        error:
          reportCompletionError,
      } =
        await contextData.admin
          .from("reports")
          .update({
            status:
              "completed",
            completed_at:
              finalizedAt,
            updated_at:
              finalizedAt,
          })
          .eq(
            "id",
            contextData.report.id
          );

      if (
        reportCompletionError
      ) {
        throw reportCompletionError;
      }
    }


    return NextResponse.json({
      success:
        true,

      finalized:
        true,

      area:
        "PRODUCTION",

      parentCompleted,

      finalization,

      report: {
        id:
          contextData.report.id,

        reportNumber:
          contextData.report
            .report_number,

        requiredCount:
          contextData
            .requiredCount,

        submittedCount:
          contextData
            .submittedCount,

        reviewedCount:
          contextData
            .reviewedCount,
      },
    });
  } catch (
    error: any
  ) {
    console.error(
      "Finalize Production error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to finalize Production.",
      },
      {
        status: 500,
      }
    );
  }
}
