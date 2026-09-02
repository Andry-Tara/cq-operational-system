import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  requirePermission,
} from "@/lib/admin/require-admin";

import {
  AutoRefresh,
} from "@/components/auto-refresh";

import ReopenReportButton from "./reports/reopen-report-button";


function one(value: any) {
  return Array.isArray(value)
    ? value[0]
    : value;
}


function businessDate(
  timezone: string
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


function fullDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}


function shortDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
    }
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}


function normalizeStatus(
  status?: string | null
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


export default async function ProtectedPage({
  searchParams,
}: {
  searchParams?:
    Promise<{
      period?: string;
    }>;
}) {
  const params =
    searchParams
      ? await searchParams
      : {};

  const period =
    params?.period === "30"
      ? 30
      : 7;

  const supabase =
    await createClient();

  const {
    user,
    profile,
    isAdmin,
    permissionCodes,
  } =
    await requirePermission(
      "dashboard.view"
    );

  const canClosing =
    isAdmin ||
    permissionCodes.includes(
      "closing.submit"
    );

  const canReports =
    isAdmin ||
    permissionCodes.includes(
      "reports.view"
    );

  const canReopenReport =
    isAdmin ||
    permissionCodes.includes(
      "reports.reopen"
    );


  const allOutletAccess =
    isAdmin ||
    permissionCodes.includes(
      "reports.all_outlets"
    );


  // ==========================================================
  // OUTLET SCOPE
  // ==========================================================

  let outlets: any[] = [];

  if (allOutletAccess) {
    const {
      data,
      error,
    } =
      await supabase
        .from("outlets")
        .select(`
          id,
          code,
          name,
          timezone,
          is_active
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "name"
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    outlets =
      data ?? [];

  } else {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "user_outlets"
        )
        .select(`
          outlet_id,
          outlets (
            id,
            code,
            name,
            timezone,
            is_active
          )
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    outlets =
      (
        data ?? []
      )
        .map(
          (row: any) =>
            one(
              row.outlets
            )
        )
        .filter(
          (
            outlet: any
          ) =>
            outlet &&
            outlet.is_active !==
              false
        );
  }


  // ==========================================================
  // ACTIVE OUTLET
  // ==========================================================

  const activeOutlet =
    await getActiveOutlet();

  if (
    !outlets.length &&
    activeOutlet
  ) {
    outlets = [
      activeOutlet,
    ];
  }


  const timezone =
    outlets.length === 1
      ? outlets[0]
          ?.timezone ||
        "Asia/Jakarta"
      : "Asia/Jakarta";

  const today =
    businessDate(
      timezone
    );

  const firstDate =
    shiftDate(
      today,
      -(period - 1)
    );


  // ==========================================================
  // CLOSING FORM
  // ==========================================================

  const {
    data:
      closingForm,
  } =
    await supabase
      .from("forms")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "code",
        "CLOSING"
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  // ==========================================================
  // REPORTS FOR DASHBOARD PERIOD
  // ==========================================================

  const outletIds =
    outlets.map(
      (
        outlet: any
      ) =>
        outlet.id
    );

  let reports: any[] =
    [];

  if (
    outletIds.length &&
    closingForm?.id
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          outlet_id,
          report_number,
          status,
          business_date,
          created_at,
          completed_at,
          pdf_storage_path
        `)
        .eq(
          "form_id",
          closingForm.id
        )
        .in(
          "outlet_id",
          outletIds
        )
        .gte(
          "business_date",
          firstDate
        )
        .lte(
          "business_date",
          today
        )
        .order(
          "business_date",
          {
            ascending:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    reports =
      data ?? [];
  }


  // ==========================================================
  // ISSUES
  // ==========================================================

  const reportIds =
    reports.map(
      (
        report: any
      ) =>
        report.id
    );

  let issues: any[] =
    [];

  if (
    reportIds.length
  ) {
    const {
      data,
    } =
      await supabase
        .from("issues")
        .select(`
          id,
          report_id,
          status
        `)
        .in(
          "report_id",
          reportIds
        );

    issues =
      data ?? [];
  }


  const issueCountByReport =
    new Map<
      string,
      number
    >();

  for (
    const issue
    of issues
  ) {
    if (
      !issue.report_id
    ) {
      continue;
    }

    issueCountByReport.set(
      issue.report_id,
      (
        issueCountByReport.get(
          issue.report_id
        ) ?? 0
      ) + 1
    );
  }


  // ==========================================================
  // TODAY
  // ==========================================================

  const todayRows =
    outlets.map(
      (
        outlet: any
      ) => {
        const report =
          reports.find(
            (
              item: any
            ) =>
              item.outlet_id ===
                outlet.id &&
              item.business_date ===
                today
          ) ?? null;

        return {
          outlet,
          report,
          status:
            report
              ? normalizeStatus(
                  report.status
                )
              : "not_submitted",
          issueCount:
            report
              ? issueCountByReport.get(
                  report.id
                ) ?? 0
              : 0,
        };
      }
    );


  const completed =
    todayRows.filter(
      (row) =>
        row.status ===
        "completed"
    ).length;

  const inProgress =
    todayRows.filter(
      (row) =>
        row.status ===
        "in_progress"
    ).length;

  const notSubmitted =
    todayRows.filter(
      (row) =>
        row.status ===
        "not_submitted"
    ).length;

  const todayIssues =
    todayRows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.issueCount,
      0
    );


  // ==========================================================
  // TREND
  // ==========================================================

  const trend =
    Array.from(
      {
        length:
          period,
      },
      (_, index) => {
        const date =
          shiftDate(
            firstDate,
            index
          );

        const dateReports =
          reports.filter(
            (
              report: any
            ) =>
              report
                .business_date ===
              date
          );

        const completedCount =
          dateReports.filter(
            (
              report: any
            ) =>
              normalizeStatus(
                report.status
              ) ===
              "completed"
          ).length;

        const issueCount =
          dateReports.reduce(
            (
              total:
                number,
              report: any
            ) =>
              total +
              (
                issueCountByReport.get(
                  report.id
                ) ?? 0
              ),
            0
          );

        const rate =
          outlets.length
            ? Math.round(
                (
                  completedCount /
                  outlets.length
                ) *
                  100
              )
            : 0;

        return {
          date,
          completed:
            completedCount,
          issues:
            issueCount,
          rate,
        };
      }
    );


  // ==========================================================
  // ACTIVE OUTLET STATUS
  // ==========================================================

  const activeReport =
    activeOutlet
      ? reports.find(
          (
            report: any
          ) =>
            report.outlet_id ===
              activeOutlet.id &&
            report.business_date ===
              today
        ) ?? null
      : null;

  const activeStatus =
    activeReport
      ? normalizeStatus(
          activeReport.status
        )
      : "not_submitted";

  const activeAction =
    activeStatus ===
      "completed"
      ? activeReport
          ?.pdf_storage_path
        ? `/api/reports/${activeReport.id}/pdf`
        : "/protected/reports"
      : "/protected/closing/kitchen";

  const activeActionText =
    activeStatus ===
      "completed"
      ? "View Report"
      : activeStatus ===
          "in_progress"
        ? "Resume Closing"
        : "Start Closing";


  const scopeLabel =
    allOutletAccess
      ? "All Outlets"
      : outlets.length >
          1
        ? "Assigned Outlets"
        : outlets[0]
            ?.name ||
          "Outlet";


  const recentReports =
    [
      ...reports,
    ]
      .sort(
        (
          a: any,
          b: any
        ) =>
          String(
            b.business_date
          ).localeCompare(
            String(
              a.business_date
            )
          )
      )
      .slice(
        0,
        6
      );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">

      <AutoRefresh
        intervalMs={
          60000
        }
      />

      <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-8 md:py-10">

        {/* TITLE */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Operational Overview
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {fullDate(
                today
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                Report Scope
              </p>

              <p className="mt-1 text-sm font-bold text-neutral-800">
                {scopeLabel}
              </p>
            </div>

            {canReports && (
              <Link
                href="/protected/reports"
                className="inline-flex h-[58px] items-center rounded-2xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-black"
              >
                Reports →
              </Link>
            )}

          </div>

        </div>


        {/* SUMMARY */}
        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

          <Metric
            label="Outlets"
            value={
              outlets.length
            }
            sub={
              scopeLabel
            }
          />

          <Metric
            label="Completed"
            value={
              completed
            }
            sub="Today"
            tone="success"
          />

          <Metric
            label="In Progress"
            value={
              inProgress
            }
            sub="Today"
            tone="warning"
          />

          <Metric
            label="Not Submitted"
            value={
              notSubmitted
            }
            sub="Today"
          />

          <Metric
            label="Issues"
            value={
              todayIssues
            }
            sub="Today"
            tone="danger"
          />

        </section>


        {/* TREND + ACTIVE OUTLET */}
        <section className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_.7fr]">

          <div className="rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Report Completion Trend
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {scopeLabel}
                </h2>
              </div>

              <div className="flex rounded-xl bg-neutral-100 p-1">

                <Link
                  href="/protected?period=7"
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    period === 7
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400"
                  }`}
                >
                  7 Days
                </Link>

                <Link
                  href="/protected?period=30"
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    period === 30
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400"
                  }`}
                >
                  30 Days
                </Link>

              </div>

            </div>


            <div className="mt-7 flex h-[200px] items-end gap-1.5 border-b border-neutral-200">

              {trend.map(
                (
                  item,
                  index
                ) => {
                  const showLabel =
                    period ===
                      7 ||
                    index %
                      5 ===
                      0 ||
                    index ===
                      trend.length -
                        1;

                  return (
                    <div
                      key={
                        item.date
                      }
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${item.date} · ${item.rate}% completed · ${item.issues} issues`}
                    >

                      <div className="flex h-[150px] items-end">

                        <div
                          className={`w-full rounded-t-md ${
                            item.rate ===
                            100
                              ? "bg-emerald-500"
                              : item.rate >
                                  0
                                ? "bg-red-600"
                                : "bg-neutral-200"
                          }`}
                          style={{
                            height:
                              `${Math.max(
                                5,
                                item.rate
                              )}%`,
                          }}
                        />

                      </div>

                      <div className="h-9 pt-2 text-center">

                        {showLabel && (
                          <span className="text-[9px] font-semibold text-neutral-400">
                            {shortDate(
                              item.date
                            )}
                          </span>
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-neutral-400">
              <span>
                Completion is calculated against{" "}
                <strong className="text-neutral-700">
                  {outlets.length}
                </strong>{" "}
                outlet
                {outlets.length ===
                1
                  ? ""
                  : "s"}.
              </span>

              <span>
                Today:{" "}
                <strong className="text-neutral-700">
                  {outlets.length
                    ? Math.round(
                        (
                          completed /
                          outlets.length
                        ) *
                          100
                      )
                    : 0}
                  %
                </strong>
              </span>
            </div>

          </div>


          {/* ACTIVE OUTLET */}
          <div className="rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">

            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Active Outlet
            </p>

            {activeOutlet ? (
              <>
                <div className="mt-5 flex items-center gap-4">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-700">
                    {
                      activeOutlet.code
                    }
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold">
                      {
                        activeOutlet.name
                      }
                    </h2>

                    <div className="mt-1">
                      <StatusBadge
                        status={
                          activeStatus
                        }
                      />
                    </div>
                  </div>

                </div>

                <div className="mt-7">

                  {(
                    canClosing ||
                    activeStatus ===
                      "completed"
                  ) && (
                    <Link
                      href={
                        activeAction
                      }
                      target={
                        activeStatus ===
                          "completed" &&
                        activeReport
                          ?.pdf_storage_path
                          ? "_blank"
                          : undefined
                      }
                      className="flex w-full items-center justify-between rounded-2xl bg-red-700 px-5 py-4 text-sm font-bold text-white transition hover:bg-red-800"
                    >
                      <span>
                        {
                          activeActionText
                        }
                      </span>
                      <span>
                        →
                      </span>
                    </Link>
                  )}

                  <Link
                    href="/protected/select-outlet"
                    className="mt-3 flex w-full items-center justify-center rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Change Outlet
                  </Link>

                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-neutral-500">
                  Select an outlet to start or resume daily operations.
                </p>

                <Link
                  href="/protected/select-outlet"
                  className="mt-6 flex items-center justify-center rounded-2xl bg-red-700 px-5 py-4 text-sm font-bold text-white"
                >
                  Select Outlet
                </Link>
              </>
            )}

          </div>

        </section>


        {/* TODAY OUTLETS */}

        <section className="mt-6 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm md:rounded-[26px]">

          <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-4 sm:px-6 sm:py-5">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">

                Today

              </p>

              <h2 className="mt-1 text-lg font-black tracking-tight text-neutral-950 sm:text-xl">

                Outlet Status

              </h2>

            </div>

            <p className="shrink-0 text-xs font-semibold text-neutral-400">

              {outlets.length}{" "}
              outlet
              {outlets.length === 1
                ? ""
                : "s"}

            </p>

          </div>


          {/* ==================================================
              MOBILE / TABLET
          ================================================== */}

          <div className="divide-y divide-neutral-100 lg:hidden">

            {todayRows.map(
              (row) => {

                const normalizedStatus =
                  String(
                    row.status || ""
                  )
                    .trim()
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "_"
                    );

                const isCompletedRow =
                  [
                    "completed",
                    "submitted",
                  ].includes(
                    normalizedStatus
                  );

                return (

                  <div
                    key={row.outlet.id}
                    className="px-4 py-5 sm:px-6"
                  >

                    {/* TOP */}

                    <div className="flex items-start justify-between gap-3">

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-[11px] font-black text-red-700">

                          {
                            row.outlet.code
                          }

                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-[15px] font-black text-neutral-950">

                            {
                              row.outlet.name
                            }

                          </p>

                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">

                            {
                              row.outlet.code
                            }

                          </p>

                        </div>

                      </div>

                      <div className="shrink-0">

                        <StatusBadge
                          status={
                            row.status
                          }
                        />

                      </div>

                    </div>


                    {/* INFO */}

                    <div className="mt-4 grid grid-cols-2 gap-3">

                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">

                        <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                          Issues

                        </p>

                        {row.issueCount > 0 ? (

                          <p className="mt-1 text-sm font-black text-red-700">

                            {
                              row.issueCount
                            }{" "}
                            Issue
                            {row.issueCount === 1
                              ? ""
                              : "s"}

                          </p>

                        ) : (

                          <p className="mt-1 text-sm font-black text-neutral-700">

                            0

                          </p>

                        )}

                      </div>


                      <div className="min-w-0 rounded-2xl bg-neutral-50 px-4 py-3">

                        <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                          Report

                        </p>

                        {row.report ? (

                          <p className="mt-1 truncate text-xs font-bold text-neutral-700">

                            {
                              row.report
                                .report_number
                            }

                          </p>

                        ) : (

                          <p className="mt-1 text-xs font-semibold text-neutral-400">

                            Not submitted

                          </p>

                        )}

                      </div>

                    </div>


                    {/* ACTION */}

                    {row.report && (

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 [&>button]:w-full [&>button]:justify-center">

                        {row.report
                          .pdf_storage_path &&
                        canReports ? (

                          <a
                            href={`/api/reports/${row.report.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-xs font-black text-white transition hover:bg-black"
                          >

                            View Report

                          </a>

                        ) : (

                          <div className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-100 px-4 py-3 text-xs font-bold text-neutral-400">

                            No PDF

                          </div>

                        )}


                        {canReopenReport &&
                          isCompletedRow && (

                            <ReopenReportButton
                              reportId={
                                row.report.id
                              }
                              reportNumber={
                                row.report
                                  .report_number
                              }
                            />

                          )}

                      </div>

                    )}

                  </div>

                );

              }
            )}

          </div>


          {/* ==================================================
              DESKTOP
          ================================================== */}

          <div className="hidden lg:block">

            <div className="grid grid-cols-[1.45fr_.75fr_.6fr_1fr_1fr] gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">

              <div>
                Outlet
              </div>

              <div>
                Status
              </div>

              <div>
                Issues
              </div>

              <div>
                Report
              </div>

              <div>
                Action
              </div>

            </div>


            {todayRows.map(
              (row) => {

                const normalizedStatus =
                  String(
                    row.status || ""
                  )
                    .trim()
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "_"
                    );

                const isCompletedRow =
                  [
                    "completed",
                    "submitted",
                  ].includes(
                    normalizedStatus
                  );

                return (

                  <div
                    key={row.outlet.id}
                    className="grid grid-cols-[1.45fr_.75fr_.6fr_1fr_1fr] items-center gap-4 border-b border-neutral-100 px-6 py-5 last:border-b-0"
                  >

                    {/* OUTLET */}

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[10px] font-black text-red-700">

                        {
                          row.outlet.code
                        }

                      </div>

                      <div className="min-w-0">

                        <p className="truncate font-bold text-neutral-950">

                          {
                            row.outlet.name
                          }

                        </p>

                        <p className="mt-0.5 text-[10px] text-neutral-400">

                          {
                            row.outlet.code
                          }

                        </p>

                      </div>

                    </div>


                    {/* STATUS */}

                    <div>

                      <StatusBadge
                        status={
                          row.status
                        }
                      />

                    </div>


                    {/* ISSUES */}

                    <div>

                      {row.issueCount > 0 ? (

                        <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">

                          {
                            row.issueCount
                          }{" "}
                          Issue
                          {row.issueCount ===
                          1
                            ? ""
                            : "s"}

                        </span>

                      ) : (

                        <span className="text-sm font-semibold text-neutral-400">

                          0

                        </span>

                      )}

                    </div>


                    {/* REPORT */}

                    <div className="min-w-0">

                      {row.report ? (

                        <p className="truncate text-xs font-semibold text-neutral-600">

                          {
                            row.report
                              .report_number
                          }

                        </p>

                      ) : (

                        <span className="text-xs text-neutral-300">

                          -

                        </span>

                      )}

                    </div>


                    {/* ACTION */}

                    <div>

                      {row.report ? (

                        <div className="flex flex-wrap items-center gap-2">

                          {row.report
                            .pdf_storage_path &&
                          canReports && (

                            <a
                              href={`/api/reports/${row.report.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-xl bg-neutral-900 px-3.5 py-2.5 text-[11px] font-black text-white transition hover:bg-black"
                            >

                              View Report

                            </a>

                          )}


                          {canReopenReport &&
                            isCompletedRow && (

                              <ReopenReportButton
                                reportId={
                                  row.report.id
                                }
                                reportNumber={
                                  row.report
                                    .report_number
                                }
                              />

                            )}

                        </div>

                      ) : (

                        <span className="text-xs text-neutral-300">

                          -

                        </span>

                      )}

                    </div>

                  </div>

                );

              }
            )}

          </div>

        </section>


{/* RECENT */}
        {canReports && (
          <section className="mt-6 rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  History
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Recent Reports
                </h2>
              </div>

              <Link
                href="/protected/reports"
                className="text-xs font-bold text-red-700"
              >
                View All →
              </Link>

            </div>

            <div className="mt-5 divide-y divide-neutral-100">

              {!recentReports.length ? (
                <p className="py-8 text-sm text-neutral-400">
                  No reports available yet.
                </p>
              ) : (
                recentReports.map(
                  (
                    report: any
                  ) => {
                    const outlet =
                      outlets.find(
                        (
                          item: any
                        ) =>
                          item.id ===
                          report.outlet_id
                      );

                    return (
                      <div
                        key={
                          report.id
                        }
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >

                        <div>
                          <p className="text-sm font-bold">
                            {
                              outlet
                                ?.name ||
                              "Outlet"
                            }
                          </p>

                          <p className="mt-1 text-xs text-neutral-400">
                            {
                              report.report_number
                            }
                          </p>
                        </div>

                        <div className="flex items-center gap-4">

                          <p className="text-xs text-neutral-400">
                            {shortDate(
                              report.business_date
                            )}
                          </p>

                          <StatusBadge
                            status={
                              normalizeStatus(
                                report.status
                              )
                            }
                          />

                          {report
                            .pdf_storage_path && (
                            <a
                              href={`/api/reports/${report.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-red-700"
                            >
                              PDF →
                            </a>
                          )}

                        </div>

                      </div>
                    );
                  }
                )
              )}

            </div>

          </section>
        )}


        <footer className="mt-10 border-t border-neutral-200 py-6 text-xs text-neutral-400">
          Resto Operational System · Operational Overview
        </footer>

      </div>

    </main>
  );
}


function Metric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: number;
  sub: string;
  tone?:
    | "neutral"
    | "success"
    | "warning"
    | "danger";
}) {
  const styles = {
    neutral:
      "text-neutral-900",
    success:
      "text-emerald-700",
    warning:
      "text-amber-700",
    danger:
      "text-red-700",
  };

  return (
    <div className="rounded-[22px] border border-neutral-200 bg-white p-5 shadow-sm">

      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p className={`mt-3 text-3xl font-black tracking-tight ${styles[tone]}`}>
        {value}
      </p>

      <p className="mt-1 truncate text-xs text-neutral-400">
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
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">
        Completed
      </span>
    );
  }

  if (
    status ===
    "in_progress"
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700">
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-500">
      Not Submitted
    </span>
  );
}


function ErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">

      <div className="w-full max-w-lg rounded-[26px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

        <p className="text-3xl">
          ⚠️
        </p>

        <h1 className="mt-5 text-xl font-bold">
          Unable to Load Dashboard
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          {message}
        </p>

      </div>

    </main>
  );
}
