import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildAuditReportPdf,
  type AuditPdfFinding,
} from "@/lib/pdf/audit-report";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic =
  "force-dynamic";

function one<T>(
  value:
    | T
    | T[]
    | null
    | undefined,
): T | null {
  return Array.isArray(
    value,
  )
    ? value[0] ??
        null
    : value ??
        null;
}

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
      !UUID.test(
        sessionId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid audit session.",
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
            "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const admin =
      createAdminClient();

    const {
      data: session,
      error:
        sessionError,
    } =
      await admin
        .from(
          "audit_sessions",
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          audit_number,
          audit_date,
          status,
          auditor_user_id,
          auditor_name_snapshot,
          started_at,
          submitted_at,
          score,
          scoring_snapshot
        `)
        .eq(
          "id",
          sessionId,
        )
        .maybeSingle();

    if (
      sessionError ||
      !session
    ) {
      return NextResponse.json(
        {
          error:
            "Audit session tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      session.organization_id !==
      access.profile.organization_id
    ) {
      return NextResponse.json(
        {
          error:
            "Audit session tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    const isOwner =
      session.auditor_user_id ===
      user.id;

    const managementRead =
      managementAccess.ok &&
      session.status ===
        "submitted";

    const canRead =
      access.isAdmin ||
      isOwner ||
      managementRead;

    if (!canRead) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke audit PDF ini.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      session.status !==
      "submitted"
    ) {
      return NextResponse.json(
        {
          error:
            "PDF hanya tersedia untuk audit yang sudah disubmit.",
        },
        {
          status: 409,
        },
      );
    }

    const [
      outletResult,
      findingsResult,
    ] =
      await Promise.all([
        admin
          .from(
            "outlets",
          )
          .select(
            "id,code,name",
          )
          .eq(
            "id",
            session.outlet_id,
          )
          .maybeSingle(),

        admin
          .from(
            "audit_findings",
          )
          .select(`
            id,
            question_code_snapshot,
            question_text_snapshot,
            area_name_snapshot,
            finding_category_name_snapshot,
            risk_level,
            notes,
            sort_order,
            audit_finding_photos (
              id,
              storage_bucket,
              storage_path,
              original_filename,
              mime_type,
              sort_order
            )
          `)
          .eq(
            "audit_session_id",
            session.id,
          )
          .order(
            "sort_order",
          ),
      ]);

    if (
      outletResult.error ||
      !outletResult.data
    ) {
      return NextResponse.json(
        {
          error:
            "Outlet audit tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      findingsResult.error
    ) {
      throw findingsResult.error;
    }

    const findings:
      AuditPdfFinding[] =
      [];

    for (
      const row
      of findingsResult.data ??
        []
    ) {
      const rawPhotos =
        Array.isArray(
          row.audit_finding_photos,
        )
          ? row.audit_finding_photos
          : row.audit_finding_photos
            ? [
                row.audit_finding_photos,
              ]
            : [];

      const photos = [];

      for (
        const rawPhoto
        of rawPhotos
      ) {
        let bytes:
          | Uint8Array
          | null =
          null;

        try {
          const {
            data: blob,
            error:
              downloadError,
          } =
            await admin.storage
              .from(
                rawPhoto.storage_bucket,
              )
              .download(
                rawPhoto.storage_path,
              );

          if (
            !downloadError &&
            blob
          ) {
            bytes =
              new Uint8Array(
                await blob.arrayBuffer(),
              );
          }
        } catch (
          photoError
        ) {
          console.error(
            "Audit PDF evidence download error:",
            photoError,
          );
        }

        photos.push({
          id:
            rawPhoto.id,

          filename:
            rawPhoto.original_filename ??
            null,

          mimeType:
            rawPhoto.mime_type ??
            null,

          bytes,
        });
      }

      findings.push({
        id:
          row.id,

        questionCode:
          row.question_code_snapshot,

        questionText:
          row.question_text_snapshot,

        areaName:
          row.area_name_snapshot,

        categoryName:
          row.finding_category_name_snapshot,

        risk:
          row.risk_level,

        notes:
          row.notes ??
          null,

        photos,
      });
    }

    const scoring =
      session.scoring_snapshot &&
      typeof session.scoring_snapshot ===
        "object"
        ? session.scoring_snapshot as any
        : {};

    const hasScoring =
      Number(
        scoring.scoring_version ??
          0,
      ) >= 1;

    const scoreBefore =
      hasScoring
        ? Number(
            scoring.monthly_score_before,
          )
        : null;

    const auditPenalty =
      hasScoring
        ? Number(
            scoring.audit_penalty ??
              0,
          )
        : null;

    const scoreAfter =
      hasScoring
        ? Number(
            scoring.monthly_score_after ??
              session.score,
          )
        : null;

    const pdfBytes =
      await buildAuditReportPdf({
        auditNumber:
          session.audit_number,

        auditDate:
          session.audit_date,

        outletName:
          outletResult.data.name,

        outletCode:
          outletResult.data.code,

        auditorName:
          session.auditor_name_snapshot ||
          "Auditor",

        startedAt:
          session.started_at,

        submittedAt:
          session.submitted_at,

        hasScoring,

        scoreBefore:
          Number.isFinite(
            scoreBefore,
          )
            ? scoreBefore
            : null,

        auditPenalty:
          Number.isFinite(
            auditPenalty,
          )
            ? auditPenalty
            : null,

        scoreAfter:
          Number.isFinite(
            scoreAfter,
          )
            ? scoreAfter
            : null,

        findings,
      });

    const safeAuditNumber =
      String(
        session.audit_number ||
          "audit-report",
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-",
        )
        .replace(
          /-+/g,
          "-",
        );

    // ========================================================
    // OPTIONAL PRIVATE PDF PERSISTENCE
    //
    // Used by Secure Share.
    // The file remains private inside operational-reports.
    // ========================================================

    const persist =
      request.nextUrl.searchParams.get(
        "persist",
      ) === "1";

    if (persist) {
      const pdfStoragePath =
        [
          "audit",
          session.organization_id,
          session.outlet_id,
          session.audit_date,
          session.id,
          `${safeAuditNumber}.pdf`,
        ].join("/");

      const {
        error: uploadError,
      } =
        await admin.storage
          .from(
            "operational-reports",
          )
          .upload(
            pdfStoragePath,
            pdfBytes,
            {
              contentType:
                "application/pdf",

              upsert: true,

              cacheControl:
                "0",
            },
          );

      if (uploadError) {
        throw new Error(
          `Unable to persist audit PDF: ${uploadError.message}`,
        );
      }

      const {
        error: updateError,
      } =
        await admin
          .from(
            "audit_sessions",
          )
          .update({
            pdf_storage_path:
              pdfStoragePath,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            session.id,
          );

      if (updateError) {
        throw updateError;
      }

      const persistOnly =
        request.nextUrl.searchParams.get(
          "persistOnly",
        ) === "1";

      if (persistOnly) {
        return NextResponse.json({
          success: true,

          pdfStoragePath,
        });
      }
    }

    const download =
      request.nextUrl.searchParams.get(
        "download",
      ) === "1";

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
            }; filename="${safeAuditNumber}.pdf"`,

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
      "Audit PDF error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to generate audit PDF.",
      },
      {
        status: 500,
      },
    );
  }
}
