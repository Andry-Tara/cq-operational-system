import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const access = await checkPermissionApi("closing.submit");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid applicability input." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const reportId = payload.reportId;
  const versionSectionId = payload.versionSectionId;
  const status = payload.status;
  const reason = payload.reason;
  if (typeof reportId !== "string" || !UUID_PATTERN.test(reportId) || typeof versionSectionId !== "string" || !UUID_PATTERN.test(versionSectionId) || (status !== "active" && status !== "no_production") || (status === "no_production" && (typeof reason !== "string" || reason.trim() === ""))) {
    return NextResponse.json({ error: "Invalid applicability input." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_report_section_applicability", {
    p_report_id: reportId,
    p_version_section_id: versionSectionId,
    p_status: status,
    p_reason: status === "no_production" ? reason : null,
  });
  if (error) {
    const code = error.code;
    const mappedStatus = code === "28000" ? 401 : code === "42501" ? 403 : code === "55000" ? 409 : code === "22023" ? 400 : 500;
    return NextResponse.json({ error: code === "55000" ? "This section is no longer editable." : code === "42501" ? "Permission denied." : code === "22023" ? "Invalid applicability request." : "Unable to update section applicability." }, { status: mappedStatus });
  }
  return NextResponse.json({ ok: true });
}
