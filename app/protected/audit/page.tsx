import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OutletAuditRuntime,
  type AuditRuntimeData,
} from "@/components/audit/outlet-audit-runtime";
import {
  getAccessContext,
} from "@/lib/admin/require-admin";
import { getActiveOutlet } from "@/lib/active-outlet";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function businessDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function OutletAuditPage() {
  const {
    user,
    profile,
    isAdmin,
    permissionCodes,
  } =
    await getAccessContext();

  const canSubmitAudit =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit"
    );

  const canViewManagement =
    isAdmin ||
    permissionCodes.includes(
      "audit.view_management"
    );

  // ========================================================
  // AUDIT ENTRY ROUTING
  //
  // Auditor / ORG_ADMIN:
  //   /protected/audit
  //   -> operational Audit Outlet workspace
  //
  // Management / BOD:
  //   /protected/audit
  //   -> read-only Management Audit Dashboard
  //
  // Users with neither capability:
  //   -> protected home
  //
  // A user may have BOTH audit.submit and
  // audit.view_management. In that case Audit Outlet remains
  // the primary /protected/audit destination. Management
  // Dashboard is available through its separate navigation.
  // ========================================================

  if (
    !canSubmitAudit &&
    canViewManagement
  ) {
    redirect(
      "/protected/audit/management"
    );
  }

  if (!canSubmitAudit) {
    redirect("/protected");
  }

  const outlet =
    await getActiveOutlet();

  if (!outlet) {
    redirect("/protected/select-outlet");
  }

  const supabase = await createClient();

  const { data: hasOutletAccess } =
    await supabase.rpc("has_outlet_access", {
      p_outlet_id: outlet.id,
    });

  if (hasOutletAccess !== true) {
    return (
      <StateCard
        title="Outlet Access Required"
        message="Anda tidak memiliki akses audit untuk outlet aktif ini."
        href="/protected/select-outlet"
        action="Change Outlet"
      />
    );
  }

  const admin = createAdminClient();

  const { data: fullOutlet, error: outletError } =
    await admin
      .from("outlets")
      .select("id,code,name,timezone,default_locale,organization_id,is_active")
      .eq("id", outlet.id)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .maybeSingle();

  if (outletError || !fullOutlet) {
    throw outletError || new Error("Active outlet not found.");
  }

  const { data: form, error: formError } =
    await admin
      .from("forms")
      .select("id,code,name,description")
      .eq("organization_id", profile.organization_id)
      .eq("code", "OUTLET_AUDIT")
      .eq("is_active", true)
      .maybeSingle();

  if (formError || !form) {
    return (
      <StateCard
        title="Outlet Audit Not Available"
        message="Form Outlet Audit belum tersedia."
      />
    );
  }

  const { data: draft, error: draftError } =
    await admin
      .from("audit_sessions")
      .select("id,audit_number,audit_date,status,form_version_id,started_at,submitted_at,score,metadata")
      .eq("auditor_user_id", user.id)
      .eq("outlet_id", fullOutlet.id)
      .eq("status", "draft")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (draftError) {
    throw draftError;
  }

  const today = businessDate(fullOutlet.timezone || "Asia/Jakarta");

  const { data: assignment, error: assignmentError } =
    await admin
      .from("outlet_form_assignments")
      .select("id,form_version_id,effective_from,effective_until")
      .eq("outlet_id", fullOutlet.id)
      .eq("form_id", form.id)
      .eq("is_active", true)
      .lte("effective_from", today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!draft && !assignment && !isAdmin) {
    return (
      <StateCard
        title="Audit Not Activated"
        message="Outlet Audit belum diaktifkan untuk outlet ini. Hubungi administrator."
        href="/protected"
        action="Back to Dashboard"
      />
    );
  }

  let versionId =
    draft?.form_version_id ||
    assignment?.form_version_id ||
    null;

  if (!versionId && isAdmin) {
    const { data: latestVersion, error: latestError } =
      await admin
        .from("form_versions")
        .select("id")
        .eq("form_id", form.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    versionId = latestVersion?.id || null;
  }

  if (!versionId) {
    return (
      <StateCard
        title="Audit Version Not Available"
        message="Tidak ada version Outlet Audit yang dapat digunakan."
      />
    );
  }

  const { data: version, error: versionError } =
    await admin
      .from("form_versions")
      .select("id,version_number,status")
      .eq("id", versionId)
      .eq("form_id", form.id)
      .maybeSingle();

  if (versionError || !version) {
    throw versionError || new Error("Audit version not found.");
  }

  const { data: versionSections, error: sectionError } =
    await admin
      .from("form_version_sections")
      .select("id,display_name,description,sort_order")
      .eq("form_version_id", version.id)
      .eq("is_active", true)
      .order("sort_order");

  if (sectionError || !versionSections?.length) {
    throw sectionError || new Error("Audit sections not found.");
  }

  const sectionIds = versionSections.map((row) => row.id);

  const [groupsResult, questionsResult, categoriesResult] =
    await Promise.all([
      admin
        .from("question_groups")
        .select("id,version_section_id,code,name,sort_order")
        .in("version_section_id", sectionIds)
        .eq("is_active", true)
        .order("sort_order"),

      admin
        .from("questions")
        .select("id,version_section_id,question_group_id,code,question_text,sort_order")
        .in("version_section_id", sectionIds)
        .eq("is_active", true)
        .order("sort_order"),

      admin
        .from("audit_finding_categories")
        .select("id,code,name,sort_order")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  if (
    groupsResult.error ||
    questionsResult.error ||
    categoriesResult.error
  ) {
    throw (
      groupsResult.error ||
      questionsResult.error ||
      categoriesResult.error
    );
  }

  let findings: any[] = [];

  if (draft?.id) {
    const { data, error } =
      await admin
        .from("audit_findings")
        .select(`
          id,
          audit_session_id,
          question_id,
          question_code_snapshot,
          question_text_snapshot,
          area_code_snapshot,
          area_name_snapshot,
          finding_category_id,
          finding_category_code_snapshot,
          finding_category_name_snapshot,
          risk_level,
          notes,
          created_at,
          audit_finding_photos (
            id,
            original_filename
          )
        `)
        .eq("audit_session_id", draft.id)
        .order("sort_order");

    if (error) {
      throw error;
    }

    findings = data ?? [];
  }

  const groups = groupsResult.data ?? [];
  const questions = questionsResult.data ?? [];

  const data: AuditRuntimeData = {
    runtimeMode: assignment ? "assigned" : "staging",
    outlet: {
      id: fullOutlet.id,
      code: fullOutlet.code,
      name: fullOutlet.name,
      timezone: fullOutlet.timezone || "Asia/Jakarta",
    },
    auditor: {
      id: user.id,
      name: profile.full_name || user.email || "Auditor",
    },
    version: {
      id: version.id,
      versionNumber: version.version_number,
      status: version.status,
    },
    groups: groups.map((group) => ({
      id: group.id,
      code: group.code,
      name: group.name,
      sortOrder: group.sort_order,
      questions: questions
        .filter((question) => question.question_group_id === group.id)
        .map((question) => ({
          id: question.id,
          code: question.code,
          text: question.question_text,
          sortOrder: question.sort_order,
        })),
    })),
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    })),
    initialSession: draft
      ? {
          id: draft.id,
          auditNumber: draft.audit_number,
          auditDate: draft.audit_date,
          status: draft.status,
          formVersionId: draft.form_version_id,
          startedAt: draft.started_at,
          submittedAt: draft.submitted_at,
          score: draft.score,
        }
      : null,
    initialFindings: findings.map((finding) => {
      const photo = one(finding.audit_finding_photos);

      return {
        id: finding.id,
        sessionId: finding.audit_session_id,
        questionId: finding.question_id,
        questionCode: finding.question_code_snapshot,
        questionText: finding.question_text_snapshot,
        groupCode: finding.area_code_snapshot,
        groupName: finding.area_name_snapshot,
        categoryId: finding.finding_category_id,
        categoryCode: finding.finding_category_code_snapshot,
        categoryName: finding.finding_category_name_snapshot,
        risk: finding.risk_level,
        notes: finding.notes || "",
        createdAt: finding.created_at,
        photo: photo
          ? {
              originalFilename: photo.original_filename || null,
            }
          : null,
      };
    }),
  };

  return <OutletAuditRuntime data={data} />;
}

function StateCard({
  title,
  message,
  href,
  action,
}: {
  title: string;
  message: string;
  href?: string;
  action?: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-950">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
          {message}
        </p>
        {href && action ? (
          <Link
            href={href}
            className="mt-6 inline-flex rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white"
          >
            {action}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
