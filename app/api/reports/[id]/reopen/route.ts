import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";


export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const {
      id,
    } =
      await context.params;

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
    // REPORTS.REOPEN PERMISSION
    // ========================================================

    const {
      data:
        canReopen,
      error:
        permissionError,
    } =
      await supabase.rpc(
        "has_permission",
        {
          p_permission_code:
            "reports.reopen",
        }
      );

    if (permissionError) {
      throw permissionError;
    }

    if (
      canReopen !== true
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to reopen reports.",
        },
        {
          status: 403,
        }
      );
    }


    // ========================================================
    // BODY
    // ========================================================

    const body =
      await request.json();

    const reason =
      String(
        body?.reason ||
        ""
      ).trim();

    const rawQuestionIds =
      Array.isArray(
        body?.questionIds
      )
        ? body.questionIds
        : [];

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const questionIds =
      Array.from(
        new Set(
          rawQuestionIds
            .map(
              (
                value:
                  unknown
              ) =>
                String(
                  value ||
                  ""
                ).trim()
            )
            .filter(
              (
                value:
                  string
              ) =>
                uuidPattern.test(
                  value
                )
            )
        )
      );


    if (
      questionIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Pilih minimal 1 pertanyaan yang perlu diperbaiki.",
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
            "Alasan reopen wajib diisi minimal 5 karakter.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // REPORT
    // ========================================================

    const {
      data: report,
      error:
        reportError,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          report_number,
          status,
          outlet_id,
          business_date
        `)
        .eq(
          "id",
          id
        )
        .maybeSingle();

    if (
      reportError ||
      !report
    ) {
      return NextResponse.json(
        {
          error:
            reportError?.message ||
            "Report tidak ditemukan.",
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
        outletAccessError,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            report.outlet_id,
        }
      );

    if (outletAccessError) {
      throw outletAccessError;
    }

    if (
      hasOutletAccess !== true
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this report outlet.",
        },
        {
          status: 403,
        }
      );
    }


    const currentStatus =
      String(
        report.status ||
        ""
      ).toLowerCase();


    if (
      ![
        "completed",
        "submitted",
      ].includes(
        currentStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Hanya report Completed yang dapat di-reopen.",
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // VALIDATE REOPEN QUESTIONS
    // ========================================================

    const {
      data:
        reportSectionRows,
      error:
        reportSectionError,
    } =
      await supabase
        .from(
          "report_sections"
        )
        .select(
          "id"
        )
        .eq(
          "report_id",
          report.id
        );

    if (
      reportSectionError
    ) {
      throw reportSectionError;
    }


    const reportSectionIds =
      (
        reportSectionRows ??
        []
      )
        .map(
          (row: any) =>
            row.id
        )
        .filter(
          Boolean
        );


    if (
      reportSectionIds
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Report section tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        validQuestionRows,
      error:
        validQuestionError,
    } =
      await supabase
        .from(
          "report_answers"
        )
        .select(
          "question_id"
        )
        .in(
          "report_section_id",
          reportSectionIds
        )
        .in(
          "question_id",
          questionIds
        );

    if (
      validQuestionError
    ) {
      throw validQuestionError;
    }


    const validQuestionIds =
      new Set(
        (
          validQuestionRows ??
          []
        ).map(
          (row: any) =>
            row.question_id
        )
      );


    const invalidQuestion =
      questionIds.find(
        (
          questionId
        ) =>
          !validQuestionIds.has(
            questionId
          )
      );


    if (
      invalidQuestion
    ) {
      return NextResponse.json(
        {
          error:
            "Ada pertanyaan reopen yang tidak termasuk dalam report ini.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // REOPEN REPORT
    // ========================================================

    const {
      data:
        updatedReport,
      error:
        updateError,
    } =
      await supabase
        .from("reports")
        .update({
          status:
            "reopened",

          reopened_by:
            user.id,

          reopened_at:
            new Date()
              .toISOString(),

          reopen_reason:
            reason,

          reopen_question_ids:
            questionIds,

          completed_at:
            null,
        })
        .eq(
          "id",
          report.id
        )
        .select(`
          id,
          report_number,
          status,
          reopened_at,
          reopen_reason
        `)
        .single();


    if (
      updateError
    ) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }


    // ========================================================
    // REOPEN REPORT SECTION TOO
    // ========================================================

    const {
      error:
        sectionError,
    } =
      await supabase
        .from(
          "report_sections"
        )
        .update({
          status:
            "in_progress",
        })
        .eq(
          "report_id",
          report.id
        );


    if (
      sectionError
    ) {
      console.error(
        "Unable to reopen report sections:",
        sectionError
      );
    }


    
    // Refresh dashboard/report Server Components
    // after a successful operational mutation.
    revalidatePath("/protected");
    revalidatePath("/protected/reports");

return NextResponse.json({
      success: true,

      report:
        updatedReport,
    });

  } catch (
    error: any
  ) {
    console.error(
      "Reopen report error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to reopen report.",
      },
      {
        status: 500,
      }
    );
  }
}
