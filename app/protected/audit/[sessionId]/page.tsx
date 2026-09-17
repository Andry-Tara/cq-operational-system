import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function one<T>(
  value: T | T[] | null | undefined,
): T | null {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function dateTimeLabel(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function riskClass(risk: string) {
  if (risk === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (risk === "major") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (risk === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

export default async function AuditResultPage({
  params,
}: {
  params: Promise<{
    sessionId: string;
  }>;
}) {
  const { sessionId } = await params;

  const {
    user,
    profile,
    isAdmin,
  } = await requirePermission("audit.submit");

  const admin = createAdminClient();

  const {
    data: session,
    error: sessionError,
  } = await admin
    .from("audit_sessions")
    .select(`
      id,
      audit_number,
      audit_date,
      status,
      outlet_id,
      auditor_user_id,
      auditor_name_snapshot,
      started_at,
      submitted_at,
      score
    `)
    .eq("id", sessionId)
    .eq(
      "organization_id",
      profile.organization_id,
    )
    .maybeSingle();

  if (sessionError || !session) {
    return (
      <StateCard
        title="Audit Not Found"
        message="Audit session tidak ditemukan."
      />
    );
  }

  if (
    !isAdmin &&
    session.auditor_user_id !== user.id
  ) {
    return (
      <StateCard
        title="Access Denied"
        message="Audit session ini bukan milik user tersebut."
      />
    );
  }

  if (session.status === "draft") {
    redirect("/protected/audit");
  }

  const [
    outletResult,
    findingsResult,
  ] = await Promise.all([
    admin
      .from("outlets")
      .select("id,code,name")
      .eq("id", session.outlet_id)
      .maybeSingle(),

    admin
      .from("audit_findings")
      .select(`
        id,
        question_code_snapshot,
        question_text_snapshot,
        area_code_snapshot,
        area_name_snapshot,
        finding_category_name_snapshot,
        risk_level,
        notes,
        created_at,
        audit_finding_photos (
          id,
          original_filename
        )
      `)
      .eq(
        "audit_session_id",
        session.id,
      )
      .order("sort_order"),
  ]);

  if (outletResult.error) {
    throw outletResult.error;
  }

  if (findingsResult.error) {
    throw findingsResult.error;
  }

  const outlet = outletResult.data;
  const findings = findingsResult.data ?? [];

  const risks = {
    minor: findings.filter(
      (row) => row.risk_level === "minor",
    ).length,
    medium: findings.filter(
      (row) => row.risk_level === "medium",
    ).length,
    major: findings.filter(
      (row) => row.risk_level === "major",
    ).length,
    critical: findings.filter(
      (row) => row.risk_level === "critical",
    ).length,
  };

  const areaCount = new Set(
    findings.map(
      (row) =>
        row.area_code_snapshot ||
        row.area_name_snapshot,
    ),
  ).size;

  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-7 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  ✓ Audit Submitted
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  {outlet?.name || "Outlet Audit"}
                </h1>

                <p className="mt-2 text-sm text-neutral-500">
                  {session.audit_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Summary
                  label="Findings"
                  value={findings.length}
                />
                <Summary
                  label="Areas"
                  value={areaCount}
                />
                <div className="col-span-2 sm:col-span-1">
                  <Summary
                    label="Status"
                    value="Done"
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-4 border-b border-neutral-100 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <Info
              label="Audit Date"
              value={dateLabel(
                session.audit_date,
              )}
            />
            <Info
              label="Auditor"
              value={
                session.auditor_name_snapshot ||
                "Auditor"
              }
            />
            <Info
              label="Started"
              value={dateTimeLabel(
                session.started_at,
              )}
            />
            <Info
              label="Submitted"
              value={dateTimeLabel(
                session.submitted_at,
              )}
            />
          </div>

          <div className="px-5 py-6 sm:px-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <RiskMetric
                label="Minor"
                value={risks.minor}
              />
              <RiskMetric
                label="Medium"
                value={risks.medium}
                tone="medium"
              />
              <RiskMetric
                label="Major"
                value={risks.major}
                tone="major"
              />
              <RiskMetric
                label="Critical"
                value={risks.critical}
                tone="critical"
              />
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Findings
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Audit Summary
                </h2>
              </div>
            </div>

            {!findings.length ? (
              <div className="mt-5 rounded-[20px] border border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
                <p className="font-bold">
                  No findings recorded.
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Audit was submitted without findings.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {findings.map((finding) => {
                  const photo = one(
                    finding.audit_finding_photos,
                  );

                  return (
                    <article
                      key={finding.id}
                      className="rounded-[20px] border border-neutral-200 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                            {finding.area_name_snapshot}
                          </p>

                          <h3 className="mt-1 font-black">
                            {finding.question_text_snapshot}
                          </h3>

                          <p className="mt-1 text-xs text-neutral-400">
                            {finding.question_code_snapshot}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wide ${riskClass(
                            finding.risk_level,
                          )}`}
                        >
                          {finding.risk_level}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-neutral-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                            Category
                          </p>
                          <p className="mt-1 text-sm font-bold">
                            {finding.finding_category_name_snapshot}
                          </p>
                        </div>

                        <div className="rounded-xl bg-neutral-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                            Evidence
                          </p>
                          <p className="mt-1 text-sm font-bold">
                            {photo
                              ? photo.original_filename ||
                                "Photo attached"
                              : "No photo"}
                          </p>
                        </div>
                      </div>

                      {finding.notes && (
                        <div className="mt-3 rounded-xl bg-neutral-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                            Notes
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                            {finding.notes}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:justify-between">
              <Link
                href="/protected"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
              >
                ← Back to Dashboard
              </Link>

              <Link
                href="/protected/audit"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-red-700 px-6 text-sm font-bold text-white transition hover:bg-red-800"
              >
                New Audit
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-[110px] rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center">
      <p className="text-xl font-black">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">
        {value}
      </p>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "medium" | "major" | "critical";
}) {
  const className =
    tone === "critical"
      ? "border-red-200 bg-red-50"
      : tone === "major"
        ? "border-orange-200 bg-orange-50"
        : tone === "medium"
          ? "border-amber-200 bg-amber-50"
          : "border-neutral-200 bg-neutral-50";

  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
    >
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function StateCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f5f5f3] px-5 py-12">
      <div className="mx-auto max-w-xl rounded-[24px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black">
          {title}
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          {message}
        </p>
        <Link
          href="/protected"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
