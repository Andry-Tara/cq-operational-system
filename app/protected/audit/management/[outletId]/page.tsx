import Link from "next/link";

import {
  requirePermission,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

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

  return new Date(
    Date.UTC(
      year,
      month - 1 + amount,
      1
    )
  )
    .toISOString()
    .slice(0, 10);
}

function businessDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Jakarta",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit",
    }
  ).format(new Date());
}

function requestedMonthStart(
  value: unknown,
  fallback: string
) {
  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}$/.test(
      value
    )
  ) {
    return `${value}-01`;
  }

  return fallback;
}

function monthLabel(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "long",
      year:
        "numeric",
    }
  ).format(
    new Date(
      `${value}T12:00:00Z`
    )
  );
}

function shortMonthLabel(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      year:
        "2-digit",
    }
  ).format(
    new Date(
      `${value}T12:00:00Z`
    )
  );
}

function dateLabel(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
    }
  ).format(
    new Date(
      `${value}T12:00:00`
    )
  );
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits:
        1,
    }
  ).format(value);
}

function scoreFromSnapshot(
  session: any
) {
  const snapshot =
    session
      ?.scoring_snapshot &&
    typeof session
      .scoring_snapshot ===
      "object"
      ? session
          .scoring_snapshot
      : {};

  const hasScoring =
    Number(
      snapshot
        .scoring_version ??
        0
    ) >= 1;

  return {
    hasScoring,

    score:
      hasScoring
        ? Number(
            snapshot
              .monthly_score_after ??
              session.score
          )
        : null,

    penalty:
      hasScoring
        ? Number(
            snapshot
              .audit_penalty ??
              0
          )
        : null,
  };
}

export default async function
ManagementOutletAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{
    outletId: string;
  }>;

  searchParams?: Promise<{
    month?: string;
  }>;
}) {
  const {
    outletId,
  } =
    await params;

  const queryParams =
    searchParams
      ? await searchParams
      : {};

  const context =
    await requirePermission(
      "audit.view_management"
    );

  const organizationId =
    context.profile
      .organization_id;

  const admin =
    createAdminClient();

  const today =
    businessDate();

  const currentMonth =
    `${today.slice(0, 7)}-01`;

  const requestedMonth =
    requestedMonthStart(
      queryParams?.month,
      currentMonth
    );

  const selectedMonth =
    requestedMonth >
    currentMonth
      ? currentMonth
      : requestedMonth;

  const endMonth =
    shiftMonth(
      selectedMonth,
      1
    );

  const previousMonth =
    shiftMonth(
      selectedMonth,
      -1
    );

  const trendStart =
    shiftMonth(
      selectedMonth,
      -5
    );

  const [
    outletResult,
    formResult,
  ] =
    await Promise.all([
      admin
        .from("outlets")
        .select(`
          id,
          code,
          name,
          is_active
        `)
        .eq(
          "id",
          outletId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),

      admin
        .from("forms")
        .select("id")
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
        .maybeSingle(),
    ]);

  if (
    outletResult.error
  ) {
    throw outletResult.error;
  }

  if (
    formResult.error
  ) {
    throw formResult.error;
  }

  const outlet =
    outletResult.data;

  const form =
    formResult.data;

  if (
    !outlet ||
    !form
  ) {
    return (
      <StateCard
        title="Audit Outlet Not Found"
        message="Outlet tidak tersedia untuk Management Audit Dashboard."
      />
    );
  }

  const {
    data:
      assignment,
    error:
      assignmentError,
  } =
    await admin
      .from(
        "outlet_form_assignments"
      )
      .select("id")
      .eq(
        "outlet_id",
        outlet.id
      )
      .eq(
        "form_id",
        form.id
      )
      .eq(
        "is_active",
        true
      )
      .limit(1)
      .maybeSingle();

  if (
    assignmentError
  ) {
    throw assignmentError;
  }

  if (!assignment) {
    return (
      <StateCard
        title="Audit Outlet Not Found"
        message="Outlet ini tidak memiliki active Outlet Audit assignment."
      />
    );
  }

  // ==========================================================
  // SIX-MONTH TREND
  // ==========================================================

  const {
    data:
      scoreRows,
    error:
      scoreError,
  } =
    await admin
      .from(
        "outlet_monthly_scores"
      )
      .select(`
        month_start,
        current_score,
        total_penalty,
        submitted_audit_count
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "outlet_id",
        outlet.id
      )
      .gte(
        "month_start",
        trendStart
      )
      .lt(
        "month_start",
        endMonth
      )
      .order(
        "month_start",
        {
          ascending:
            true,
        }
      );

  if (scoreError) {
    throw scoreError;
  }

  const scoreByMonth =
    new Map<
      string,
      any
    >(
      (
        scoreRows ?? []
      ).map(
        (row: any) => [
          String(
            row.month_start
          ),
          row,
        ]
      )
    );

  const trend =
    Array.from(
      {
        length: 6,
      },
      (
        _,
        index
      ) => {
        const month =
          shiftMonth(
            trendStart,
            index
          );

        const row =
          scoreByMonth.get(
            month
          );

        return {
          month,

          score:
            row
              ? Number(
                  row
                    .current_score
                )
              : null,

          penalty:
            row
              ? Number(
                  row
                    .total_penalty
                )
              : null,

          audits:
            row
              ? Number(
                  row
                    .submitted_audit_count
                )
              : 0,
        };
      }
    );

  const currentScoreRow =
    scoreByMonth.get(
      selectedMonth
    );

  const previousScoreRow =
    scoreByMonth.get(
      previousMonth
    );

  const currentScore =
    currentScoreRow
      ? Number(
          currentScoreRow
            .current_score
        )
      : null;

  const previousScore =
    previousScoreRow
      ? Number(
          previousScoreRow
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

  // ==========================================================
  // SELECTED MONTH AUDIT HISTORY
  // ==========================================================

  const {
    data:
      sessions,
    error:
      sessionError,
  } =
    await admin
      .from(
        "audit_sessions"
      )
      .select(`
        id,
        audit_number,
        audit_date,
        auditor_name_snapshot,
        submitted_at,
        score,
        scoring_snapshot
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "outlet_id",
        outlet.id
      )
      .eq(
        "status",
        "submitted"
      )
      .gte(
        "audit_date",
        selectedMonth
      )
      .lt(
        "audit_date",
        endMonth
      )
      .order(
        "submitted_at",
        {
          ascending:
            false,
        }
      );

  if (
    sessionError
  ) {
    throw sessionError;
  }

  const sessionRows =
    sessions ?? [];

  const sessionIds =
    sessionRows.map(
      (session: any) =>
        session.id
    );

  const findingCount =
    new Map<
      string,
      number
    >();

  let monthFindings =
    0;

  let criticalFindings =
    0;

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
      const sessionId =
        String(
          finding
            .audit_session_id
        );

      monthFindings +=
        1;

      findingCount.set(
        sessionId,
        (
          findingCount.get(
            sessionId
          ) ?? 0
        ) + 1
      );

      if (
        String(
          finding.risk_level
        ).toLowerCase() ===
        "critical"
      ) {
        criticalFindings +=
          1;
      }
    }
  }

  const monthQuery =
    selectedMonth.slice(
      0,
      7
    );

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-5 md:px-8 md:py-8">
      <div className="mb-4">
        <Link
          href={`/protected/audit/management?month=${monthQuery}`}
          className="text-xs font-black text-neutral-500 hover:text-red-700"
        >
          ← Management Audit Dashboard
        </Link>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-6 md:px-8 md:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
            Management Audit · Read Only
          </p>

          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-neutral-950">
                {
                  outlet.name
                }
              </h1>

              <p className="mt-1 text-sm font-bold text-neutral-400">
                {
                  outlet.code
                }
                {" · "}
                {monthLabel(
                  selectedMonth
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-950 px-5 py-3 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                Monthly Score
              </p>

              <p className="mt-1 text-3xl font-black">
                {currentScore ===
                null
                  ? "N/A"
                  : formatNumber(
                      currentScore
                    )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 md:p-8">
          <Summary
            label="Score"
            value={
              currentScore ===
              null
                ? "N/A"
                : formatNumber(
                    currentScore
                  )
            }
          />

          <Summary
            label="vs Previous"
            value={
              scoreChange ===
              null
                ? "—"
                : `${
                    scoreChange >
                    0
                      ? "+"
                      : ""
                  }${formatNumber(
                    scoreChange
                  )}`
            }
          />

          <Summary
            label="Audits"
            value={
              sessionRows.length
            }
          />

          <Summary
            label="Findings"
            value={
              monthFindings
            }
          />

          <Summary
            label="Critical"
            value={
              criticalFindings
            }
          />
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
        <div>
          <h2 className="text-xl font-black text-neutral-950">
            Score Trend
          </h2>

          <p className="mt-1 text-xs text-neutral-500">
            Last 6 months ending in {monthLabel(
              selectedMonth
            )}.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-6">
          {trend.map(
            (item) => (
              <div
                key={
                  item.month
                }
                className={
                  item.month ===
                  selectedMonth
                    ? "rounded-2xl border border-neutral-900 bg-neutral-950 p-4 text-white"
                    : "rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                }
              >
                <p
                  className={
                    item.month ===
                    selectedMonth
                      ? "text-[9px] font-black uppercase tracking-wide text-neutral-400"
                      : "text-[9px] font-black uppercase tracking-wide text-neutral-400"
                  }
                >
                  {shortMonthLabel(
                    item.month
                  )}
                </p>

                <p className="mt-3 text-2xl font-black">
                  {item.score ===
                  null
                    ? "N/A"
                    : formatNumber(
                        item.score
                      )}
                </p>

                <p
                  className={
                    item.month ===
                    selectedMonth
                      ? "mt-1 text-[10px] font-bold text-neutral-400"
                      : "mt-1 text-[10px] font-bold text-neutral-400"
                  }
                >
                  {item.audits} audit
                  {item.audits ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            )
          )}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-5 md:px-8">
          <h2 className="text-xl font-black text-neutral-950">
            Audit History
          </h2>

          <p className="mt-1 text-xs text-neutral-500">
            Submitted audits for {monthLabel(
              selectedMonth
            )}.
          </p>
        </div>

        <div className="divide-y divide-neutral-100">
          {sessionRows.map(
            (
              session: any
            ) => {
              const scoring =
                scoreFromSnapshot(
                  session
                );

              return (
                <article
                  key={
                    session.id
                  }
                  className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto_auto_auto] md:items-center md:px-8"
                >
                  <div>
                    <p className="font-black text-neutral-900">
                      {
                        session
                          .audit_number
                      }
                    </p>

                    <p className="mt-1 text-xs font-semibold text-neutral-400">
                      {dateLabel(
                        session.audit_date
                      )}
                      {" · "}
                      {
                        session
                          .auditor_name_snapshot
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                      Findings
                    </p>

                    <p className="mt-1 font-black text-neutral-800">
                      {
                        findingCount.get(
                          String(
                            session.id
                          )
                        ) ?? 0
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                      Penalty
                    </p>

                    <p className="mt-1 font-black text-red-700">
                      {scoring.penalty ===
                      null
                        ? "—"
                        : `-${formatNumber(
                            scoring.penalty
                          )}`}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                      Score After
                    </p>

                    <p className="mt-1 font-black text-neutral-900">
                      {scoring.score ===
                      null
                        ? "Not Scored"
                        : formatNumber(
                            scoring.score
                          )}
                    </p>
                  </div>
                </article>
              );
            }
          )}

          {!sessionRows.length && (
            <div className="px-8 py-14 text-center text-sm font-semibold text-neutral-400">
              No submitted audits for this month.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value:
    string |
    number;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-5 py-4">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-neutral-950">
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
    <main className="mx-auto max-w-xl px-5 py-16">
      <section className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-neutral-950">
          {title}
        </h1>

        <p className="mt-3 text-sm text-neutral-500">
          {message}
        </p>

        <Link
          href="/protected/audit/management"
          className="mt-6 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-xs font-black text-white"
        >
          Back to Dashboard
        </Link>
      </section>
    </main>
  );
}
