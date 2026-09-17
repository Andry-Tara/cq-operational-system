import Link from "next/link";

import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function monthStart(value?: string) {
  if (
    value &&
    /^\d{4}-\d{2}$/.test(value)
  ) {
    return `${value}-01`;
  }

  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    },
  ).formatToParts(new Date());

  const year =
    parts.find(
      (part) => part.type === "year",
    )?.value ?? "";

  const month =
    parts.find(
      (part) => part.type === "month",
    )?.value ?? "";

  return `${year}-${month}-01`;
}

function nextMonth(value: string) {
  const date =
    new Date(
      `${value}T12:00:00Z`,
    );

  date.setUTCMonth(
    date.getUTCMonth() + 1,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "long",
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

function timeLabel(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function one<T>(
  value: T | T[] | null | undefined,
): T | null {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}

export default async function AuditHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    outlet?: string;
    month?: string;
  }>;
}) {
  const params =
    searchParams
      ? await searchParams
      : {};

  const {
    user,
    profile,
    isAdmin,
  } =
    await requirePermission(
      "audit.submit",
    );

  const selectedMonth =
    monthStart(
      params?.month,
    );

  const endMonth =
    nextMonth(
      selectedMonth,
    );

  const supabase =
    await createClient();

  let outlets: any[] = [];

  if (isAdmin) {
    const {
      data,
      error,
    } =
      await supabase
        .from("outlets")
        .select(
          "id,code,name,is_active",
        )
        .eq(
          "organization_id",
          profile.organization_id,
        )
        .eq(
          "is_active",
          true,
        )
        .order("name");

    if (error) throw error;

    outlets =
      data ?? [];
  } else {
    const {
      data,
      error,
    } =
      await supabase
        .from("user_outlets")
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
          "user_id",
          user.id,
        )
        .eq(
          "is_active",
          true,
        );

    if (error) throw error;

    outlets =
      (data ?? [])
        .map(
          (row: any) =>
            one(
              row.outlets,
            ),
        )
        .filter(
          (outlet: any) =>
            outlet &&
            outlet.is_active !== false,
        )
        .sort(
          (a: any, b: any) =>
            String(
              a.name,
            ).localeCompare(
              String(
                b.name,
              ),
            ),
        );
  }

  const allowedOutletIds =
    outlets.map(
      (outlet: any) =>
        outlet.id,
    );

  const requestedOutlet =
    typeof params?.outlet ===
    "string"
      ? params.outlet
      : "";

  const selectedOutletId =
    requestedOutlet &&
    allowedOutletIds.includes(
      requestedOutlet,
    )
      ? requestedOutlet
      : null;

  const admin =
    createAdminClient();

  let sessions: any[] = [];

  if (allowedOutletIds.length) {
    let query =
      admin
        .from("audit_sessions")
        .select(`
          id,
          audit_number,
          audit_date,
          outlet_id,
          auditor_name_snapshot,
          started_at,
          submitted_at,
          score,
          scoring_snapshot
        `)
        .eq(
          "organization_id",
          profile.organization_id,
        )
        .eq(
          "status",
          "submitted",
        )
        .gte(
          "audit_date",
          selectedMonth,
        )
        .lt(
          "audit_date",
          endMonth,
        )
        .in(
          "outlet_id",
          allowedOutletIds,
        )
        .order(
          "submitted_at",
          {
            ascending: false,
          },
        );

    if (!isAdmin) {
      query =
        query.eq(
          "auditor_user_id",
          user.id,
        );
    }

    if (selectedOutletId) {
      query =
        query.eq(
          "outlet_id",
          selectedOutletId,
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) throw error;

    sessions =
      data ?? [];
  }

  const sessionIds =
    sessions.map(
      (session: any) =>
        session.id,
    );

  const findingCount =
    new Map<
      string,
      number
    >();

  if (sessionIds.length) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "audit_findings",
        )
        .select(
          "audit_session_id",
        )
        .in(
          "audit_session_id",
          sessionIds,
        );

    if (error) throw error;

    for (
      const finding
      of data ?? []
    ) {
      const sessionId =
        finding.audit_session_id;

      if (!sessionId) {
        continue;
      }

      findingCount.set(
        sessionId,
        (
          findingCount.get(
            sessionId,
          ) ?? 0
        ) + 1,
      );
    }
  }

  const outletById =
    new Map(
      outlets.map(
        (outlet: any) => [
          outlet.id,
          outlet,
        ],
      ),
    );

  const sessionsByDate =
    new Map<
      string,
      any[]
    >();

  for (
    const session
    of sessions
  ) {
    const rows =
      sessionsByDate.get(
        session.audit_date,
      ) ?? [];

    rows.push(session);

    sessionsByDate.set(
      session.audit_date,
      rows,
    );
  }

  const dates =
    Array.from(
      sessionsByDate.keys(),
    ).sort(
      (a, b) =>
        b.localeCompare(a),
    );

  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
              Outlet Audit
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
              Audit History
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {monthLabel(
                selectedMonth,
              )}
            </p>
          </div>

          <Link
            href="/protected"
            className="inline-flex h-11 w-fit items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            ← Dashboard
          </Link>
        </header>

        <section className="mt-5 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/protected/audit/history?month=${selectedMonth.slice(
                0,
                7,
              )}`}
              className={`rounded-xl border px-4 py-2 text-xs font-bold ${
                !selectedOutletId
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600"
              }`}
            >
              All Outlets
            </Link>

            {outlets.map(
              (outlet: any) => (
                <Link
                  key={
                    outlet.id
                  }
                  href={`/protected/audit/history?outlet=${outlet.id}&month=${selectedMonth.slice(
                    0,
                    7,
                  )}`}
                  className={`rounded-xl border px-4 py-2 text-xs font-bold ${
                    selectedOutletId ===
                    outlet.id
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  {
                    outlet.name
                  }
                </Link>
              ),
            )}
          </div>
        </section>

        {!sessions.length ? (
          <section className="mt-5 rounded-[24px] border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
            <h2 className="text-xl font-black">
              No submitted audits
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Tidak ada audit submitted untuk filter ini.
            </p>
          </section>
        ) : (
          <div className="mt-5 space-y-5">
            {dates.map(
              (date) => (
                <section
                  key={date}
                  className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm"
                >
                  <header className="border-b border-neutral-100 px-5 py-4 sm:px-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Audit Date
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      {dateLabel(
                        date,
                      )}
                    </h2>
                  </header>

                  <div className="divide-y divide-neutral-100">
                    {(
                      sessionsByDate.get(
                        date,
                      ) ?? []
                    ).map(
                      (
                        session: any,
                      ) => {
                        const outlet =
                          outletById.get(
                            session.outlet_id,
                          );

                        const scoring =
                          session.scoring_snapshot &&
                          typeof session.scoring_snapshot ===
                            "object"
                            ? session.scoring_snapshot
                            : {};

                        const penalty =
                          Number(
                            scoring.audit_penalty ??
                              0,
                          );

                        const before =
                          Number(
                            scoring.monthly_score_before ??
                              100,
                          );

                        const after =
                          Number(
                            scoring.monthly_score_after ??
                              session.score ??
                              100,
                          );

                        const hasScore =
                          Number.isFinite(
                            Number(
                              scoring.audit_penalty,
                            ),
                          ) &&
                          scoring.scoring_version;

                        return (
                          <article
                            key={
                              session.id
                            }
                            className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="flex min-w-0 items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xs font-black text-red-700">
                                {
                                  outlet?.code ??
                                  "AUD"
                                }
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-black">
                                    {
                                      outlet?.name ??
                                      "Outlet"
                                    }
                                  </h3>

                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                                    Submitted
                                  </span>
                                </div>

                                <p className="mt-1 text-xs text-neutral-400">
                                  {
                                    session.audit_number
                                  }
                                </p>

                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                                  <span>
                                    {timeLabel(
                                      session.submitted_at,
                                    )}
                                  </span>

                                  <span>
                                    {findingCount.get(
                                      session.id,
                                    ) ?? 0}{" "}
                                    finding
                                    {(findingCount.get(
                                      session.id,
                                    ) ?? 0) ===
                                    1
                                      ? ""
                                      : "s"}
                                  </span>

                                  {hasScore ? (
                                    <>
                                      <span className="font-bold text-red-700">
                                        -
                                        {
                                          penalty
                                        }{" "}
                                        pts
                                      </span>

                                      <span className="font-bold text-neutral-700">
                                        {
                                          before
                                        }{" "}
                                        →{" "}
                                        {
                                          after
                                        }
                                      </span>
                                    </>
                                  ) : (
                                    <span className="font-semibold text-neutral-400">
                                      Pre-scoring audit
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Link
                              href={`/protected/audit/${session.id}`}
                              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-black"
                            >
                              View Result
                            </Link>
                          </article>
                        );
                      },
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
