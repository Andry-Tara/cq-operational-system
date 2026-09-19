import Link from "next/link";

import {
  requirePermission,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

function one(
  value: any
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function businessDate(
  timezone = "Asia/Jakarta"
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );
}

function shiftMonth(
  monthStart: string,
  amount: number
) {
  const [
    year,
    month,
  ] =
    monthStart
      .slice(0, 7)
      .split("-")
      .map(Number);

  const value =
    new Date(
      Date.UTC(
        year,
        month - 1 + amount,
        1
      )
    );

  return value
    .toISOString()
    .slice(0, 10);
}

function monthLabel(
  monthStart: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }
  ).format(
    new Date(
      `${monthStart}T12:00:00+07:00`
    )
  );
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 1,
    }
  ).format(value);
}

function formatChange(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  if (value > 0) {
    return `+${formatNumber(
      value
    )}`;
  }

  return formatNumber(value);
}

function requestedMonthStart(
  value: unknown,
  fallback: string
) {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}$/.test(
      value
    )
  ) {
    return `${value}-01`;
  }

  return fallback;
}

type SeverityCount = {
  minor: number;
  medium: number;
  major: number;
  critical: number;
};

function emptySeverity():
  SeverityCount {
  return {
    minor: 0,
    medium: 0,
    major: 0,
    critical: 0,
  };
}

export default async function
ManagementAuditDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    month?: string;
  }>;
}) {
  const context =
    await requirePermission(
      "audit.view_management"
    );

  const organizationId =
    context.profile
      .organization_id;

  const admin =
    createAdminClient();

  const params =
    searchParams
      ? await searchParams
      : {};

  const today =
    businessDate();

  const currentMonthStart =
    `${today.slice(0, 7)}-01`;

  const requestedMonth =
    requestedMonthStart(
      params?.month,
      currentMonthStart
    );

  // Do not allow navigation into future months.
  const monthStart =
    requestedMonth >
    currentMonthStart
      ? currentMonthStart
      : requestedMonth;

  const previousMonth =
    shiftMonth(
      monthStart,
      -1
    );

  const nextMonth =
    shiftMonth(
      monthStart,
      1
    );

  const canGoNext =
    nextMonth <=
    currentMonthStart;

  // ==========================================================
  // OUTLET_AUDIT FORM
  // ==========================================================

  const {
    data: form,
    error: formError,
  } =
    await admin
      .from("forms")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "code",
        "OUTLET_AUDIT"
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

  if (
    formError ||
    !form
  ) {
    throw (
      formError ??
      new Error(
        "Active OUTLET_AUDIT form not found."
      )
    );
  }

  // ==========================================================
  // AUDIT-ENABLED OUTLETS
  // ==========================================================

  const {
    data:
      assignmentRows,
    error:
      assignmentError,
  } =
    await admin
      .from(
        "outlet_form_assignments"
      )
      .select(`
        outlet_id,
        outlets (
          id,
          code,
          name,
          is_active
        )
      `)
      .eq(
        "form_id",
        form.id
      )
      .eq(
        "is_active",
        true
      );

  if (assignmentError) {
    throw assignmentError;
  }

  const outletMap =
    new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
      }
    >();

  for (
    const assignment
    of assignmentRows ?? []
  ) {
    const outlet =
      one(
        assignment.outlets
      );

    if (
      !outlet ||
      outlet.is_active ===
        false
    ) {
      continue;
    }

    outletMap.set(
      String(outlet.id),
      {
        id:
          String(outlet.id),

        code:
          String(
            outlet.code ||
              ""
          ),

        name:
          String(
            outlet.name ||
              outlet.code ||
              "Outlet"
          ),
      }
    );
  }

  const outlets =
    Array.from(
      outletMap.values()
    ).sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );

  const outletIds =
    outlets.map(
      (outlet) =>
        outlet.id
    );

  // ==========================================================
  // CURRENT + PREVIOUS MONTH SCORE
  // ==========================================================

  let monthlyScores:
    any[] = [];

  if (
    outletIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "outlet_monthly_scores"
        )
        .select(`
          outlet_id,
          month_start,
          base_score,
          total_penalty,
          current_score,
          submitted_audit_count
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "month_start",
          [
            previousMonth,
            monthStart,
          ]
        )
        .in(
          "outlet_id",
          outletIds
        );

    if (error) {
      throw error;
    }

    monthlyScores =
      data ?? [];
  }

  const monthlyByKey =
    new Map<
      string,
      any
    >();

  for (
    const score
    of monthlyScores
  ) {
    monthlyByKey.set(
      `${score.outlet_id}|${score.month_start}`,
      score
    );
  }

  // ==========================================================
  // SUBMITTED AUDITS — SELECTED MONTH
  // ==========================================================

  let sessions:
    any[] = [];

  if (
    outletIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "audit_sessions"
        )
        .select(`
          id,
          outlet_id,
          audit_date,
          status,
          submitted_at,
          score,
          scoring_snapshot
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "status",
          "submitted"
        )
        .gte(
          "audit_date",
          monthStart
        )
        .lt(
          "audit_date",
          nextMonth
        )
        .in(
          "outlet_id",
          outletIds
        )
        .order(
          "submitted_at",
          {
            ascending:
              true,
          }
        );

    if (error) {
      throw error;
    }

    sessions =
      data ?? [];
  }

  const sessionOutletById =
    new Map<
      string,
      string
    >();

  const auditCountByOutlet =
    new Map<
      string,
      number
    >();

  for (
    const session
    of sessions
  ) {
    const sessionId =
      String(session.id);

    const outletId =
      String(
        session.outlet_id
      );

    sessionOutletById.set(
      sessionId,
      outletId
    );

    auditCountByOutlet.set(
      outletId,
      (
        auditCountByOutlet
          .get(
            outletId
          ) ?? 0
      ) + 1
    );
  }

  // ==========================================================
  // FINDINGS + SEVERITY
  // ==========================================================

  const findingCountByOutlet =
    new Map<
      string,
      number
    >();

  const severityByOutlet =
    new Map<
      string,
      SeverityCount
    >();

  let totalFindings =
    0;

  let totalCritical =
    0;

  const sessionIds =
    sessions.map(
      (session: any) =>
        session.id
    );

  if (
    sessionIds.length
  ) {
    const {
      data:
        findingRows,
      error:
        findingError,
    } =
      await admin
        .from(
          "audit_findings"
        )
        .select(`
          audit_session_id,
          risk_level
        `)
        .in(
          "audit_session_id",
          sessionIds
        );

    if (
      findingError
    ) {
      throw findingError;
    }

    for (
      const finding
      of findingRows ?? []
    ) {
      const outletId =
        sessionOutletById.get(
          String(
            finding
              .audit_session_id
          )
        );

      if (!outletId) {
        continue;
      }

      totalFindings +=
        1;

      findingCountByOutlet.set(
        outletId,
        (
          findingCountByOutlet
            .get(
              outletId
            ) ?? 0
        ) + 1
      );

      const severity =
        severityByOutlet.get(
          outletId
        ) ??
        emptySeverity();

      const risk =
        String(
          finding.risk_level ||
            ""
        )
          .trim()
          .toLowerCase();

      if (
        risk === "minor" ||
        risk === "medium" ||
        risk === "major" ||
        risk === "critical"
      ) {
        severity[
          risk
        ] += 1;

        if (
          risk ===
          "critical"
        ) {
          totalCritical +=
            1;
        }
      }

      severityByOutlet.set(
        outletId,
        severity
      );
    }
  }

  // ==========================================================
  // PRESENTATION
  // ==========================================================

  const rows =
    outlets.map(
      (outlet) => {
        const current =
          monthlyByKey.get(
            `${outlet.id}|${monthStart}`
          );

        const previous =
          monthlyByKey.get(
            `${outlet.id}|${previousMonth}`
          );

        const currentScore =
          current
            ? Number(
                current
                  .current_score
              )
            : null;

        const previousScore =
          previous
            ? Number(
                previous
                  .current_score
              )
            : null;

        const scoreChange =
          currentScore !==
            null &&
          previousScore !==
            null
            ? currentScore -
              previousScore
            : null;

        const severity =
          severityByOutlet.get(
            outlet.id
          ) ??
          emptySeverity();

        return {
          ...outlet,

          score:
            currentScore,

          previousScore,

          scoreChange,

          penalty:
            current
              ? Number(
                  current
                    .total_penalty
                )
              : null,

          auditCount:
            auditCountByOutlet.get(
              outlet.id
            ) ?? 0,

          findingCount:
            findingCountByOutlet.get(
              outlet.id
            ) ?? 0,

          severity,
        };
      }
    );

  const scoredRows =
    rows.filter(
      (row) =>
        row.score !==
        null
    );

  const averageScore =
    scoredRows.length
      ? scoredRows.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.score
            ),
          0
        ) /
        scoredRows.length
      : null;

  const monthQuery =
    monthStart.slice(
      0,
      7
    );

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-5 md:px-8 md:py-8">
      <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-6 md:px-8 md:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
            Outlet Audit
          </p>

          <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-neutral-950 md:text-4xl">
                Management Audit Dashboard
              </h1>

              <p className="mt-2 text-sm font-medium text-neutral-500">
                Submitted audits only
                {" · "}
                Read Only
              </p>
            </div>

            <div className="flex items-center gap-2">

              <Link
                href="/protected/exceptions"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8D355] bg-[#F8F7DF] px-3 text-xs font-black text-[#5C5908] transition hover:bg-[#D8D355]"
              >
                Exception Center →
              </Link>

              <Link
                href={`/protected/audit/management?month=${previousMonth.slice(
                  0,
                  7
                )}`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-neutral-600 transition hover:bg-neutral-50"
              >
                ←
              </Link>

              <div className="min-w-[170px] rounded-xl bg-neutral-100 px-4 py-2.5 text-center">
                <p className="text-xs font-black text-neutral-800">
                  {monthLabel(
                    monthStart
                  )}
                </p>
              </div>

              {canGoNext ? (
                <Link
                  href={`/protected/audit/management?month=${nextMonth.slice(
                    0,
                    7
                  )}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-neutral-600 transition hover:bg-neutral-50"
                >
                  →
                </Link>
              ) : (
                <span className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 px-3 text-sm font-black text-neutral-300">
                  →
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 md:p-8">
          {[
            {
              label:
                "Audit Outlets",
              value:
                outlets.length,
            },
            {
              label:
                "Scored Outlets",
              value:
                `${scoredRows.length}/${outlets.length}`,
            },
            {
              label:
                "Average Score",
              value:
                averageScore ===
                null
                  ? "N/A"
                  : formatNumber(
                      averageScore
                    ),
            },
            {
              label:
                "Submitted Audits",
              value:
                sessions.length,
            },
            {
              label:
                "Critical Findings",
              value:
                totalCritical,
            },
          ].map(
            (card) => (
              <div
                key={
                  card.label
                }
                className="rounded-2xl bg-neutral-50 px-5 py-4"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
                  {
                    card.label
                  }
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-neutral-950">
                  {
                    card.value
                  }
                </p>
              </div>
            )
          )}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="text-xl font-black text-neutral-950">
              Monthly Outlet Score
            </h2>

            <p className="mt-1 text-xs text-neutral-500">
              Change compares the selected month with the previous scored month.
              N/A means no scored audit exists for the selected month.
            </p>
          </div>

          <p className="text-xs font-bold text-neutral-400">
            Findings:{" "}
            <span className="text-neutral-800">
              {
                totalFindings
              }
            </span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left">
                {[
                  "Outlet",
                  "Score",
                  "Change",
                  "Audits",
                  "Penalty",
                  "Findings",
                  "Minor",
                  "Medium",
                  "Major",
                  "Critical",
                ].map(
                  (heading) => (
                    <th
                      key={
                        heading
                      }
                      className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400 first:pl-8 last:pr-8"
                    >
                      {
                        heading
                      }
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => (
                  <tr
                    key={
                      row.id
                    }
                    className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="px-5 py-4 pl-8">
                      <Link
                        href={`/protected/audit/management/${row.id}?month=${monthQuery}`}
                        className="group inline-block"
                      >
                        <p className="font-black text-neutral-900 group-hover:text-red-700">
                          {
                            row.name
                          }
                        </p>

                        <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                          {
                            row.code
                          }
                          {" · "}
                          View trend →
                        </p>
                      </Link>
                    </td>

                    <td className="px-5 py-4">
                      {row.score ===
                      null ? (
                        <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-500">
                          N/A
                        </span>
                      ) : (
                        <span className="text-xl font-black text-neutral-950">
                          {formatNumber(
                            row.score
                          )}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          row.scoreChange ===
                          null
                            ? "font-bold text-neutral-400"
                            : row.scoreChange <
                                0
                              ? "font-black text-red-700"
                              : row.scoreChange >
                                  0
                                ? "font-black text-emerald-700"
                                : "font-black text-neutral-600"
                        }
                      >
                        {formatChange(
                          row.scoreChange
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-bold text-neutral-700">
                      {
                        row.auditCount
                      }
                    </td>

                    <td className="px-5 py-4 font-bold text-neutral-700">
                      {row.penalty ===
                      null
                        ? "—"
                        : `-${formatNumber(
                            row.penalty
                          )}`}
                    </td>

                    <td className="px-5 py-4 font-black text-neutral-900">
                      {
                        row.findingCount
                      }
                    </td>

                    <td className="px-5 py-4 font-bold text-neutral-600">
                      {
                        row
                          .severity
                          .minor
                      }
                    </td>

                    <td className="px-5 py-4 font-bold text-neutral-600">
                      {
                        row
                          .severity
                          .medium
                      }
                    </td>

                    <td className="px-5 py-4 font-bold text-neutral-700">
                      {
                        row
                          .severity
                          .major
                      }
                    </td>

                    <td className="px-5 py-4 pr-8">
                      <span
                        className={
                          row
                            .severity
                            .critical >
                          0
                            ? "font-black text-red-700"
                            : "font-bold text-neutral-500"
                        }
                      >
                        {
                          row
                            .severity
                            .critical
                        }
                      </span>
                    </td>
                  </tr>
                )
              )}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={
                      10
                    }
                    className="px-8 py-14 text-center text-sm font-semibold text-neutral-400"
                  >
                    No active Outlet Audit assignments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
