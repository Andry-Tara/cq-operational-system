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


function normalized(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toUpperCase();
}


export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const {
      formCode,
      sectionCode,
    } =
      await context.params;

    const normalizedSectionCode =
      normalized(
        sectionCode
      );

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
      return NextResponse.json(
        {
          error:
            "Section review hanya tersedia untuk Closing Central Kitchen.",
        },
        {
          status: 409,
        }
      );
    }


    const body =
      await req.json();

    const reportId =
      String(
        body?.reportId ||
        ""
      ).trim();

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


    // ========================================================
    // AUTH
    // ========================================================

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

    const admin =
      createAdminClient();


    // ========================================================
    // REPORT
    // ========================================================

    const {
      data: report,
      error: reportError,
    } =
      await admin
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
        .maybeSingle();

    if (
      reportError ||
      !report
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak ditemukan.",
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
          report.form_id
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
    // SECTION
    // ========================================================

    const {
      data: section,
      error: sectionError,
    } =
      await admin
        .from("sections")
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

    if (
      sectionError ||
      !section
    ) {
      return NextResponse.json(
        {
          error:
            "Section tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // EXACT CK AREA LEADER AUTHORIZATION
    //
    // STORE      -> Warehouse Leader
    // PRODUCTION -> Production Leader
    //
    // form_area_leaders is the authority source.
    // can_review is not required for an assigned Area Leader.
    // ========================================================

    const sectionAreaCode =
      normalized(
        section.area_code
      );

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
            `Hanya ${areaLabel} Leader yang dapat Mark as Reviewed.`,
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
      reportSectionError ||
      !reportSection
    ) {
      return NextResponse.json(
        {
          error:
            "Section report belum tersedia.",
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


    // Already reviewed = idempotent success.
    if (
      currentStatus ===
      "reviewed"
    ) {
      return NextResponse.json({
        success:
          true,

        alreadyReviewed:
          true,

        reportId:
          report.id,

        reportNumber:
          report.report_number,

        reportSectionId:
          reportSection.id,

        sectionCode:
          section.code,

        status:
          "reviewed",

        submittedBy:
          reportSection
            .submitted_by,

        submittedAt:
          reportSection
            .submitted_at,

        reviewedBy:
          reportSection
            .reviewed_by,

        reviewedAt:
          reportSection
            .reviewed_at,
      });
    }


    if (
      currentStatus !==
      "submitted"
    ) {
      return NextResponse.json(
        {
          error:
            `Section belum siap direview. Status saat ini: ${reportSection.status}.`,
          code:
            "SECTION_NOT_SUBMITTED",
        },
        {
          status: 409,
        }
      );
    }


    if (
      !reportSection
        .submitted_by
    ) {
      return NextResponse.json(
        {
          error:
            "Section tidak memiliki submitted_by. Review dibatalkan.",
          code:
            "MISSING_SUBMITTER",
        },
        {
          status: 409,
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
    // ATOMIC MARK REVIEWED + AUDIT EVENT
    // ========================================================

    const {
      data:
        reviewRows,
      error:
        reviewRpcError,
    } =
      await admin.rpc(
        "review_report_section",
        {
          p_report_section_id:
            reportSection.id,

          p_actor_user_id:
            user.id,

          p_actor_name:
            actorName,
        }
      );


    if (
      reviewRpcError
    ) {
      throw reviewRpcError;
    }


    const reviewedSection =
      Array.isArray(
        reviewRows
      )
        ? reviewRows[0]
        : reviewRows;


    if (
      !reviewedSection
    ) {
      throw new Error(
        "Review transition gagal."
      );
    }


    return NextResponse.json({
      success:
        true,

      alreadyReviewed:
        false,

      reportId:
        report.id,

      reportNumber:
        report.report_number,

      reportSectionId:
        reviewedSection
          .report_section_id,

      sectionCode:
        section.code,

      sectionName:
        section.name,

      status:
        reviewedSection.status,

      submittedBy:
        reviewedSection
          .submitted_by,

      submittedAt:
        reviewedSection
          .submitted_at,

      reviewedBy:
        reviewedSection
          .reviewed_by,

      reviewedAt:
        reviewedSection
          .reviewed_at,

      eventType:
        reviewedSection
          .event_type ??
        null,
    });

  } catch (
    error: any
  ) {
    console.error(
      "Production section review error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to review Production section.",
      },
      {
        status: 500,
      }
    );
  }
}
