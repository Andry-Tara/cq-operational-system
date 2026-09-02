"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  AutoRefresh,
} from "@/components/auto-refresh";

import ReopenReportButton from "./reopen-report-button";


type Outlet = {
  id: string;
  code: string;
  name: string;
  timezone?: string | null;
};


type Report = {
  id: string;
  outlet_id: string;
  report_number: string;
  business_date: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  pdf_storage_path: string | null;
  photo_count: number;
  issue_count: number;
};


type UserInfo = {
  full_name: string;
  role: string;
  allOutletAccess: boolean;

  // Existing prop name kept for compatibility.
  // Server now uses this as reopen permission.
  isAdmin: boolean;
};


function formatDate(
  date: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(
      new Date(
        `${date}T12:00:00`
      )
    );
  } catch {
    return date;
  }
}


function normalizeStatus(
  status:
    | string
    | undefined
) {
  const value =
    String(
      status || ""
    ).toLowerCase();

  if (
    value === "completed" ||
    value === "submitted"
  ) {
    return "completed";
  }

  if (
    value === "draft" ||
    value ===
      "in_progress" ||
    value === "reopened"
  ) {
    return "in_progress";
  }

  return "not_submitted";
}


function shiftDate(
  date: string,
  amount: number
) {
  const value =
    new Date(
      `${date}T12:00:00Z`
    );

  value.setUTCDate(
    value.getUTCDate() +
      amount
  );

  return value
    .toISOString()
    .slice(0, 10);
}


export default function ReportsHistoryClient({
  outlets,
  reports,
  today,
  user,
}: {
  outlets: Outlet[];
  reports: Report[];
  today: string;
  user: UserInfo;
}) {
  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      today
    );

  const [
    selectedOutlet,
    setSelectedOutlet,
  ] =
    useState(
      "ALL"
    );

  const [
    selectedStatus,
    setSelectedStatus,
  ] =
    useState(
      "ALL"
    );


  const dailyRows =
    useMemo(() => {
      return outlets.map(
        (
          outlet
        ) => {
          const report =
            reports.find(
              (
                item
              ) =>
                item.outlet_id ===
                  outlet.id &&
                item.business_date ===
                  selectedDate
            ) ?? null;

          const status =
            report
              ? normalizeStatus(
                  report.status
                )
              : "not_submitted";

          return {
            outlet,
            report,
            status,
          };
        }
      );
    }, [
      outlets,
      reports,
      selectedDate,
    ]);


  const filteredRows =
    useMemo(() => {
      return dailyRows.filter(
        (
          row
        ) => {
          if (
            selectedOutlet !==
              "ALL" &&
            row.outlet.id !==
              selectedOutlet
          ) {
            return false;
          }

          if (
            selectedStatus !==
              "ALL" &&
            row.status !==
              selectedStatus
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      dailyRows,
      selectedOutlet,
      selectedStatus,
    ]);


  const completed =
    dailyRows.filter(
      (
        row
      ) =>
        row.status ===
        "completed"
    ).length;

  const inProgress =
    dailyRows.filter(
      (
        row
      ) =>
        row.status ===
        "in_progress"
    ).length;

  const notSubmitted =
    dailyRows.filter(
      (
        row
      ) =>
        row.status ===
        "not_submitted"
    ).length;

  const totalIssues =
    dailyRows.reduce(
      (
        total,
        row
      ) =>
        total +
        (
          row.report
            ?.issue_count ??
          0
        ),
      0
    );


  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">

      <AutoRefresh
        intervalMs={
          60000
        }
      />

      <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-8 md:py-10">

        {/* TITLE */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
            Operational Reports
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Reports History
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Monitor closing submissions, issues and report completion by outlet.
          </p>
        </div>


        {/* SUMMARY */}
        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            label="Completed"
            value={
              completed
            }
            sub={`${outlets.length} outlet scope`}
            variant="success"
          />

          <SummaryCard
            label="In Progress"
            value={
              inProgress
            }
            sub="Awaiting final submit"
            variant="warning"
          />

          <SummaryCard
            label="Not Submitted"
            value={
              notSubmitted
            }
            sub="No report yet"
            variant="neutral"
          />

          <SummaryCard
            label="Issues"
            value={
              totalIssues
            }
            sub="Issues on selected date"
            variant="danger"
          />

        </section>


        {/* FILTER */}
        <section className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">

            {/* DATE */}
            <div>
              <div className="flex items-center justify-between gap-3">

                <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Date
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(
                      today
                    )
                  }
                  className="text-[10px] font-black uppercase tracking-wide text-red-700"
                >
                  Today
                </button>

              </div>

              <div className="relative mt-2 h-12 overflow-hidden rounded-xl border border-neutral-200 bg-white transition focus-within:border-red-300">

                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">

                  <span className="text-sm font-semibold text-neutral-700">
                    {formatDate(
                      selectedDate
                    )}
                  </span>

                  <span className="text-base">
                    📅
                  </span>

                </div>

                <input
                  type="date"
                  value={
                    selectedDate
                  }
                  max={
                    today
                  }
                  onChange={(
                    event
                  ) => {
                    if (
                      event.target
                        .value
                    ) {
                      setSelectedDate(
                        event.target
                          .value
                      );
                    }
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select report date"
                />

              </div>

              <div className="mt-2 flex gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(
                      shiftDate(
                        selectedDate,
                        -1
                      )
                    )
                  }
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[10px] font-bold text-neutral-500"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  disabled={
                    selectedDate >=
                    today
                  }
                  onClick={() =>
                    setSelectedDate(
                      shiftDate(
                        selectedDate,
                        1
                      )
                    )
                  }
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[10px] font-bold text-neutral-500 disabled:opacity-30"
                >
                  Next →
                </button>

              </div>

            </div>


            {/* OUTLET */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                Outlet
              </span>

              <select
                value={
                  selectedOutlet
                }
                onChange={(
                  event
                ) =>
                  setSelectedOutlet(
                    event.target
                      .value
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 outline-none transition focus:border-red-300"
              >
                <option value="ALL">
                  {user.allOutletAccess
                    ? "All Outlets"
                    : outlets.length >
                        1
                      ? "All Assigned Outlets"
                      : "Current Outlet"}
                </option>

                {outlets.map(
                  (
                    outlet
                  ) => (
                    <option
                      key={
                        outlet.id
                      }
                      value={
                        outlet.id
                      }
                    >
                      {
                        outlet.name
                      }
                    </option>
                  )
                )}
              </select>

            </label>


            {/* STATUS */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                Status
              </span>

              <select
                value={
                  selectedStatus
                }
                onChange={(
                  event
                ) =>
                  setSelectedStatus(
                    event.target
                      .value
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 outline-none transition focus:border-red-300"
              >
                <option value="ALL">
                  All Status
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="in_progress">
                  In Progress
                </option>

                <option value="not_submitted">
                  Not Submitted
                </option>

              </select>

            </label>

          </div>

        </section>


        {/* REPORT LIST */}
        <section className="mt-6 overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">

          <div className="border-b border-neutral-100 px-6 py-5">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Daily Closing
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {formatDate(
                    selectedDate
                  )}
                </h2>
              </div>

              <div className="text-xs font-semibold text-neutral-400">
                {
                  filteredRows.length
                }{" "}
                outlet
                {filteredRows.length ===
                1
                  ? ""
                  : "s"}
              </div>

            </div>

          </div>


          <div className="hidden grid-cols-[1.5fr_.8fr_1fr_.7fr_.7fr_.8fr] gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-4 text-[10px] font-black uppercase tracking-wide text-neutral-400 lg:grid">

            <div>
              Outlet
            </div>
            <div>
              Status
            </div>
            <div>
              Report
            </div>
            <div>
              Photos
            </div>
            <div>
              Issues
            </div>
            <div>
              Action
            </div>

          </div>


          {!filteredRows.length ? (
            <div className="px-6 py-16 text-center text-sm text-neutral-400">
              No data found for this filter.
            </div>
          ) : (
            filteredRows.map(
              ({
                outlet,
                report,
                status,
              }) => (
                <div
                  key={
                    outlet.id
                  }
                  className="grid gap-5 border-b border-neutral-100 px-6 py-6 last:border-b-0 lg:grid-cols-[1.5fr_.8fr_1fr_.7fr_.7fr_.8fr] lg:items-center"
                >

                  {/* OUTLET */}
                  <div className="flex items-center gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xs font-black text-red-700">
                      {
                        outlet.code
                      }
                    </div>

                    <div>
                      <p className="font-bold">
                        {
                          outlet.name
                        }
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        {
                          outlet.code
                        }
                      </p>
                    </div>

                  </div>


                  {/* STATUS */}
                  <div>
                    <StatusBadge
                      status={
                        status
                      }
                    />
                  </div>


                  {/* REPORT */}
                  <div>
                    {report ? (
                      <>
                        <p className="break-all text-xs font-semibold text-neutral-700">
                          {
                            report.report_number
                          }
                        </p>

                        <p className="mt-1 text-[10px] text-neutral-400">
                          Closing Kitchen
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-neutral-300">
                        -
                      </span>
                    )}
                  </div>


                  {/* PHOTOS */}
                  <div>
                    <span className="text-sm font-bold">
                      {report
                        ? report.photo_count
                        : 0}
                    </span>

                    <span className="ml-1 text-xs text-neutral-400">
                      photos
                    </span>
                  </div>


                  {/* ISSUES */}
                  <div>
                    {report
                      ?.issue_count ? (
                      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                        {
                          report.issue_count
                        }{" "}
                        Issue
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-neutral-400">
                        0
                      </span>
                    )}
                  </div>


                  {/* ACTION */}
                  <div>
                    {report ? (
                      <div className="flex flex-wrap gap-2">

                        {report
                          .pdf_storage_path ? (
                          <a
                            href={`/api/reports/${report.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black"
                          >
                            View PDF
                          </a>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-neutral-400">
                            No PDF
                          </span>
                        )}

                        {user.isAdmin &&
                          status ===
                            "completed" && (
                            <ReopenReportButton
                              reportId={
                                report.id
                              }
                              reportNumber={
                                report.report_number
                              }
                            />
                          )}

                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-neutral-300">
                        -
                      </span>
                    )}
                  </div>

                </div>
              )
            )
          )}

        </section>


        <footer className="mt-10 border-t border-neutral-200 py-6 text-xs text-neutral-400">
          Resto Operational System · Reports
        </footer>

      </div>

    </main>
  );
}


function SummaryCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: number;
  sub: string;
  variant:
    | "success"
    | "warning"
    | "neutral"
    | "danger";
}) {
  const styles = {
    success:
      "text-emerald-700",
    warning:
      "text-amber-700",
    neutral:
      "text-neutral-700",
    danger:
      "text-red-700",
  };

  return (
    <div className="rounded-[22px] border border-neutral-200 bg-white p-5 shadow-sm">

      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p className={`mt-3 text-3xl font-black ${styles[variant]}`}>
        {value}
      </p>

      <p className="mt-1 text-xs text-neutral-400">
        {sub}
      </p>

    </div>
  );
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    "completed"
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-700">
        Completed
      </span>
    );
  }

  if (
    status ===
    "in_progress"
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase text-amber-700">
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-[9px] font-black uppercase text-neutral-500">
      Not Submitted
    </span>
  );
}
