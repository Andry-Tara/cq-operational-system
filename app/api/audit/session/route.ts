import { NextResponse } from "next/server";

import { getActiveOutlet } from "@/lib/active-outlet";
import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function businessDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeAuditNumber(outletCode: string, date: string) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `AUD-${outletCode.toUpperCase()}-${date.replaceAll("-", "")}-${suffix}`;
}

export async function POST() {
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

    const activeOutlet = await getActiveOutlet();
    if (!activeOutlet) {
      return NextResponse.json(
        { error: "Outlet belum dipilih.", code: "OUTLET_REQUIRED" },
        { status: 400 },
      );
    }

    const { data: hasOutletAccess, error: accessError } =
      await supabase.rpc("has_outlet_access", { p_outlet_id: activeOutlet.id });

    if (accessError || hasOutletAccess !== true) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke outlet ini." },
        { status: 403 },
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,full_name,organization_id,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.is_active === false) {
      return NextResponse.json(
        { error: "Profile auditor tidak tersedia." },
        { status: 403 },
      );
    }

    const { data: outlet, error: outletError } = await admin
      .from("outlets")
      .select("id,code,name,timezone,default_locale,organization_id,is_active")
      .eq("id", activeOutlet.id)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (outletError || !outlet) {
      return NextResponse.json({ error: "Outlet tidak ditemukan." }, { status: 404 });
    }

    const { data: existingDraft, error: draftError } = await admin
      .from("audit_sessions")
      .select("id,audit_number,audit_date,status,form_version_id,started_at,submitted_at,score")
      .eq("auditor_user_id", user.id)
      .eq("outlet_id", outlet.id)
      .eq("status", "draft")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) throw draftError;
    if (existingDraft) {
      return NextResponse.json({ session: existingDraft, resumed: true });
    }

    const { data: form, error: formError } = await admin
      .from("forms")
      .select("id,organization_id,code")
      .eq("organization_id", profile.organization_id)
      .eq("code", "OUTLET_AUDIT")
      .eq("is_active", true)
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json(
        { error: "Outlet Audit form belum tersedia." },
        { status: 409 },
      );
    }

    const today = businessDate(outlet.timezone || "Asia/Jakarta");

    const { data: assignment, error: assignmentError } = await admin
      .from("outlet_form_assignments")
      .select("id,form_version_id,effective_from,effective_until")
      .eq("outlet_id", outlet.id)
      .eq("form_id", form.id)
      .eq("is_active", true)
      .lte("effective_from", today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignmentError) throw assignmentError;

    let version: { id: string; version_number: number; status: string } | null = null;

    if (assignment?.form_version_id) {
      const result = await admin
        .from("form_versions")
        .select("id,version_number,status")
        .eq("id", assignment.form_version_id)
        .eq("form_id", form.id)
        .maybeSingle();
      if (result.error) throw result.error;
      version = result.data;
    } else {
      const result = await admin
        .from("form_versions")
        .select("id,version_number,status")
        .eq("form_id", form.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      version = result.data;
    }

    if (!version) {
      return NextResponse.json(
        { error: "Outlet Audit version belum tersedia." },
        { status: 409 },
      );
    }

    const { data: session, error: createError } = await admin
      .from("audit_sessions")
      .insert({
        audit_number: makeAuditNumber(outlet.code, today),
        organization_id: profile.organization_id,
        outlet_id: outlet.id,
        form_version_id: version.id,
        audit_date: today,
        status: "draft",
        auditor_user_id: user.id,
        auditor_name_snapshot: profile.full_name || user.email || "Auditor",
        locale_snapshot: outlet.default_locale || "id-ID",
        score: null,
        scoring_snapshot: {},
        pic_snapshot: {},
        metadata: {
          runtime: assignment ? "assigned" : "staging_unassigned",
          form_status: version.status,
          form_version: version.version_number,
        },
      })
      .select("id,audit_number,audit_date,status,form_version_id,started_at,submitted_at,score")
      .single();

    if (createError) {
      if (createError.code === "23505") {
        const { data: concurrentDraft } = await admin
          .from("audit_sessions")
          .select("id,audit_number,audit_date,status,form_version_id,started_at,submitted_at,score")
          .eq("auditor_user_id", user.id)
          .eq("outlet_id", outlet.id)
          .eq("status", "draft")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (concurrentDraft) {
          return NextResponse.json({ session: concurrentDraft, resumed: true });
        }
      }
      throw createError;
    }

    return NextResponse.json({ session, resumed: false });
  } catch (error: any) {
    console.error("Audit session error:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to start audit." },
      { status: 500 },
    );
  }
}
