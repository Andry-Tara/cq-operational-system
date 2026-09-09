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
    sectionCode: string;
  }>;
};


export async function POST(
  request: NextRequest,
  {
    params,
  }: RouteContext
) {
  try {
    const {
      formCode,
      sectionCode,
    } = await params;

    const normalizedFormCode =
      normalizeOperationCode(
        formCode
      );

    const normalizedSectionCode =
      normalizeOperationCode(
        sectionCode
      );

    const config =
      getOperationConfig(
        normalizedFormCode
      );


    // ========================================================
    // ROUTE / CK SAFETY
    // ========================================================

    if (
      !config ||
      !config.sectionScoped ||
      normalizedFormCode !==
        "CLOSING_CK"
    ) {
      return NextResponse.json(
        {
          error:
            "Return for Correction hanya tersedia untuk Closing Central Kitchen.",
          code:
            "INVALID_OPERATION",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // BODY
    // ========================================================

    const body =
      await request
        .json()
        .catch(
          () => null
        );

    const reportId =
      String(
        body?.reportId ||
        ""
      ).trim();

    const reason =
      String(
        body?.reason ||
        ""
      ).trim();

    const questionIds: string[] =
      Array.isArray(
        body?.questionIds
      )
        ? Array.from(
            new Set<string>(
              (
                body.questionIds as unknown[]
              )
                .filter(
                  (
                    value: unknown
                  ): value is string =>
                    typeof value ===
                    "string"
                )
                .map(
                  (
                    value: string
                  ) =>
                    value.trim()
                )
                .filter(Boolean)
            )
          )
        : [];


    if (!reportId) {
      return NextResponse.json(
        {
          error:
            "reportId wajib diisi.",
          code:
            "REPORT_ID_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }


    if (
      reason.length < 5
    ) {
      return NextResponse.json(
        {
          error:
            "Alasan koreksi minimal 5 karakter.",
          code:
            "CORRECTION_REASON_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }


    if (
      questionIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Pilih minimal satu pertanyaan yang perlu diperbaiki.",
          code:
            "CORRECTION_QUESTION_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // AUTH
    // ========================================================

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error:
        authError,
    } =
      await supabase.auth
        .getUser();


    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
          code:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        }
      );
    }


    const admin =
      await createAdminClient();


    // ========================================================
    // REPORT
    // ========================================================

    const {
      data:
        report,
      error:
        reportError,
    } =
      await admin
        .from(
          "reports"
        )
        .select(`
          id,
          outlet_id,
          form_id,
          report_number,
          business_date,
          status
        `)
        .eq(
          "id",
          reportId
        )
        .maybeSingle();


    if (reportError) {
      throw reportError;
    }


    if (!report) {
      return NextResponse.json(
        {
          error:
            "Report tidak ditemukan.",
          code:
            "REPORT_NOT_FOUND",
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
      data:
        form,
      error:
        formError,
    } =
      await admin
        .from(
          "forms"
        )
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


    if (formError) {
      throw formError;
    }


    if (
      !form ||
      normalizeOperationCode(
        form.code
      ) !==
        normalizedFormCode
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak sesuai dengan form route.",
          code:
            "FORM_MISMATCH",
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // SECTION
    // ========================================================

    const {
      data:
        section,
      error:
        sectionError,
    } =
      await admin
        .from(
          "sections"
        )
        .select(`
          id,
          code,
          name,
          form_id,
          area_code`)
        .eq(
          "form_id",
          report.form_id
        )
        .eq(
          "code",
          normalizedSectionCode
        )
        .maybeSingle();


    if (sectionError) {
      throw sectionError;
    }


    if (!section) {
      return NextResponse.json(
        {
          error:
            "Section tidak ditemukan.",
          code:
            "SECTION_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // EXACT CK AREA LEADER AUTHORIZATION
    // + EXACT AREA FINALIZATION LOCK
    //
    // STORE      -> Warehouse Leader
    // PRODUCTION -> Production Leader
    //
    // Authorization is checked before finalization state so
    // unrelated users cannot inspect another area's status.
    // ========================================================

    const sectionAreaCode =
      String(
        section.area_code ||
        ""
      )
        .trim()
        .toUpperCase();

    if (
      ![
        "STORE",
        "PRODUCTION",
      ].includes(
        sectionAreaCode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Section belum memiliki CK area yang valid.",
          code:
            "INVALID_SECTION_AREA",
          areaCode:
            sectionAreaCode ||
            null,
        },
        {
          status: 409,
        }
      );
    }

    const areaLabel =
      sectionAreaCode ===
      "STORE"
        ? "Warehouse"
        : "Production";

    const {
      data:
        leaderAssignment,
      error:
        leaderAssignmentError,
    } =
      await admin
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
          report.outlet_id
        )
        .eq(
          "form_id",
          report.form_id
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
      leaderAssignmentError
    ) {
      throw leaderAssignmentError;
    }

    if (!leaderAssignment) {
      return NextResponse.json(
        {
          error:
            `Hanya ${areaLabel} Leader yang dapat mengembalikan section untuk koreksi.`,
          code:
            "NOT_AREA_LEADER",
          areaCode:
            sectionAreaCode,
        },
        {
          status: 403,
        }
      );
    }

    const {
      data:
        areaFinalization,
      error:
        areaFinalizationError,
    } =
      await admin
        .from(
          "report_area_finalizations"
        )
        .select(`
          id,
          area_code,
          finalized_at
        `)
        .eq(
          "report_id",
          report.id
        )
        .eq(
          "area_code",
          sectionAreaCode
        )
        .maybeSingle();

    if (
      areaFinalizationError
    ) {
      throw areaFinalizationError;
    }

    if (areaFinalization) {
      return NextResponse.json(
        {
          error:
            `${areaLabel} report sudah difinalisasi. Section tidak dapat dikembalikan untuk koreksi.`,
          code:
            "AREA_ALREADY_FINALIZED",
          areaCode:
            sectionAreaCode,
          finalizedAt:
            areaFinalization
              .finalized_at,
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
        reportSection,
      error:
        reportSectionError,
    } =
      await admin
        .from(
          "report_sections"
        )
        .select(`
          id,
          report_id,
          section_id,
          status,
          submitted_by,
          submitted_at,
          reviewed_by,
          reviewed_at,
          correction_round
        `)
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
      reportSectionError
    ) {
      throw reportSectionError;
    }


    if (
      !reportSection
    ) {
      return NextResponse.json(
        {
          error:
            "Report section tidak ditemukan.",
          code:
            "REPORT_SECTION_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }


    const currentStatus =
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
        currentStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Section tidak dapat dikembalikan dari status ${currentStatus || "unknown"}.`,
          code:
            "INVALID_CORRECTION_STATUS",
          currentStatus,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // VALIDATE SELECTED QUESTIONS
    //
    // Only questions that actually belong to this submitted
    // report_section may be reopened.
    // ========================================================

    const {
      data:
        selectedAnswers,
      error:
        selectedAnswerError,
    } =
      await admin
        .from(
          "report_answers"
        )
        .select(`
          question_id
        `)
        .eq(
          "report_section_id",
          reportSection.id
        )
        .in(
          "question_id",
          questionIds
        );


    if (
      selectedAnswerError
    ) {
      throw selectedAnswerError;
    }


    const validQuestionIds =
      new Set(
        (
          selectedAnswers ??
          []
        )
          .map(
            (
              item: any
            ) =>
              String(
                item.question_id ||
                ""
              )
          )
          .filter(Boolean)
      );


    const invalidQuestionIds =
      questionIds.filter(
        questionId =>
          !validQuestionIds.has(
            questionId
          )
      );


    if (
      invalidQuestionIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Ada pertanyaan koreksi yang tidak termasuk dalam submitted section ini.",
          code:
            "INVALID_CORRECTION_QUESTIONS",
          invalidQuestionIds,
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // ACTOR SNAPSHOT
    // ========================================================

    const {
      data:
        actorProfile,
      error:
        actorProfileError,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(`
          id,
          full_name
        `)
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    if (
      actorProfileError
    ) {
      throw actorProfileError;
    }


    const actorName =
      String(
        actorProfile
          ?.full_name ||
        user.email ||
        "Production Leader"
      ).trim();


    // ========================================================
    // ATOMIC RETURN FOR CORRECTION
    // ========================================================

    const {
      data:
        correctionRows,
      error:
        correctionError,
    } =
      await admin.rpc(
        "return_report_section_for_correction",
        {
          p_report_section_id:
            reportSection.id,

          p_actor_user_id:
            user.id,

          p_actor_name:
            actorName,

          p_reason:
            reason,

          p_question_ids:
            questionIds,
        }
      );


    if (
      correctionError
    ) {
      throw correctionError;
    }


    const correction =
      Array.isArray(
        correctionRows
      )
        ? correctionRows[0]
        : correctionRows;


    if (!correction) {
      throw new Error(
        "Correction transition did not return a report section."
      );
    }


    return NextResponse.json({
      success: true,

      report: {
        id:
          report.id,

        reportNumber:
          report.report_number,

        businessDate:
          report.business_date,
      },

      section: {
        id:
          section.id,

        code:
          section.code,

        name:
          section.name,
      },

      correction: {
        reportSectionId:
          correction
            .report_section_id,

        status:
          correction.status,

        correctionRound:
          correction
            .correction_round,

        requestedBy:
          correction
            .correction_requested_by,

        requestedByName:
          actorName,

        requestedAt:
          correction
            .correction_requested_at,

        reason:
          correction
            .correction_reason,

        questionIds:
          correction
            .correction_question_ids ??
          questionIds,
      },
    });

  } catch (
    error: any
  ) {
    console.error(
      "Return Production section for correction error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to return section for correction.",

        code:
          "RETURN_FOR_CORRECTION_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
