import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


function monthStart(
  value?: string,
) {
  if (
    value &&
    /^\d{4}-\d{2}$/.test(value)
  ) {
    return `${value}-01`;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value ?? "";

  return `${year}-${month}-01`;
}


function nextMonth(
  value: string,
) {
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


function monthLabel(
  value: string,
) {
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


export default async function QaFoodHistoryPage({
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
    permissionCodes,
  } =
    await getAccessContext();


  const canSubmit =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit",
    );

  const canViewManagement =
    isAdmin ||
    permissionCodes.includes(
      "audit.view_management",
    );


  if (
    !canSubmit &&
    !canViewManagement
  ) {
    redirect(
      "/protected",
    );
  }


  const admin =
    createAdminClient();

  let outlets:
    any[] =
    [];


  if (
    isAdmin ||
    canViewManagement
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from("outlets")
        .select(`
          id,
          code,
          name,
          is_active
        `)
        .eq(
          "organization_id",
          profile.organization_id,
        )
        .eq(
          "is_active",
          true,
        )
        .neq(
          "code",
          "CNT",
        )
        .order(
          "name",
        );

    if (error) {
      throw error;
    }

    outlets =
      data ?? [];

  } else {
    const {
      data,
      error,
    } =
      await admin
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

    if (error) {
      throw error;
    }

    outlets =
      (data ?? [])
        .map(
          (row: any) =>
            one<any>(
              row.outlets,
            ),
        )
        .filter(
          (outlet: any) =>
            outlet &&
            outlet.is_active !== false &&
            String(
              outlet.code,
            ).toUpperCase() !== "CNT",
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
    typeof params.outlet ===
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


  const selectedMonth =
    monthStart(
      params.month,
    );

  const endMonth =
    nextMonth(
      selectedMonth,
    );


  let sessions:
    any[] =
    [];


  if (
    allowedOutletIds.length
  ) {
    let query =
      admin
        .from(
          "qa_food_sessions",
        )
        .select(`
          id,
          qa_number,
          business_date,
          outlet_id,
          auditor_name_snapshot,
          finalized_at,
          result_status,
          score,
          max_score,
          scoring_snapshot
        `)
        .eq(
          "organization_id",
          profile.organization_id,
        )
        .eq(
          "status",
          "FINALIZED",
        )
        .gte(
          "business_date",
          selectedMonth,
        )
        .lt(
          "business_date",
          endMonth,
        )
        .in(
          "outlet_id",
          allowedOutletIds,
        )
        .order(
          "finalized_at",
          {
            ascending: false,
          },
        );


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

    if (error) {
      throw error;
    }

    sessions =
      data ?? [];
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


  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-[1180px]">

        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
              QA Food Standard
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
              Assessment History
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {monthLabel(
                selectedMonth,
              )}
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <Link
              href="/protected/audit/food-standard/assessment"
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold"
            >
              ← Assessment
            </Link>

            <Link
              href="/protected"
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold"
            >
              Dashboard
            </Link>

          </div>

        </header>


        <section className="mt-5 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm">

          <div className="flex flex-wrap gap-2">

            <Link
              href={`/protected/audit/food-standard/history?month=${selectedMonth.slice(
                0,
                7,
              )}`}
              className={[
                "rounded-xl border px-4 py-2 text-xs font-bold",
                !selectedOutletId
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600",
              ].join(" ")}
            >
              All Outlets
            </Link>


            {outlets.map(
              (outlet: any) => (
                <Link
                  key={
                    outlet.id
                  }
                  href={`/protected/audit/food-standard/history?outlet=${outlet.id}&month=${selectedMonth.slice(
                    0,
                    7,
                  )}`}
                  className={[
                    "rounded-xl border px-4 py-2 text-xs font-bold",
                    selectedOutletId === outlet.id
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-neutral-200 bg-white text-neutral-600",
                  ].join(" ")}
                >
                  {outlet.name}
                </Link>
              ),
            )}

          </div>

        </section>


        {!sessions.length ? (

          <section className="mt-5 rounded-[24px] border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">

            <h2 className="text-xl font-black">
              No finalized QA assessments
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Tidak ada QA Food Standard finalized untuk filter ini.
            </p>

          </section>

        ) : (

          <div className="mt-5 space-y-3">

            {sessions.map(
              (session: any) => {
                const outlet =
                  outletById.get(
                    session.outlet_id,
                  );

                const scoring =
                  session.scoring_snapshot &&
                  typeof session.scoring_snapshot === "object"
                    ? session.scoring_snapshot
                    : {};

                const score =
                  Number(
                    session.score ??
                    scoring.score ??
                    0,
                  );

                return (
                  <article
                    key={
                      session.id
                    }
                    className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
                  >

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                      <div className="flex min-w-0 items-start gap-4">

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xs font-black text-red-700">
                          {
                            outlet?.code ??
                            "QA"
                          }
                        </div>

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="font-black">
                              {
                                outlet?.name ??
                                "Outlet"
                              }
                            </h2>

                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                              Finalized
                            </span>

                          </div>


                          <p className="mt-1 text-xs text-neutral-400">
                            {dateLabel(
                              session.business_date,
                            )}
                            {" · "}
                            {
                              session.auditor_name_snapshot
                            }
                          </p>


                          <p className="mt-1 font-mono text-[11px] text-neutral-400">
                            {
                              session.qa_number
                            }
                          </p>


                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">

                            <span className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white">
                              {score}/100
                            </span>

                            <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-neutral-700">
                              {
                                Number(
                                  scoring.standard_menu_count ??
                                  0,
                                )
                              } Standard
                            </span>

                            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">
                              {
                                Number(
                                  scoring.needs_correction_count ??
                                  0,
                                )
                              } Needs Correction
                            </span>

                            <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-neutral-700">
                              {
                                Number(
                                  scoring.on_time_count ??
                                  0,
                                )
                              } On Time
                            </span>

                            <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-neutral-700">
                              {
                                Number(
                                  scoring.late_count ??
                                  0,
                                )
                              } Late
                            </span>

                          </div>

                        </div>

                      </div>


                      <Link
                        href={`/protected/audit/food-standard/report/${session.id}`}
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white"
                      >
                        View Report
                      </Link>

                    </div>

                  </article>
                );
              },
            )}

          </div>

        )}

      </div>

    </main>
  );
}
