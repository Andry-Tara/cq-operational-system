import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await checkPermissionApi("audit.submit");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Invalid finding id." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: finding, error: findingError } = await admin
      .from("audit_findings")
      .select(`
        id,
        audit_sessions (id,status,auditor_user_id)
      `)
      .eq("id", id)
      .maybeSingle();

    if (findingError || !finding) {
      return NextResponse.json({ error: "Finding tidak ditemukan." }, { status: 404 });
    }

    const session = Array.isArray(finding.audit_sessions)
      ? finding.audit_sessions[0]
      : finding.audit_sessions;

    if (!session || session.auditor_user_id !== user.id) {
      return NextResponse.json({ error: "Finding bukan milik user ini." }, { status: 403 });
    }

    if (session.status !== "draft") {
      return NextResponse.json({ error: "Audit sudah disubmit." }, { status: 409 });
    }

    const { data: photos, error: photosError } = await admin
      .from("audit_finding_photos")
      .select("storage_bucket,storage_path")
      .eq("audit_finding_id", id);

    if (photosError) throw photosError;

    const byBucket = new Map<string, string[]>();
    for (const photo of photos ?? []) {
      const list = byBucket.get(photo.storage_bucket) ?? [];
      list.push(photo.storage_path);
      byBucket.set(photo.storage_bucket, list);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) throw removeError;
    }

    const { error: deleteError } = await admin
      .from("audit_findings")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Audit finding delete error:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to remove finding." },
      { status: 500 },
    );
  }
}
