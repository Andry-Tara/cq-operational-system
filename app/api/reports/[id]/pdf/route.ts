import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


function relationOne(
  value: any
) {
  return Array.isArray(
    value
  )
    ? value[0]
    : value;
}


export async function GET(
  request: NextRequest,
  context: {
    params:
      Promise<{
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
      return NextResponse.redirect(
        new URL(
          "/auth/login",
          request.url
        )
      );
    }


    // ========================================================
    // REPORT
    //
    // RLS still verifies parent report / outlet visibility.
    // ========================================================

    const {
      data:
        report,
      error:
        reportError,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          outlet_id,
          form_id,
          report_number,
          pdf_storage_path
        `)
        .eq(
          "id",
          id
        )
        .maybeSingle();


    if (
      reportError
    ) {
      return NextResponse.json(
        {
          error:
            reportError.message,
        },
        {
          status:
            404,
        }
      );
    }


    if (!report) {
      return NextResponse.json(
        {
          error:
            "Report tidak ditemukan.",
        },
        {
          status:
            404,
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
      await supabase
        .from("forms")
        .select(`
          id,
          code
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
            formError?.message ||
            "Form report tidak ditemukan.",
        },
        {
          status:
            404,
        }
      );
    }


    const formCode =
      String(
        form.code ||
        ""
      )
        .trim()
        .toUpperCase();


    const isCkReport =
      [
        "OPENING_CK",
        "CLOSING_CK",
      ].includes(
        formCode
      );


    // ========================================================
    // CK FULL-PDF GUARD
    //
    // Generic PDF = WHOLE CK parent report.
    //
    // A user with any CK AREA / SECTION scope at this outlet
    // must use the dedicated area/PIC report instead.
    //
    // This mirrors Report Center fail-closed behavior across
    // OPENING_CK + CLOSING_CK.
    //
    // Prevents:
    //
    // Muzza -> Production content
    // Wahyu -> Warehouse content
    // PIC   -> another PIC section
    // ========================================================

    if (
      isCkReport
    ) {
      const {
        data:
          roleRow,
        error:
          roleError,
      } =
        await supabase
          .from(
            "user_roles"
          )
          .select(`
            roles (
              is_admin
            )
          `)
          .eq(
            "user_id",
            user.id
          )
          .limit(1)
          .maybeSingle();


      if (
        roleError
      ) {
        return NextResponse.json(
          {
            error:
              roleError.message,
          },
          {
            status:
              500,
          }
        );
      }


      const role =
        relationOne(
          roleRow?.roles
        );


      const isAdministrator =
        role?.is_admin ===
        true;


      if (
        !isAdministrator
      ) {
        const {
          data:
            ckForms,
          error:
            ckFormsError,
        } =
          await supabase
            .from("forms")
            .select("id")
            .in(
              "code",
              [
                "OPENING_CK",
                "CLOSING_CK",
              ]
            );


        if (
          ckFormsError
        ) {
          return NextResponse.json(
            {
              error:
                ckFormsError.message,
            },
            {
              status:
                500,
            }
          );
        }


        const ckFormIds =
          (
            ckForms ??
            []
          ).map(
            (
              item: any
            ) =>
              item.id
          );


        if (
          ckFormIds.length
        ) {
          const [
            leaderResult,
            sectionResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "form_area_leaders"
                )
                .select("id")
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "outlet_id",
                  report.outlet_id
                )
                .in(
                  "form_id",
                  ckFormIds
                )
                .limit(1),

              supabase
                .from(
                  "user_section_permissions"
                )
                .select(`
                  id,
                  can_view,
                  can_submit,
                  can_review
                `)
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "outlet_id",
                  report.outlet_id
                )
                .in(
                  "form_id",
                  ckFormIds
                ),
            ]);


          if (
            leaderResult.error
          ) {
            return NextResponse.json(
              {
                error:
                  leaderResult
                    .error
                    .message,
              },
              {
                status:
                  500,
              }
            );
          }


          if (
            sectionResult.error
          ) {
            return NextResponse.json(
              {
                error:
                  sectionResult
                    .error
                    .message,
              },
              {
                status:
                  500,
              }
            );
          }


          const hasLeaderScope =
            (
              leaderResult.data ??
              []
            ).length >
            0;


          const hasSectionScope =
            (
              sectionResult.data ??
              []
            ).some(
              (
                row: any
              ) =>
                row.can_view ===
                  true ||
                row.can_submit ===
                  true ||
                row.can_review ===
                  true
            );


          if (
            hasLeaderScope ||
            hasSectionScope
          ) {
            return NextResponse.json(
              {
                error:
                  "Full Central Kitchen PDF is not available for area or section scoped users.",
                code:
                  "CK_FULL_PDF_FORBIDDEN",
              },
              {
                status:
                  403,
              }
            );
          }
        }
      }
    }


    // ========================================================
    // PDF EXISTS
    // ========================================================

    if (
      !report.pdf_storage_path
    ) {
      return NextResponse.json(
        {
          error:
            "PDF report tidak ditemukan.",
        },
        {
          status:
            404,
        }
      );
    }


    // ========================================================
    // DOWNLOAD PRIVATE PDF
    //
    // Browser never receives Supabase signed URL.
    // ========================================================

    const {
      data:
        pdfBlob,
      error:
        downloadError,
    } =
      await supabase
        .storage
        .from(
          "operational-reports"
        )
        .download(
          report.pdf_storage_path
        );


    if (
      downloadError ||
      !pdfBlob
    ) {
      return NextResponse.json(
        {
          error:
            downloadError?.message ||
            "Unable to open PDF.",
        },
        {
          status:
            500,
        }
      );
    }


    // ========================================================
    // SAFE FILENAME
    // ========================================================

    const safeReportNumber =
      String(
        report.report_number ||
        "operational-report"
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        );


    const filename =
      `${safeReportNumber}.pdf`;


    // ========================================================
    // STREAM THROUGH APPLICATION DOMAIN
    // ========================================================

    const arrayBuffer =
      await pdfBlob
        .arrayBuffer();


    return new NextResponse(
      arrayBuffer,
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="${filename}"`,

          "Content-Length":
            String(
              arrayBuffer.byteLength
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );

  } catch (
    error: any
  ) {
    console.error(
      "Report PDF proxy error:",
      error
    );


    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to open PDF.",
      },
      {
        status:
          500,
      }
    );
  }
}
