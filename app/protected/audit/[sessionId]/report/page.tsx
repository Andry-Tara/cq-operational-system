import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function one<T>(
  value:
    | T
    | T[]
    | null
    | undefined,
): T | null {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}

function dateLabel(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

function dateTimeLabel(
  value: string | null,
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function riskClass(
  risk: string,
) {
  if (
    risk === "critical"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    risk === "major"
  ) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (
    risk === "medium"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

export default async function AuditReportPage({
  params,
}: {
  params: Promise<{
    sessionId: string;
  }>;
}) {
  const {
    sessionId,
  } =
    await params;

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

  if (
    !canSubmitAudit &&
    !canViewManagement
  ) {
    redirect("/protected");
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
        audit_number,
        audit_date,
        status,
        outlet_id,
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
      .eq(
        "organization_id",
        profile.organization_id,
      )
      .maybeSingle();

  if (
    sessionError ||
    !session
  ) {
    throw (
      sessionError ||
      new Error(
        "Audit session not found.",
      )
    );
  }

  const isOwner =
    session.auditor_user_id ===
    user.id;

  const managementReadOnly =
    !isAdmin &&
    !isOwner &&
    canViewManagement &&
    session.status ===
      "submitted";

  const canReadSession =
    isAdmin ||
    isOwner ||
    managementReadOnly;

  if (!canReadSession) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-5 py-12">
        <div className="mx-auto max-w-xl rounded-[24px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black">
            Access Denied
          </h1>

          <p className="mt-3 text-sm text-neutral-500">
            Anda tidak memiliki akses ke audit report ini.
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

  if (
    session.status !==
    "submitted"
  ) {
    redirect(
      "/protected/audit",
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
          area_code_snapshot,
          area_name_snapshot,
          finding_category_name_snapshot,
          risk_level,
          notes,
          sort_order,
          audit_finding_photos (
            id,
            original_filename,
            mime_type,
            file_size
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
    outletResult.error
  ) {
    throw outletResult.error;
  }

  if (
    findingsResult.error
  ) {
    throw findingsResult.error;
  }

  const outlet =
    outletResult.data;

  const findings =
    findingsResult.data ??
    [];

  const scoring =
    session.scoring_snapshot &&
    typeof session.scoring_snapshot ===
      "object"
      ? session.scoring_snapshot as any
      : {};

  const hasScoring =
    Number(
      scoring.scoring_version ?? 0,
    ) >= 1;

  const scoreBefore =
    hasScoring
      ? Number(
          scoring.monthly_score_before,
        )
      : null;

  const scoreAfter =
    hasScoring
      ? Number(
          scoring.monthly_score_after ??
            session.score,
        )
      : null;

  const penalty =
    hasScoring
      ? Number(
          scoring.audit_penalty ?? 0,
        )
      : null;

  const counts = {
    minor:
      findings.filter(
        (row) =>
          row.risk_level ===
          "minor",
      ).length,

    medium:
      findings.filter(
        (row) =>
          row.risk_level ===
          "medium",
      ).length,

    major:
      findings.filter(
        (row) =>
          row.risk_level ===
          "major",
      ).length,

    critical:
      findings.filter(
        (row) =>
          row.risk_level ===
          "critical",
      ).length,
  };

  const areaCount =
    new Set(
      findings.map(
        (row) =>
          row.area_code_snapshot,
      ),
    ).size;

  return (
    <main className="min-h-screen bg-[#eeeeec] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/protected/audit/${session.id}`}
            className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 shadow-sm"
          >
            ← Audit Result
          </Link>

          <p className="text-xs font-semibold text-neutral-400">
            Outlet Audit Report
          </p>
        </div>

        <article className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-neutral-200 px-6 py-7 sm:px-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                  Resto Operational System
                </p>

                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Outlet Audit Report
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  {outlet?.name ||
                    "Outlet"}
                </h1>

                <p className="mt-2 text-sm text-neutral-500">
                  {
                    session.audit_number
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 px-5 py-4 text-right">
                <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                  Monthly Score
                </p>

                {hasScoring ? (
                  <p className="mt-1 text-3xl font-black">
                    {scoreAfter}
                    <span className="text-base text-neutral-400">
                      /100
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-black text-neutral-500">
                    Not Scored
                  </p>
                )}
              </div>
            </div>
          </header>

          <section className="grid gap-5 border-b border-neutral-200 px-6 py-6 sm:grid-cols-2 sm:px-9 lg:grid-cols-4">
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
          </section>

          <section className="px-6 py-7 sm:px-9">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Summary
                label="Findings"
                value={
                  findings.length
                }
              />

              <Summary
                label="Areas"
                value={
                  areaCount
                }
              />

              <Summary
                label="Previous"
                value={
                  scoreBefore !== null
                    ? scoreBefore
                    : "—"
                }
              />

              <Summary
                label="Penalty"
                value={hasScoring && penalty !== null ? `-${penalty}` : "—"}
              />

              <Summary
                label="Current"
                value={
                  scoreAfter !== null
                    ? scoreAfter
                    : "—"
                }
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Risk
                label="Minor"
                value={
                  counts.minor
                }
              />

              <Risk
                label="Medium"
                value={
                  counts.medium
                }
                risk="medium"
              />

              <Risk
                label="Major"
                value={
                  counts.major
                }
                risk="major"
              />

              <Risk
                label="Critical"
                value={
                  counts.critical
                }
                risk="critical"
              />
            </div>

            <div className="mt-9">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                Findings
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Audit Findings
              </h2>
            </div>

            {!findings.length ? (
              <div className="mt-5 rounded-[18px] border border-dashed border-neutral-300 p-10 text-center">
                <p className="font-bold">
                  No findings recorded.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {findings.map(
                  (
                    finding,
                    index,
                  ) => {
                    const photo =
                      one(
                        finding.audit_finding_photos,
                      );

                    return (
                      <section
                        key={
                          finding.id
                        }
                        className="break-inside-avoid overflow-hidden rounded-[20px] border border-neutral-200"
                      >
                        <header className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                              Finding{" "}
                              {index +
                                1}{" "}
                              ·{" "}
                              {
                                finding.area_name_snapshot
                              }
                            </p>

                            <h3 className="mt-1 text-lg font-black">
                              {
                                finding.question_text_snapshot
                              }
                            </h3>

                            <p className="mt-1 text-xs text-neutral-400">
                              {
                                finding.question_code_snapshot
                              }
                            </p>
                          </div>

                          <span
                            className={`w-fit rounded-full border px-3 py-1 text-[9px] font-black uppercase ${riskClass(
                              finding.risk_level,
                            )}`}
                          >
                            {
                              finding.risk_level
                            }
                          </span>
                        </header>

                        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_.9fr]">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                              Category
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {
                                finding.finding_category_name_snapshot
                              }
                            </p>

                            <p className="mt-5 text-[9px] font-black uppercase tracking-wide text-neutral-400">
                              Notes
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                              {finding.notes ||
                                "No notes"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                              Evidence
                            </p>

                            {photo ? (
                              <>
                                <a
                                  href={`/api/audit/evidence/${photo.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 block overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
                                >
                                  <img
                                    src={`/api/audit/evidence/${photo.id}`}
                                    alt={
                                      photo.original_filename ||
                                      "Audit evidence"
                                    }
                                    loading="lazy"
                                    className="aspect-[4/3] w-full object-cover"
                                  />
                                </a>

                                <p className="mt-2 break-all text-xs text-neutral-500">
                                  {
                                    photo.original_filename
                                  }
                                </p>
                              </>
                            ) : (
                              <div className="mt-2 rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-400">
                                No photo attached
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            )}
          </section>
        </article>
      </div>
    </main>
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
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold">
        {value}
      </p>
    </div>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function Risk({
  label,
  value,
  risk = "minor",
}: {
  label: string;
  value: number;
  risk?:
    | "minor"
    | "medium"
    | "major"
    | "critical";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${riskClass(
        risk,
      )}`}
    >
      <p className="text-[9px] font-black uppercase tracking-wide">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}
