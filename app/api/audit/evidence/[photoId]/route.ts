import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      photoId: string;
    }>;
  },
) {
  try {
    const { photoId } = await params;

    if (!UUID.test(photoId)) {
      return NextResponse.json(
        {
          error: "Invalid evidence photo.",
        },
        {
          status: 400,
        },
      );
    }

    const auditAccess =
      await checkPermissionApi(
        "audit.submit",
      );

    const reportAccess =
      await checkPermissionApi(
        "reports.view",
      );

    const managementAccess =
      await checkPermissionApi(
        "audit.view_management",
      );

    if (
      !auditAccess.ok &&
      !reportAccess.ok &&
      !managementAccess.ok
    ) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
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
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const admin =
      createAdminClient();

    const {
      data: photo,
      error: photoError,
    } =
      await admin
        .from(
          "audit_finding_photos",
        )
        .select(`
          id,
          audit_finding_id,
          storage_bucket,
          storage_path,
          original_filename,
          mime_type
        `)
        .eq(
          "id",
          photoId,
        )
        .maybeSingle();

    if (
      photoError ||
      !photo
    ) {
      return NextResponse.json(
        {
          error:
            "Evidence tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      data: finding,
      error: findingError,
    } =
      await admin
        .from(
          "audit_findings",
        )
        .select(
          "id,audit_session_id",
        )
        .eq(
          "id",
          photo.audit_finding_id,
        )
        .maybeSingle();

    if (
      findingError ||
      !finding
    ) {
      return NextResponse.json(
        {
          error:
            "Finding tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      data: session,
      error: sessionError,
    } =
      await admin
        .from(
          "audit_sessions",
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          auditor_user_id,
          status
        `)
        .eq(
          "id",
          finding.audit_session_id,
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

    const isAdmin =
      (
        auditAccess.ok &&
        auditAccess.isAdmin
      ) ||
      (
        reportAccess.ok &&
        reportAccess.isAdmin
      ) ||
      (
        managementAccess.ok &&
        managementAccess.isAdmin
      );

    const managementRead =
      managementAccess.ok &&
      session.organization_id ===
        managementAccess.profile
          .organization_id &&
      session.status ===
        "submitted";

    let allowed =
      isAdmin ||
      session.auditor_user_id ===
        user.id ||
      managementRead;

    if (
      !allowed &&
      reportAccess.ok
    ) {
      const {
        data:
          hasOutletAccess,
      } =
        await supabase.rpc(
          "has_outlet_access",
          {
            p_outlet_id:
              session.outlet_id,
          },
        );

      allowed =
        hasOutletAccess ===
        true;
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke evidence ini.",
        },
        {
          status: 403,
        },
      );
    }

    const {
      data: file,
      error: downloadError,
    } =
      await admin.storage
        .from(
          photo.storage_bucket,
        )
        .download(
          photo.storage_path,
        );

    if (
      downloadError ||
      !file
    ) {
      return NextResponse.json(
        {
          error:
            "Evidence file tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    const bytes =
      await file.arrayBuffer();

    return new NextResponse(
      bytes,
      {
        status: 200,

        headers: {
          "Content-Type":
            photo.mime_type ||
            file.type ||
            "application/octet-stream",

          "Content-Disposition":
            "inline",

          "Cache-Control":
            "private, max-age=300",
        },
      },
    );
  } catch (
    error: any
  ) {
    console.error(
      "Audit evidence error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load evidence.",
      },
      {
        status: 500,
      },
    );
  }
}
