import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const access = await checkPermissionApi("audit.submit");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

    if (!UUID.test(sessionId)) {
      return NextResponse.json({ error: "Invalid audit session." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from("audit_sessions")
      .select("id,audit_number,status,auditor_user_id,submitted_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Audit session tidak ditemukan." }, { status: 404 });
    }

    if (session.auditor_user_id !== user.id) {
      return NextResponse.json({ error: "Audit session bukan milik user ini." }, { status: 403 });
    }

    if (session.status === "submitted") {
      return NextResponse.json({ session, alreadySubmitted: true });
    }

    if (session.status !== "draft") {
      return NextResponse.json(
        { error: "Audit session tidak dapat disubmit." },
        { status: 409 },
      );
    }

    const submittedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from("audit_sessions")
      .update({ status: "submitted", submitted_at: submittedAt })
      .eq("id", session.id)
      .eq("status", "draft")
      .select("id,audit_number,audit_date,status,form_version_id,started_at,submitted_at,score")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ session: updated, alreadySubmitted: false });
  } catch (error: any) {
    console.error("Audit submit error:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to submit audit." },
      { status: 500 },
    );
  }
}
