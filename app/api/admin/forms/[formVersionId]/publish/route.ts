import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function mapRpcError(error: { code?: string; message?: string } | null) {
  switch (error?.code) {
    case "22P02":
      return errorResponse(400, "Invalid form version id or input.");
    case "22023":
      return errorResponse(
        error.message?.toLowerCase().includes("form version was not found")
          ? 404
          : 400,
        error.message?.toLowerCase().includes("form version was not found")
          ? "Form version not found."
          : "This form version is not ready to publish.",
      );
    case "42501":
      return errorResponse(403, "Permission denied.");
    case "55000":
      return errorResponse(409, "This form version can no longer be published.");
    case "28000":
      return errorResponse(401, "Unauthorized.");
    default:
      return errorResponse(500, "Unable to publish this form version.");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ formVersionId: string }> },
) {
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return errorResponse(access.status, access.error);
  }

  const { formVersionId } = await params;

  if (!UUID_PATTERN.test(formVersionId)) {
    return errorResponse(400, "Invalid form version id or input.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_form_version", {
    p_form_version_id: formVersionId,
  });

  if (error) {
    return mapRpcError(error);
  }

  return NextResponse.json({
    ok: true,
    formVersionId,
  });
}
