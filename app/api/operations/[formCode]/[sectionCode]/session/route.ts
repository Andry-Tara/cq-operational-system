import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  getOperationConfig,
  normalizeOperationCode,
} from "@/lib/operations/config";

import {
  loadOperationDefinition,
} from "@/lib/operations/load-operation";

type RouteContext = {
  params: Promise<{
    formCode: string;
    sectionCode: string;
  }>;
};

export async function POST(
  req: Request,
  context: RouteContext
) {
  try {
    const {
      formCode,
      sectionCode,
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

    const normalizedSectionCode =
      normalizeOperationCode(
        sectionCode
      );

    // ========================================================
    // OPTIONAL HISTORICAL REVIEW TARGET
    //
    // reportId is never trusted by itself. It is validated
    // against active outlet, form, version, section and
    // exact CK Area Leader authority below.
    // ========================================================

    const requestBody =
      await req
        .json()
        .catch(
          () => ({})
        );

    const requestedReportId =
      typeof requestBody
        ?.reportId ===
        "string"
        ? requestBody
            .reportId
            .trim()
        : "";

    const historicalReviewRequested =
      Boolean(
        requestedReportId
      );

    if (
      requestedReportId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedReportId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Historical reportId tidak valid.",
          code:
            "INVALID_REPORT_ID",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // PERMISSION
    // ========================================================

    const supabase =
      await createClient();

    // ========================================================
    // AUTH
    // ========================================================

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
    // ACTIVE OUTLET
    // ========================================================

    const activeOutlet =
      await getActiveOutlet();

    if (!activeOutlet) {
      return NextResponse.json(
        {
          error:
            "Outlet belum dipilih.",
          code:
            "OUTLET_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: outlet,
      error: outletError,
    } = await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        timezone,
        organization_id
      `)
      .eq(
        "id",
        activeOutlet.id
      )
      .eq("is_active", true)
      .maybeSingle();

    if (
      outletError ||
      !outlet
    ) {
      return NextResponse.json(
        {
          error:
            outletError?.message ||
            "Outlet tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // OUTLET ACCESS
    // ========================================================

    const {
      data:
        hasOutletAccess,
      error:
        accessError,
    } = await supabase.rpc(
      "has_outlet_access",
      {
        p_outlet_id:
          outlet.id,
      }
    );

    if (accessError) {
      throw accessError;
    }

    if (
      hasOutletAccess !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke outlet ini.",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // OPERATION DEFINITION
    // ========================================================

    const operation =
      await loadOperationDefinition({
        supabase,
        organizationId:
          outlet.organization_id,
        outletId:
          outlet.id,
        formCode:
          config.formCode,
        sectionCode:
          normalizedSectionCode,
      });

    const {
      form,
      assignment,
      section,
      versionSection,
    } = operation;


    // ========================================================
    // UNIFIED OPERATIONAL PERMISSION
    //
    // Same source of truth as reports INSERT RLS.
    // Prevent app permission and database permission
    // from disagreeing for Outlet Manager / BOH / FOH.
    // ========================================================

    // ========================================================
    // EXACT CK AREA LEADER ACCESS
    //
    // STORE      -> Warehouse Leader
    // PRODUCTION -> Production Leader
    //
    // This grants review access only. It does not grant
    // fill / submit permission to the section.
    // ========================================================

    const authorizationAreaCode =
      String(
        (section as any)
          .area_code ||
        ""
      )
        .trim()
        .toUpperCase();

    const supportedLeaderArea =
      config.sectionScoped &&
      config.formCode ===
        "CLOSING_CK" &&
      [
        "STORE",
        "PRODUCTION",
      ].includes(
        authorizationAreaCode
      );

    let exactAreaLeader =
      false;

    if (supportedLeaderArea) {
      const {
        data:
          exactLeaderAssignment,
        error:
          exactLeaderError,
      } =
        await supabase
          .from(
            "form_area_leaders"
          )
          .select(`
            id,
            user_id,
            area_code
          `)
          .eq(
            "outlet_id",
            outlet.id
          )
          .eq(
            "form_id",
            form.id
          )
          .eq(
            "area_code",
            authorizationAreaCode
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (exactLeaderError) {
        throw exactLeaderError;
      }

      exactAreaLeader =
        Boolean(
          exactLeaderAssignment
        );
    }


    const {
      data: canStartOperationalReport,
      error: operationalPermissionError,
    } = await supabase.rpc(
      "can_start_operational_report",
      {
        p_organization_id:
          outlet.organization_id,

        p_outlet_id:
          outlet.id,

        p_form_id:
          form.id,

        p_started_by:
          user.id,
      }
    );

    if (operationalPermissionError) {
      throw operationalPermissionError;
    }

    if (
      historicalReviewRequested &&
      !exactAreaLeader
    ) {
      return NextResponse.json(
        {
          error:
            "Historical section review hanya dapat dibuka oleh Area Leader yang ditugaskan.",
          code:
            "HISTORICAL_REVIEW_FORBIDDEN",
        },
        {
          status: 403,
        }
      );
    }

    if (
      canStartOperationalReport !== true &&
      !exactAreaLeader
    ) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki permission untuk menjalankan operational report ini.",
          code:
            "OPERATION_PERMISSION_DENIED",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // SECTION-SCOPED ACCESS
    //
    // Central Kitchen uses one parent report shared by multiple
    // PICs. can_start_operational_report() only confirms that the
    // user has access to at least one section in the form.
    //
    // This second gate confirms that the requested section itself
    // belongs to the authenticated PIC before a parent report or
    // report_section is created/reused.
    // ========================================================

    if (config.sectionScoped) {
      const {
        data: canFillSection,
        error: canFillSectionError,
      } = await supabase.rpc(
        "has_section_permission",
        {
          p_outlet_id:
            outlet.id,
          p_form_id:
            form.id,
          p_section_id:
            section.id,
          p_permission:
            "fill",
        }
      );

      if (canFillSectionError) {
        throw canFillSectionError;
      }

      const {
        data: canSubmitSection,
        error: canSubmitSectionError,
      } = await supabase.rpc(
        "has_section_permission",
        {
          p_outlet_id:
            outlet.id,
          p_form_id:
            form.id,
          p_section_id:
            section.id,
          p_permission:
            "submit",
        }
      );

      if (canSubmitSectionError) {
        throw canSubmitSectionError;
      }

      if (
        canFillSection !== true &&
        canSubmitSection !== true &&
        !exactAreaLeader
      ) {
        return NextResponse.json(
          {
            error:
              "Anda tidak memiliki akses untuk mengisi section ini.",
            code:
              "SECTION_PERMISSION_DENIED",
          },
          {
            status: 403,
          }
        );
      }
    }

    // ========================================================
    // BUSINESS DATE
    // ========================================================

    const timezone =
      outlet.timezone ||
      "Asia/Jakarta";

    let businessDate =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            timezone,
          year:
            "numeric",
          month:
            "2-digit",
          day:
            "2-digit",
        }
      ).format(
        new Date()
      );

    // ========================================================
    // DAILY / HISTORICAL REPORT
    //
    // Normal operation resolves by today's business date.
    // Historical review resolves only the exact supplied report.
    // ========================================================

    let reportQuery =
      supabase
        .from("reports")
        .select(`
          id,
          report_number,
          status,
          pdf_storage_path,
          reopened_at,
          reopen_reason,
          reopen_question_ids,
          resubmitted_at,
          business_date,
          form_version_id
        `)
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "form_id",
          form.id
        );

    reportQuery =
      historicalReviewRequested
        ? reportQuery.eq(
            "id",
            requestedReportId
          )
        : reportQuery.eq(
            "business_date",
            businessDate
          );

    const {
      data:
        todaysReport,
      error:
        todaysReportError,
    } =
      await reportQuery
        .maybeSingle();

    if (
      todaysReportError
    ) {
      throw todaysReportError;
    }

    if (
      historicalReviewRequested &&
      !todaysReport
    ) {
      return NextResponse.json(
        {
          error:
            "Historical report tidak ditemukan untuk outlet dan form ini.",
          code:
            "HISTORICAL_REPORT_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    if (
      historicalReviewRequested &&
      todaysReport
    ) {
      if (
        String(
          todaysReport
            .form_version_id ||
          ""
        ) !==
        String(
          assignment
            .form_version_id ||
          ""
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Versi historical report berbeda dengan versi form aktif. Review diblokir untuk mencegah mismatch pertanyaan.",
            code:
              "HISTORICAL_VERSION_MISMATCH",
          },
          {
            status: 409,
          }
        );
      }

      businessDate =
        String(
          todaysReport
            .business_date ||
          businessDate
        );
    }


    // ========================================================
    // COMPLETED DAILY LOCK
    // ========================================================

    if (
      todaysReport &&
      [
        "completed",
        "submitted",
      ].includes(
        String(
          todaysReport.status
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error:
            `${config.displayName} hari ini sudah disubmit.`,
          code:
            "ALREADY_COMPLETED",
          reportId:
            todaysReport.id,
          reportNumber:
            todaysReport.report_number,
          reportStatus:
            todaysReport.status,
          pdfStoragePath:
            todaysReport.pdf_storage_path,
        },
        {
          status: 409,
        }
      );
    }

    let report =
      todaysReport;

    // ========================================================
    // CREATE REPORT
    // ========================================================

    if (!report) {
      const reportNumber =
        `${config.reportPrefix}-${outlet.code}-${businessDate.replaceAll(
          "-",
          ""
        )}-` +
        crypto
          .randomUUID()
          .slice(0, 6)
          .toUpperCase();

      const {
        data:
          newReport,
        error:
          createReportError,
      } = await supabase
        .from("reports")
        .insert({
          report_number:
            reportNumber,
          organization_id:
            outlet.organization_id,
          outlet_id:
            outlet.id,
          form_id:
            form.id,
          form_version_id:
            assignment.form_version_id,
          business_date:
            businessDate,
          status:
            "in_progress",
          started_by:
            user.id,
        })
        .select(`
          id,
          report_number,
          status,
          pdf_storage_path,
          reopened_at,
          reopen_reason,
          reopen_question_ids,
          resubmitted_at,
          business_date,
          form_version_id
        `)
        .single();

      if (
        createReportError
      ) {
        if (
          createReportError.code ===
          "23505"
        ) {
          return NextResponse.json(
            {
              error:
                `${config.displayName} hari ini sudah tersedia. Silakan refresh dan resume report.`,
              code:
                "DAILY_REPORT_EXISTS",
            },
            {
              status: 409,
            }
          );
        }

        throw createReportError;
      }

      report =
        newReport;
    }

    if (!report) {
      return NextResponse.json(
        {
          error:
            "Unable to resolve operational report session.",
          code:
            "REPORT_SESSION_UNAVAILABLE",
        },
        {
          status: 500,
        }
      );
    }

    const reportStatus =
      String(
        report.status || ""
      ).toLowerCase();

    if (
      ![
        "draft",
        "in_progress",
        "reopened",
      ].includes(
        reportStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Report status ${report.status} tidak dapat dilanjutkan.`,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // REPORT SECTION
    // ========================================================

    const {
      data:
        existingSection,
      error:
        existingSectionError,
    } = await supabase
      .from("report_sections")
      .select(`
        id,
        status,
        submitted_by,
        submitted_at,
        reviewed_by,
        reviewed_at,
        correction_requested_by,
        correction_requested_at,
        correction_reason,
        correction_question_ids,
        correction_round`)
      .eq(
        "report_id",
        report.id
      )
      .eq(
        "section_id",
        section.id
      )
      .maybeSingle();

    if (
      existingSectionError
    ) {
      throw existingSectionError;
    }

    let reportSection =
      existingSection;

    if (
      historicalReviewRequested
    ) {
      if (!reportSection) {
        return NextResponse.json(
          {
            error:
              "Section tidak ditemukan pada historical report ini.",
            code:
              "HISTORICAL_SECTION_NOT_FOUND",
          },
          {
            status: 404,
          }
        );
      }

      const historicalSectionStatus =
        String(
          reportSection.status ||
          ""
        )
          .trim()
          .toLowerCase();

      if (
        ![
          "submitted",
          "reviewed",
        ].includes(
          historicalSectionStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Historical section belum berada pada status yang dapat direview.",
            code:
              "HISTORICAL_SECTION_NOT_REVIEWABLE",
            sectionStatus:
              historicalSectionStatus,
          },
          {
            status: 409,
          }
        );
      }
    }


    // ========================================================
    // CK AREA LEADER REVIEW MODE
    //
    // Authority follows sections.area_code:
    //
    // STORE      -> Warehouse Leader
    // PRODUCTION -> Production Leader
    //
    // Explicit form_area_leaders assignment is the
    // source of truth for review authority.
    // ========================================================

    let areaLeaderReviewMode =
      false;

    const sectionAreaCode =
      String(
        (section as any)
          .area_code ||
        ""
      )
        .trim()
        .toUpperCase();

    const supportedArea =
      config.sectionScoped &&
      config.formCode ===
        "CLOSING_CK" &&
      [
        "STORE",
        "PRODUCTION",
      ].includes(
        sectionAreaCode
      );

    const currentSectionStatus =
      String(
        reportSection?.status ||
        ""
      )
        .trim()
        .toLowerCase();

    const submittedForReview =
      [
        "submitted",
        "reviewed",
      ].includes(
        currentSectionStatus
      );

    if (
      supportedArea &&
      reportSection &&
      submittedForReview
    ) {
      const {
        data:
          areaLeader,
        error:
          areaLeaderError,
      } =
        await supabase
          .from(
            "form_area_leaders"
          )
          .select(`
            id,
            user_id,
            area_code
          `)
          .eq(
            "outlet_id",
            outlet.id
          )
          .eq(
            "form_id",
            form.id
          )
          .eq(
            "area_code",
            sectionAreaCode
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        areaLeaderError
      ) {
        throw areaLeaderError;
      }

      areaLeaderReviewMode =
        Boolean(
          areaLeader
        );
    }


    // A submitted CK section is final while the shared parent
    // report remains in progress for other PICs. It can only be
    // edited again through the explicit reopen flow.
    if (
      config.sectionScoped &&
      !areaLeaderReviewMode &&
      reportStatus !== "reopened" &&
      reportSection &&
      [
        "submitted",
        "reviewed",
      ].includes(
        String(
          reportSection.status || ""
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error:
            `${section.name} sudah disubmit.`,
          code:
            "SECTION_ALREADY_SUBMITTED",
          reportId:
            report.id,
          reportNumber:
            report.report_number,
          reportSectionId:
            reportSection.id,
          reportSectionStatus:
            reportSection.status,
        },
        {
          status: 409,
        }
      );
    }

    if (!reportSection) {
      const {
        data:
          newSection,
        error:
          createSectionError,
      } = await supabase
        .from("report_sections")
        .insert({
          report_id:
            report.id,
          section_id:
            section.id,
          version_section_id:
            versionSection.id,
          status:
            "in_progress",
          started_by:
            user.id,
          started_at:
            new Date()
              .toISOString(),
        })
        .select(`
          id,
          status,
          submitted_by,
          submitted_at,
          reviewed_by,
          reviewed_at,
          correction_requested_by,
          correction_requested_at,
          correction_reason,
          correction_question_ids,
          correction_round
        `)
        .single();

      if (
        createSectionError ||
        !newSection
      ) {
        throw (
          createSectionError ??
          new Error(
            "Unable to create report section."
          )
        );
      }

      reportSection =
        newSection;
    }

    // ========================================================
    // EXISTING ANSWERS
    // ========================================================

    const {
      data:
        existingAnswerRows,
      error:
        answerLoadError,
    } = await supabase
      .from("report_answers")
      .select(`
        id,
        question_id,
        answer_value,
        notes,
        is_compliant
      `)
      .eq(
        "report_section_id",
        reportSection.id
      );

    if (
      answerLoadError
    ) {
      throw answerLoadError;
    }

    const answerIds =
      (
        existingAnswerRows ??
        []
      ).map(
        (item: any) =>
          item.id
      );

    let existingPhotoRows:
      any[] = [];

    if (
      answerIds.length
    ) {
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

      existingPhotoRows =
        data ?? [];
    }

    let existingIssues:
      any[] = [];

    if (
      answerIds.length
    ) {
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

      existingIssues =
        data ?? [];
    }

    const issueIds =
      existingIssues.map(
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

    const photoByAnswer =
      new Map<
        string,
        any
      >();

    for (
      const photo of
      existingPhotoRows
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
      existingIssues
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

    const existingAnswers =
      (
        existingAnswerRows ??
        []
      ).map(
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

          const rawValue =
            answer.answer_value;

          let value:
            any = null;

          if (
            rawValue &&
            typeof rawValue ===
              "object" &&
            "value" in
              rawValue
          ) {
            value =
              rawValue.value;
          } else {
            value =
              rawValue;
          }

          return {
            questionId:
              answer.question_id,

            value,

            notes:
              answer.notes ??
              "",

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

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      operation: {
        formCode:
          config.formCode,

        sectionCode:
          normalizedSectionCode,

        displayName:
          config.displayName,

        formName:
          form.name,

        sectionName:
          section.name,

        permissionCode:
          config.permissionCode,
      },

      reportId:
        report.id,

      reportNumber:
        report.report_number,

      reportStatus:
        report.status,

      reportSectionId:
        reportSection.id,

      reportSectionStatus:
        reportSection.status,

      reviewMode:
        areaLeaderReviewMode,

      reviewAreaCode:
        sectionAreaCode,
      canMarkReviewed:
        areaLeaderReviewMode &&
        String(
          reportSection.status ||
          ""
        )
          .trim()
          .toLowerCase() ===
          "submitted",

      review: {
        submittedBy:
          reportSection
            .submitted_by ??
          null,

        submittedAt:
          reportSection
            .submitted_at ??
          null,

        reviewedBy:
          reportSection
            .reviewed_by ??
          null,

        reviewedAt:
          reportSection
            .reviewed_at ??
          null,
      },
      correctionMode:
        String(
          reportSection.status ||
            ""
        )
          .trim()
          .toLowerCase() ===
        "needs_correction",

      correction: {
        requestedBy:
          reportSection
            .correction_requested_by ??
          null,

        requestedAt:
          reportSection
            .correction_requested_at ??
          null,

        reason:
          reportSection
            .correction_reason ??
          null,

        questionIds:
          Array.isArray(
            reportSection
              .correction_question_ids
          )
            ? reportSection
                .correction_question_ids
            : [],

        round:
          Number(
            reportSection
              .correction_round ||
              0
          ),
      },


      businessDate,
      timezone,

      isReopened:
        reportStatus ===
        "reopened",

      reopen: {
        reopenedAt:
          report.reopened_at ??
          null,

        reason:
          report.reopen_reason ??
          null,

        questionIds:
          Array.isArray(
            report.reopen_question_ids
          )
            ? report.reopen_question_ids
            : [],

        resubmittedAt:
          report.resubmitted_at ??
          null,
      },

      outlet: {
        id:
          outlet.id,

        code:
          outlet.code,

        name:
          outlet.name,

        timezone:
          outlet.timezone,
      },

      existingAnswers,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Operation session error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ??
          "Unable to create operation session",
      },
      {
        status: 500,
      }
    );
  }
}
