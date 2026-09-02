import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
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
          outlet_id
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
    //
    // reports.all_outlets
    // OR assigned user_outlets
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


    // ========================================================
    // REPORT VERSION SECTIONS
    // ========================================================

    const {
      data:
        sectionRows,
      error:
        sectionError,
    } =
      await supabase
        .from(
          "report_sections"
        )
        .select(`
          version_section_id
        `)
        .eq(
          "report_id",
          report.id
        );

    if (sectionError) {
      throw sectionError;
    }

    const versionSectionIds =
      Array.from(
        new Set(
          (
            sectionRows ??
            []
          )
            .map(
              (row: any) =>
                row
                  .version_section_id
            )
            .filter(
              Boolean
            )
        )
      ) as string[];

    if (
      versionSectionIds
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Report belum memiliki section.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // QUESTIONS
    // ========================================================

    const {
      data:
        questionRows,
      error:
        questionError,
    } =
      await supabase
        .from("questions")
        .select(`
          id,
          code,
          question_text
        `)
        .in(
          "version_section_id",
          versionSectionIds
        )
        .eq(
          "is_active",
          true
        );

    if (questionError) {
      throw questionError;
    }


    const questions =
      (
        questionRows ??
        []
      )
        .map(
          (
            question: any
          ) => ({
            id:
              question.id,

            code:
              question.code ??
              null,

            questionText:
              question
                .question_text,
          })
        )
        .sort(
          (
            a: any,
            b: any
          ) =>
            String(
              a.code ||
              a.questionText ||
              ""
            ).localeCompare(
              String(
                b.code ||
                b.questionText ||
                ""
              )
            )
        );


    return NextResponse.json({
      success: true,

      reportNumber:
        report.report_number,

      questions,
    });

  } catch (
    error: any
  ) {
    console.error(
      "Load reopen questions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load report questions.",
      },
      {
        status: 500,
      }
    );
  }
}
