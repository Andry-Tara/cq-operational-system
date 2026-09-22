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
  getAccessContext,
} from "@/lib/admin/require-admin";


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


function escapeHtml(
  value: string
) {
  return value.replace(
    /[&<>"']/g,
    (
      char
    ) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      })[char] || char
  );
}


async function renderStoredReportPdfViewer({
  admin,
  storagePath,
}: {
  admin: any;
  storagePath: string;
}) {
  const {
    data,
    error,
  } =
    await admin
      .storage
      .from(
        "operational-reports"
      )
      .createSignedUrl(
        storagePath,
        300
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to open PDF.",
      },
      {
        status: 500,
      }
    );
  }

  const fileName =
    storagePath
      .split("/")
      .pop()
      ?.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      ) || "report.pdf";

  const safeTitle =
    escapeHtml(fileName);

  const safeUrl =
    escapeHtml(data.signedUrl);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: #111827;
      overflow: hidden;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }

    .fallback {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      color: #ffffff;
      font-family: Arial, sans-serif;
      pointer-events: none;
    }

    .fallback a {
      color: #ffffff;
      font-weight: 700;
      pointer-events: auto;
    }
  </style>
</head>
<body>
  <iframe
    src="${safeUrl}"
    title="${safeTitle}"
    loading="eager"
  ></iframe>

  <noscript>
    <div class="fallback">
      <a href="${safeUrl}" target="_blank" rel="noreferrer">
        Open PDF
      </a>
    </div>
  </noscript>
</body>
</html>`;

  return new NextResponse(
    html,
    {
      status: 200,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    }
  );
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
    // AUTH + ACCESS CONTEXT
    // ========================================================

    const admin =
      createAdminClient();

    const {
      user,
      profile:
        requesterProfile,
      isAdmin,
      permissionCodes,
    } =
      await getAccessContext();

    if (
      !requesterProfile ||
      !requesterProfile.organization_id ||
      requesterProfile.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Permission denied.",
        },
        {
          status: 403,
        }
      );
    }

    const hasReportsView =
      isAdmin ||
      permissionCodes.includes(
        "reports.view"
      );

    const hasAllOutlets =
      isAdmin ||
      permissionCodes.includes(
        "reports.all_outlets"
      );


    // Scoped users continue through normal RLS.
    // BOD / ORG_ADMIN organization-wide readers use trusted
    // server reads only after RBAC has authorized them.
    const reportClient =
      hasAllOutlets
        ? admin
        : supabase;


    // ========================================================
    // REPORT
    //
    // RLS still verifies parent report / outlet visibility.
    // ========================================================

    let {
      data:
        report,
      error:
        reportError,
    } =
      await reportClient
        .from("reports")
        .select(`
          id,
          organization_id,
          outlet_id,
          form_id,
          report_number,
          pdf_storage_path,
          forms (
            code
          )
        `)
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          requesterProfile.organization_id
        )
        .maybeSingle();




    // Users without global report permission must go through
    // exact split-form authorization below.
    if (
      !hasReportsView &&
      !hasAllOutlets &&
      report
    ) {
      report = null;
    }


const reportAccessDenied =
      Boolean(
        reportError
      ) &&
      (
        String(
          reportError?.code ||
          ""
        ) === "42501" ||
        /permission denied/i.test(
          String(
            reportError?.message ||
            ""
          )
        )
      );


    // Permission-denied from parent report RLS is not yet the
    // final answer for split FOH / BOH users.
    //
    // Let the explicit outlet + form permission fallback below
    // decide whether this exact user may read this exact PDF.
    //
    // Other database errors still fail immediately.
    if (
      reportError &&
      !reportAccessDenied
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
      // ======================================================
      // SPLIT OUTLET PDF FALLBACK
      //
      // A FOH / BOH operational user can open the final PDF
      // only when the exact outlet + form is assigned through
      // user_form_permissions.
      //
      // CK is intentionally excluded because its generic
      // parent PDF can contain multiple areas / PIC sections.
      // ======================================================

      const {
        data:
          scopedReport,
        error:
          scopedReportError,
      } =
        await admin
          .from("reports")
          .select(`
            id,
            outlet_id,
            form_id,
            report_number,
            pdf_storage_path,
            forms (
              code
            )
          `)
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            requesterProfile.organization_id
          )
          .maybeSingle();

      if (
        scopedReportError
      ) {
        return NextResponse.json(
          {
            error:
              scopedReportError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (
        scopedReport
      ) {
        const scopedForm =
          relationOne(
            scopedReport.forms
          );

        const scopedFormCode =
          String(
            scopedForm?.code ||
            ""
          )
            .trim()
            .toUpperCase();

        const isSplitOutletForm =
          [
            "OPENING_FOH",
            "OPENING_BOH",
            "CLOSING_FOH",
            "CLOSING_BOH",
          ].includes(
            scopedFormCode
          );

        if (
          isSplitOutletForm
        ) {
          const {
            data:
              formPermission,
            error:
              formPermissionError,
          } =
            await admin
              .from(
                "user_form_permissions"
              )
              .select(`
                can_fill,
                can_submit,
                can_review,
                can_override
              `)
              .eq(
                "user_id",
                user.id
              )
              .eq(
                "outlet_id",
                scopedReport.outlet_id
              )
              .eq(
                "form_id",
                scopedReport.form_id
              )
              .limit(1)
              .maybeSingle();

          if (
            formPermissionError
          ) {
            return NextResponse.json(
              {
                error:
                  formPermissionError.message,
              },
              {
                status: 500,
              }
            );
          }

          const canOpenOwnFormReport =
            formPermission?.can_fill ===
              true ||
            formPermission?.can_submit ===
              true ||
            formPermission?.can_review ===
              true ||
            formPermission?.can_override ===
              true;

          if (
            canOpenOwnFormReport &&
            scopedReport
              .pdf_storage_path
          ) {
            return renderStoredReportPdfViewer({
              admin,
              storagePath:
                scopedReport
                  .pdf_storage_path,
            });
          }

        }
      }

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

    const form =
      relationOne(
        report.forms
      );

    if (!form) {
      return NextResponse.json(
        {
          error:
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
      isCkReport &&
      !hasAllOutlets
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
    // RENDER APP-DOMAIN PDF VIEWER
    //
    // Keep permission checks in this route and keep the browser URL
    // on the application domain while streaming the PDF body.
    // ========================================================

    return renderStoredReportPdfViewer({
      admin,
      storagePath:
        report.pdf_storage_path,
    });


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
