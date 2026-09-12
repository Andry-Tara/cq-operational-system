import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function mapRpcError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";

  switch (error?.code) {
    case "22P02":
      return { status: 400, message: "Invalid activation input." };
    case "22023":
      return {
        status:
          message.includes("outlet was not found") ||
          message.includes("form version was not found")
            ? 404
            : 400,
        message:
          message.includes("outlet was not found") ||
          message.includes("form version was not found")
            ? "Outlet or form version not found."
            : "Invalid activation request.",
      };
    case "42501":
      return { status: 403, message: "Permission denied." };
    case "55000":
      return {
        status: 409,
        message: "Only published form versions can be activated.",
      };
    case "23505":
      return {
        status: 409,
        message: "This outlet already has an active assignment.",
      };
    case "28000":
      return { status: 401, message: "Unauthorized." };
    default:
      return { status: 500, message: "Unable to activate this form version." };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formVersionId: string }> },
) {
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return errorResponse(access.status, access.error);
  }

  const { formVersionId } = await params;

  if (!UUID_PATTERN.test(formVersionId)) {
    return errorResponse(400, "Invalid activation input.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid activation input.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(400, "Invalid activation input.");
  }

  const rawOutletIds = (body as { outletIds?: unknown }).outletIds;
  if (
    Object.keys(body).length !== 1 ||
    !Array.isArray(rawOutletIds) ||
    rawOutletIds.length === 0 ||
    rawOutletIds.some(
      (outletId) =>
        typeof outletId !== "string" || !UUID_PATTERN.test(outletId),
    )
  ) {
    return errorResponse(400, "Select at least one valid outlet.");
  }

  const outletIds = [...new Set(rawOutletIds as string[])];
  if (outletIds.length > 100) {
    return errorResponse(400, "Select no more than 100 outlets at once.");
  }

  const supabase = await createClient();
  const results = [];

  for (const outletId of outletIds) {
    const { data: assignmentId, error } = await supabase.rpc(
      "activate_outlet_form_version",
      {
        p_outlet_id: outletId,
        p_form_version_id: formVersionId,
      },
    );

    if (error) {
      const mapped = mapRpcError(error);
      results.push({
        outletId,
        ok: false,
        error: mapped.message,
      });
      continue;
    }

    if (typeof assignmentId !== "string" || !UUID_PATTERN.test(assignmentId)) {
      results.push({
        outletId,
        ok: false,
        error: "Activation returned an invalid assignment.",
      });
      continue;
    }

    results.push({
      outletId,
      assignmentId,
      ok: true,
    });
  }

  return NextResponse.json({
    ok: true,
    formVersionId,
    results,
  });
}
