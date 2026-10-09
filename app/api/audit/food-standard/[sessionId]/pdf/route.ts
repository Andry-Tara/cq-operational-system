import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  loadQaFoodReportData,
  QA_CRITERIA,
} from "@/lib/qa-food/report-data";

import {
  buildQaFoodReportPdf,
} from "@/lib/pdf/qa-food-report";


const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


export const dynamic =
  "force-dynamic";


export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      sessionId: string;
    }>;
  },
) {
  try {
    const {
      sessionId,
    } =
      await params;


    if (
      !UUID.test(sessionId)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid QA Food session.",
        },
        {
          status: 400,
        },
      );
    }


    const submitAccess =
      await checkPermissionApi(
        "audit.submit",
      );

    const managementAccess =
      await checkPermissionApi(
        "audit.view_management",
      );


    const access =
      submitAccess.ok
        ? submitAccess
        : managementAccess.ok
          ? managementAccess
          : null;


    if (!access) {
      const denied =
        submitAccess.status === 401
          ? submitAccess
          : managementAccess;

      return NextResponse.json(
        {
          error:
            denied.error,
        },
        {
          status:
            denied.status,
        },
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
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }


    const admin =
      createAdminClient();


    const report =
      await loadQaFoodReportData(
        admin,
        sessionId,
        access.profile.organization_id,
      );


    if (!report) {
      return NextResponse.json(
        {
          error:
            "QA Food report not found.",
        },
        {
          status: 404,
        },
      );
    }


    const isOwner =
      report.session.created_by ===
      user.id;


    let assignedOutlet =
      false;


    if (
      !access.isAdmin &&
      !isOwner &&
      submitAccess.ok
    ) {
      const {
        data,
      } =
        await admin
          .from("user_outlets")
          .select("outlet_id")
          .eq(
            "user_id",
            user.id,
          )
          .eq(
            "outlet_id",
            report.session.outlet_id,
          )
          .eq(
            "is_active",
            true,
          )
          .maybeSingle();


      assignedOutlet =
        Boolean(data);
    }


    const canRead =
      access.isAdmin ||
      isOwner ||
      (
        managementAccess.ok &&
        report.session.status ===
          "FINALIZED"
      ) ||
      (
        submitAccess.ok &&
        assignedOutlet &&
        report.session.status ===
          "FINALIZED"
      );


    if (!canRead) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke QA Food PDF ini.",
        },
        {
          status: 403,
        },
      );
    }


    if (
      report.session.status !==
      "FINALIZED"
    ) {
      return NextResponse.json(
        {
          error:
            "PDF hanya tersedia untuk QA assessment yang sudah finalized.",
        },
        {
          status: 409,
        },
      );
    }


    const menus =
      [];


    for (
      const item
      of report.items
    ) {
      const evidence =
        [];


      for (
        const row
        of item.evidence
      ) {
        let bytes:
          | Uint8Array
          | null =
          null;


        try {
          const {
            data,
            error,
          } =
            await admin.storage
              .from(
                row.storage_bucket,
              )
              .download(
                row.storage_path,
              );


          if (
            !error &&
            data
          ) {
            bytes =
              new Uint8Array(
                await data.arrayBuffer(),
              );
          }

        } catch {
          bytes =
            null;
        }


        evidence.push({
          mimeType:
            row.mime_type ??
            null,

          bytes,

          captureSource:
            row.capture_source ??
            null,

          capturedAt:
            row.captured_at ??
            null,

          uploadedAt:
            row.uploaded_at ??
            null,

          locationStatus:
            row.location_status ??
            null,
        });
      }


      menus.push({
        sequenceNo:
          Number(
            item.sequence_no,
          ),

        name:
          String(
            item.menu_name_snapshot,
          ),

        serviceSeconds:
          item.service_seconds == null
            ? null
            : Number(
                item.service_seconds,
              ),

        serviceStandardSeconds:
          Number(
            item.service_standard_seconds ??
            780,
          ),

        serviceStatus:
          item.service_status ??
          null,

        score:
          Number(item.score),

        criteria:
          QA_CRITERIA.map(
            (criterion) => ({
              label:
                criterion.label,

              status:
                String(
                  item.assessment?.[
                    criterion.status
                  ] ??
                  "-",
                ),

              note:
                item.assessment?.[
                  criterion.note
                ] ??
                null,
            }),
          ),

        evidence,
      });
    }


    const scoring =
      report.scoring &&
      typeof report.scoring ===
        "object"
        ? report.scoring
        : {};


    const pdfBytes =
      await buildQaFoodReportPdf({
        qaNumber:
          report.session.qa_number ||
          "QAF-REPORT",

        businessDate:
          report.session.business_date,

        outletName:
          report.outlet.name,

        outletCode:
          report.outlet.code,

        timezone:
          report.outlet.timezone ||
          "Asia/Jakarta",

        auditorName:
          report.session.auditor_name_snapshot ||
          "Auditor",

        score:
          Number(
            report.session.score ??
            0,
          ),

        maxScore:
          Number(
            report.session.max_score ??
            100,
          ),

        pointsLost:
          Number(
            scoring.points_lost ??
            0,
          ),

        standardMenuCount:
          Number(
            scoring.standard_menu_count ??
            0,
          ),

        needsCorrectionCount:
          Number(
            scoring.needs_correction_count ??
            0,
          ),

        onTimeCount:
          Number(
            scoring.on_time_count ??
            0,
          ),

        lateCount:
          Number(
            scoring.late_count ??
            0,
          ),

        menus,
      });


    const safeNumber =
      String(
        report.session.qa_number ||
        "qa-food-report",
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-",
        )
        .replace(
          /-+/g,
          "-",
        );


    const download =
      request.nextUrl
        .searchParams
        .get("download") ===
      "1";


    return new NextResponse(
      pdfBytes as BodyInit,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `${
              download
                ? "attachment"
                : "inline"
            }; filename="${safeNumber}-qa-food-standard.pdf"`,

          "Content-Length":
            String(
              pdfBytes.byteLength,
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );

  } catch (
    error: any
  ) {
    console.error(
      "QA Food PDF error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to generate QA Food PDF.",
      },
      {
        status: 500,
      },
    );
  }
}
