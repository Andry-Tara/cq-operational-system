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


type Form = {
  id: string;
  code: string;
  name: string;
};


type Assignment = {
  id: string;
  outlet_id: string;
  form_id: string;
};


type ReportSection = {
  id: string;
  section_id: string;
  code: string;
  name: string;
  status: string;
  created_by_email:
    string | null;
  question_count: number;
  answer_count: number;
  photo_count: number;
};


type Report = {
  id: string;
  outlet_id: string;
  form_id: string;

  form_code: string;
  form_name: string;

  report_number: string;
  business_date: string;
  status: string;

  created_at:
    string | null;

  completed_at:
    string | null;

  pdf_storage_path:
    string | null;

  created_by_email:
    string | null;

  sections:
    ReportSection[];

  section_count: number;
  completed_section_count:
    number;

  answer_count: number;
  question_count: number;

  photo_count: number;

  issue_count: number;
  open_issue_count: number;
};


type UserInfo = {
  full_name: string;
  role: string;
  allOutletAccess: boolean;
  canReopen: boolean;
};


type RowStatus =
  | "completed"
  | "in_progress"
  | "not_submitted";


type DailyRow = {
  key: string;
  outlet: Outlet;
  form: Form;
  report: Report | null;
  status: RowStatus;
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


function normalizeStatus(
  status:
    | string
    | null
    | undefined
): RowStatus {
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
    value === "in_progress" ||
    value === "reopened"
  ) {
    return "in_progress";
  }

  return "not_submitted";
}


function statusLabel(
  status: RowStatus
) {
  if (
    status === "completed"
  ) {
    return "Completed";
  }

  if (
    status === "in_progress"
  ) {
    return "In Progress";
  }

  return "Not Submitted";
}


function percentage(
  value: number,
  total: number
) {
  if (
    total <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          value /
          total
        ) *
          100
      )
    )
  );
}


export default function ReportsHistoryClient({
  outlets,
  forms,
  assignments,
  reports,
  today,
  user,
}: {
  outlets: Outlet[];
  forms: Form[];
  assignments: Assignment[];
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
    selectedForm,
    setSelectedForm,
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

  const [
    selectedSection,
    setSelectedSection,
  ] =
    useState(
      "ALL"
    );

  const [
    selectedCreator,
    setSelectedCreator,
  ] =
    useState(
      "ALL"
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const outletMap =
    useMemo(
      () =>
        new Map(
          outlets.map(
            (
              outlet
            ) => [
              outlet.id,
              outlet,
            ]
          )
        ),
      [
        outlets,
      ]
    );


  const formMap =
    useMemo(
      () =>
        new Map(
          forms.map(
            (
              form
            ) => [
              form.id,
              form,
            ]
          )
        ),
      [
        forms,
      ]
    );


  // ==========================================================
  // EXPECTED DAILY ROWS
  //
  // Uses active Outlet Form Assignment.
  // This is what makes CK safe:
  // CLOSING_CK only appears where actually assigned.
  // ==========================================================

  const dailyRows =
    useMemo(
      () => {
        const rows:
          DailyRow[] = [];

        const seen =
          new Set<
            string
          >();

        const reportMap =
          new Map<
            string,
            Report
          >();

        for (
          const report of
          reports
        ) {
          if (
            report.business_date !==
            selectedDate
          ) {
            continue;
          }

          const key =
            `${report.outlet_id}:${report.form_id}`;

          if (
            !reportMap.has(
              key
            )
          ) {
            reportMap.set(
              key,
              report
            );
          }
        }

        for (
          const assignment of
          assignments
        ) {
          const outlet =
            outletMap.get(
              assignment.outlet_id
            );

          const form =
            formMap.get(
              assignment.form_id
            );

          if (
            !outlet ||
            !form
          ) {
            continue;
          }

          const key =
            `${outlet.id}:${form.id}`;

          const report =
            reportMap.get(
              key
            ) ?? null;

          rows.push({
            key,
            outlet,
            form,
            report,
            status:
              report
                ? normalizeStatus(
                    report.status
                  )
                : "not_submitted",
          });

          seen.add(
            key
          );
        }

        // Historical / exceptional reports that no longer
        // have a current assignment should still be visible.
        for (
          const report of
          reportMap.values()
        ) {
          const key =
            `${report.outlet_id}:${report.form_id}`;

          if (
            seen.has(
              key
            )
          ) {
            continue;
          }

          const outlet =
            outletMap.get(
              report.outlet_id
            );

          const form =
            formMap.get(
              report.form_id
            );

          if (
            !outlet ||
            !form
          ) {
            continue;
          }

          rows.push({
            key,
            outlet,
            form,
            report,
            status:
              normalizeStatus(
                report.status
              ),
          });
        }

        return rows.sort(
          (
            left,
            right
          ) => {
            const outletCompare =
              left.outlet.name.localeCompare(
                right.outlet.name
              );

            if (
              outletCompare !==
              0
            ) {
              return outletCompare;
            }

            return left.form.code.localeCompare(
              right.form.code
            );
          }
        );
      },
      [
        assignments,
        formMap,
        outletMap,
        reports,
        selectedDate,
      ]
    );


  const sectionOptions =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const report of
          reports
        ) {
          for (
            const section of
            report.sections
          ) {
            map.set(
              section.code,
              section.name
            );
          }
        }

        return Array.from(
          map.entries()
        ).sort(
          (
            left,
            right
          ) =>
            left[1].localeCompare(
              right[1]
            )
        );
      },
      [
        reports,
      ]
    );


  const creatorOptions =
    useMemo(
      () => {
        const creators =
          new Set<
            string
          >();

        for (
          const report of
          reports
        ) {
          if (
            report.created_by_email
          ) {
            creators.add(
              report.created_by_email
            );
          }

          for (
            const section of
            report.sections
          ) {
            if (
              section.created_by_email
            ) {
              creators.add(
                section.created_by_email
              );
            }
          }
        }

        return Array.from(
          creators
        ).sort();
      },
      [
        reports,
      ]
    );


  const filteredRows =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

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
              selectedForm !==
                "ALL" &&
              row.form.id !==
                selectedForm
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

            if (
              selectedSection !==
              "ALL"
            ) {
              const hasSection =
                row.report
                  ?.sections
                  .some(
                    (
                      section
                    ) =>
                      section.code ===
                      selectedSection
                  ) ??
                false;

              if (
                !hasSection
              ) {
                return false;
              }
            }

            if (
              selectedCreator !==
              "ALL"
            ) {
              const reportCreator =
                row.report
                  ?.created_by_email ===
                selectedCreator;

              const sectionCreator =
                row.report
                  ?.sections
                  .some(
                    (
                      section
                    ) =>
                      section.created_by_email ===
                      selectedCreator
                  ) ??
                false;

              if (
                !reportCreator &&
                !sectionCreator
              ) {
                return false;
              }
            }

            if (
              query
            ) {
              const haystack = [
                row.outlet.name,
                row.outlet.code,
                row.form.name,
                row.form.code,
                row.report
                  ?.report_number ??
                  "",
                row.report
                  ?.created_by_email ??
                  "",
                ...(
                  row.report
                    ?.sections
                    .flatMap(
                      (
                        section
                      ) => [
                        section.name,
                        section.code,
                        section.created_by_email ??
                          "",
                      ]
                    ) ??
                  []
                ),
              ]
                .join(" ")
                .toLowerCase();

              if (
                !haystack.includes(
                  query
                )
              ) {
                return false;
              }
            }

            return true;
          }
        );
      },
      [
        dailyRows,
        search,
        selectedCreator,
        selectedForm,
        selectedOutlet,
        selectedSection,
        selectedStatus,
      ]
    );


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

  const openIssues =
    dailyRows.reduce(
      (
        total,
        row
      ) =>
        total +
        (
          row.report
            ?.open_issue_count ??
          0
        ),
      0
    );


  function resetFilters() {
    setSelectedOutlet(
      "ALL"
    );

    setSelectedForm(
      "ALL"
    );

    setSelectedStatus(
      "ALL"
    );

    setSelectedSection(
      "ALL"
    );

    setSelectedCreator(
      "ALL"
    );

    setSearch(
      ""
    );
  }


  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
      <AutoRefresh
        intervalMs={
          60000
        }
      />

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-700">
              Operational Reports
            </p>

            <h1 className="mt-1 text-[28px] font-black tracking-tight md:text-4xl">
              Reports Center
              <span className="ml-2 align-middle text-[9px] font-black uppercase tracking-[0.14em] text-red-600">
                v2
              </span>
            </h1>

            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-neutral-500 md:text-sm md:leading-6">
              Opening, Closing and multi-section operational reports in one place.
            </p>
          </div>

          <div className="hidden text-right md:block">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Signed In
            </p>

            <p className="mt-1 text-xs font-bold text-neutral-700">
              {user.full_name}
            </p>

            <p className="mt-0.5 text-[10px] text-neutral-400">
              {user.role}
            </p>
          </div>
        </div>


        {/* ================================================== */}
        {/* SUMMARY */}
        {/* ================================================== */}

        <section className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <SummaryCard
            label="Completed"
            value={
              completed
            }
            sub={`${dailyRows.length} assigned reports`}
            variant="success"
          />

          <SummaryCard
            label="In Progress"
            value={
              inProgress
            }
            sub="Operational work ongoing"
            variant="warning"
          />

          <SummaryCard
            label="Not Submitted"
            value={
              notSubmitted
            }
            sub="Expected but no report"
            variant="neutral"
          />

          <SummaryCard
            label="Open Issues"
            value={
              openIssues
            }
            sub="Needs follow-up"
            variant="danger"
          />
        </section>


        {/* ================================================== */}
        {/* FILTERS */}
        {/* ================================================== */}

        <section className="mt-4 rounded-[18px] border border-neutral-200 bg-white p-3.5 shadow-sm md:p-5">

          {/* DATE */}

          <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                  Business Date
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(
                      today
                    )
                  }
                  className="text-[9px] font-black uppercase tracking-[0.12em] text-red-700"
                >
                  Today
                </button>
              </div>

              <div className="relative mt-1.5 h-10 max-w-md overflow-hidden rounded-[11px] border border-neutral-200 bg-neutral-50">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3.5">
                  <span className="text-[12px] font-bold text-neutral-700">
                    {formatDate(
                      selectedDate
                    )}
                  </span>

                  <span className="text-sm">
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
                      event.target.value
                    ) {
                      setSelectedDate(
                        event.target.value
                      );
                    }
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select report date"
                />
              </div>
            </div>

            <div className="flex gap-2">
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
                className="h-9 rounded-xl bg-neutral-100 px-3 text-[10px] font-bold text-neutral-600"
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
                className="h-9 rounded-xl bg-neutral-100 px-3 text-[10px] font-bold text-neutral-600 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>


          {/* SELECT FILTERS */}

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">

            <FilterSelect
              label="Outlet"
              value={
                selectedOutlet
              }
              onChange={
                setSelectedOutlet
              }
            >
              <option value="ALL">
                {user.allOutletAccess
                  ? "All Outlets"
                  : "Assigned Outlets"}
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
                    {outlet.name}
                  </option>
                )
              )}
            </FilterSelect>


            <FilterSelect
              label="Form"
              value={
                selectedForm
              }
              onChange={
                setSelectedForm
              }
            >
              <option value="ALL">
                All Forms
              </option>

              {forms.map(
                (
                  form
                ) => (
                  <option
                    key={
                      form.id
                    }
                    value={
                      form.id
                    }
                  >
                    {form.code}
                  </option>
                )
              )}
            </FilterSelect>


            <FilterSelect
              label="Status"
              value={
                selectedStatus
              }
              onChange={
                setSelectedStatus
              }
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
            </FilterSelect>


            <FilterSelect
              label="Section"
              value={
                selectedSection
              }
              onChange={
                setSelectedSection
              }
            >
              <option value="ALL">
                All Sections
              </option>

              {sectionOptions.map(
                ([
                  code,
                  name,
                ]) => (
                  <option
                    key={
                      code
                    }
                    value={
                      code
                    }
                  >
                    {name}
                  </option>
                )
              )}
            </FilterSelect>


            <FilterSelect
              label="Created By"
              value={
                selectedCreator
              }
              onChange={
                setSelectedCreator
              }
            >
              <option value="ALL">
                All Users
              </option>

              {creatorOptions.map(
                (
                  email
                ) => (
                  <option
                    key={
                      email
                    }
                    value={
                      email
                    }
                  >
                    {email}
                  </option>
                )
              )}
            </FilterSelect>

          </div>


          {/* SEARCH */}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">
                Search reports
              </span>

              <input
                type="search"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search report, outlet, section or email..."
                className="h-10 w-full rounded-[11px] border border-neutral-200 bg-neutral-50 px-3.5 text-[11px] font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-red-300"
              />
            </label>

            <button
              type="button"
              onClick={
                resetFilters
              }
              className="h-10 rounded-[11px] border border-neutral-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500"
            >
              Reset Filters
            </button>
          </div>
        </section>


        {/* ================================================== */}
        {/* RESULTS */}
        {/* ================================================== */}

        <section className="mt-4">

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Daily Operational Reports
              </p>

              <h2 className="mt-0.5 text-[16px] font-black text-neutral-900">
                {formatDate(
                  selectedDate
                )}
              </h2>
            </div>

            <p className="text-[10px] font-bold text-neutral-400">
              {filteredRows.length} result
              {filteredRows.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>


          {!filteredRows.length ? (
            <div className="rounded-[18px] border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm text-neutral-400">
                ○
              </div>

              <p className="mt-3 text-sm font-bold text-neutral-700">
                No reports found
              </p>

              <p className="mt-1 text-[11px] text-neutral-400">
                Try another date or filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredRows.map(
                (
                  row
                ) => (
                  <ReportCard
                    key={
                      row.key
                    }
                    row={
                      row
                    }
                    canReopen={
                      user.canReopen
                    }
                  />
                )
              )}
            </div>
          )}

        </section>

      </div>
    </main>
  );
}


// ============================================================
// REPORT CARD
// ============================================================

function ReportCard({
  row,
  canReopen,
}: {
  row: DailyRow;
  canReopen: boolean;
}) {
  const {
    outlet,
    form,
    report,
    status,
  } =
    row;

  const sectionCount =
    report
      ?.section_count ??
    0;

  const completedSections =
    report
      ?.completed_section_count ??
    0;

  const questionCount =
    report
      ?.question_count ??
    0;

  const answerCount =
    report
      ?.answer_count ??
    0;

  const photoCount =
    report
      ?.photo_count ??
    0;

  const answerProgress =
    percentage(
      answerCount,
      questionCount
    );

  return (
    <article className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-sm">

      {/* TOP */}

      <div className="p-4 md:p-5">

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-red-50 text-[10px] font-black text-red-700">
              {outlet.code}
            </div>

            <div className="min-w-0">
              <p className="truncate text-[14px] font-black text-neutral-900">
                {outlet.name}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-neutral-600">
                  {form.code}
                </span>

                <span className="truncate text-[9px] font-semibold text-neutral-400">
                  {form.name}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge
            status={
              status
            }
          />
        </div>


        {/* REPORT IDENTITY */}

        <div className="mt-4 rounded-[13px] bg-neutral-50 px-3.5 py-3">

          {report ? (
            <>
              <p className="break-all text-[11px] font-black text-neutral-750">
                {report.report_number}
              </p>

              <div className="mt-2 flex items-start gap-2">
                <span className="mt-0.5 text-[9px] text-neutral-400">
                  BY
                </span>

                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400">
                    Created By
                  </p>

                  <p className="mt-0.5 break-all text-[10px] font-bold text-neutral-600">
                    {report.created_by_email ||
                      "Unknown user"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black text-neutral-600">
                No report submitted
              </p>

              <p className="mt-1 text-[10px] leading-4 text-neutral-400">
                This form is assigned to the outlet but no report exists for the selected date.
              </p>
            </>
          )}
        </div>


        {/* METRICS */}

        <div className="mt-3 grid grid-cols-4 gap-2">

          <MiniMetric
            label="Answers"
            value={
              report
                ? questionCount
                  ? `${answerCount}/${questionCount}`
                  : String(
                      answerCount
                    )
                : "-"
            }
          />

          <MiniMetric
            label="Photos"
            value={
              report
                ? questionCount
                  ? `${photoCount}/${questionCount}`
                  : String(
                      photoCount
                    )
                : "-"
            }
          />

          <MiniMetric
            label="Issues"
            value={
              report
                ? String(
                    report.issue_count
                  )
                : "-"
            }
            danger={
              Boolean(
                report
                  ?.open_issue_count
              )
            }
          />

          <MiniMetric
            label="Sections"
            value={
              report
                ? `${completedSections}/${sectionCount}`
                : "-"
            }
          />

        </div>


        {/* ANSWER PROGRESS */}

        {report &&
          questionCount >
            0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold text-neutral-400">
                <span>
                  Checklist Progress
                </span>

                <span>
                  {answerProgress}%
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-800 transition-all"
                  style={{
                    width:
                      `${answerProgress}%`,
                  }}
                />
              </div>
            </div>
          )}

      </div>


      {/* SECTIONS */}

      {report &&
        report.sections.length >
          0 && (
          <details className="border-t border-neutral-100">

            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10px] font-black text-neutral-600 hover:bg-neutral-50 md:px-5">
              <span>
                Sections ·{" "}
                {
                  report.sections
                    .length
                }
              </span>

              <span className="text-neutral-300">
                View details ↓
              </span>
            </summary>

            <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/70 p-3 md:p-4">
              {report.sections.map(
                (
                  section
                ) => (
                  <SectionCard
                    key={
                      section.id
                    }
                    section={
                      section
                    }
                  />
                )
              )}
            </div>

          </details>
        )}


      {/* ACTION */}

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3 md:px-5">

        {report
          ?.pdf_storage_path ? (
          <a
            href={`/api/reports/${report.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center rounded-[10px] bg-neutral-900 px-3.5 text-[10px] font-black text-white transition hover:bg-black"
          >
            View PDF
          </a>
        ) : report ? (
          <span className="inline-flex min-h-9 items-center text-[10px] font-bold text-neutral-400">
            PDF not available
          </span>
        ) : (
          <span className="text-[10px] font-bold text-neutral-300">
            No actions
          </span>
        )}

        {report &&
          canReopen &&
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

        {report &&
          report.open_issue_count >
            0 && (
            <span className="ml-auto inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-red-700">
              {
                report.open_issue_count
              }{" "}
              open issue
              {report.open_issue_count ===
              1
                ? ""
                : "s"}
            </span>
          )}

      </div>

    </article>
  );
}


// ============================================================
// SECTION CARD
// ============================================================

function SectionCard({
  section,
}: {
  section: ReportSection;
}) {
  const status =
    normalizeStatus(
      section.status
    );

  const questionCount =
    section.question_count;

  const answerProgress =
    percentage(
      section.answer_count,
      questionCount
    );

  return (
    <div className="rounded-[13px] border border-neutral-200 bg-white p-3 shadow-sm">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">
          <p className="truncate text-[11px] font-black text-neutral-800">
            {section.name}
          </p>

          <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
            {section.code}
          </p>
        </div>

        <StatusBadge
          status={
            status
          }
          compact
        />
      </div>


      <div className="mt-2 rounded-[10px] bg-neutral-50 px-2.5 py-2">
        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400">
          Section Created By
        </p>

        <p className="mt-0.5 break-all text-[9px] font-bold text-neutral-600">
          {section.created_by_email ||
            "Not recorded"}
        </p>
      </div>


      <div className="mt-2 grid grid-cols-2 gap-2">

        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400">
            Answers
          </p>

          <p className="mt-0.5 text-[11px] font-black text-neutral-700">
            {questionCount
              ? `${section.answer_count}/${questionCount}`
              : section.answer_count}
          </p>
        </div>

        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400">
            Photos
          </p>

          <p className="mt-0.5 text-[11px] font-black text-neutral-700">
            {questionCount
              ? `${section.photo_count}/${questionCount}`
              : section.photo_count}
          </p>
        </div>

      </div>


      {questionCount >
        0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-700"
            style={{
              width:
                `${answerProgress}%`,
            }}
          />
        </div>
      )}

    </div>
  );
}


// ============================================================
// FILTER
// ============================================================

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange:
    (
      value: string
    ) => void;
  children:
    React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-1.5 h-10 w-full rounded-[11px] border border-neutral-200 bg-neutral-50 px-2.5 text-[10px] font-bold text-neutral-700 outline-none transition focus:border-red-300"
      >
        {children}
      </select>
    </label>
  );
}


// ============================================================
// METRIC
// ============================================================

function MiniMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-[11px] px-2.5 py-2 ${
        danger
          ? "bg-red-50"
          : "bg-neutral-50"
      }`}
    >
      <p className="truncate text-[7px] font-black uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-[12px] font-black ${
          danger
            ? "text-red-700"
            : "text-neutral-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}


// ============================================================
// SUMMARY
// ============================================================

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
    success: {
      shell:
        "border-emerald-100 bg-emerald-50/80",
      icon:
        "bg-emerald-100 text-emerald-700",
      value:
        "text-emerald-800",
      symbol: "✓",
    },

    warning: {
      shell:
        "border-amber-100 bg-amber-50/80",
      icon:
        "bg-amber-100 text-amber-700",
      value:
        "text-amber-800",
      symbol: "◷",
    },

    neutral: {
      shell:
        "border-slate-200 bg-slate-50",
      icon:
        "bg-slate-200/70 text-slate-600",
      value:
        "text-slate-800",
      symbol: "○",
    },

    danger: {
      shell:
        "border-red-100 bg-red-50/80",
      icon:
        "bg-red-100 text-red-700",
      value:
        "text-red-800",
      symbol: "!",
    },
  };

  const style =
    styles[variant];

  return (
    <div
      className={`rounded-[16px] border p-3 shadow-sm ${style.shell}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </p>

        <span
          className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black ${style.icon}`}
        >
          {style.symbol}
        </span>
      </div>

      <p
        className={`mt-1.5 text-[25px] font-black leading-none tracking-tight ${style.value}`}
      >
        {value}
      </p>

      <p className="mt-1 truncate text-[9px] font-semibold text-neutral-500">
        {sub}
      </p>
    </div>
  );
}


// ============================================================
// STATUS
// ============================================================

function StatusBadge({
  status,
  compact = false,
}: {
  status: RowStatus;
  compact?: boolean;
}) {
  const size =
    compact
      ? "px-2 py-0.5 text-[7px]"
      : "px-2.5 py-1 text-[8px]";

  if (
    status ===
    "completed"
  ) {
    return (
      <span
        className={`inline-flex shrink-0 rounded-full bg-emerald-50 font-black uppercase tracking-[0.06em] text-emerald-700 ${size}`}
      >
        Completed
      </span>
    );
  }

  if (
    status ===
    "in_progress"
  ) {
    return (
      <span
        className={`inline-flex shrink-0 rounded-full bg-amber-50 font-black uppercase tracking-[0.06em] text-amber-700 ${size}`}
      >
        In Progress
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 rounded-full bg-neutral-100 font-black uppercase tracking-[0.06em] text-neutral-500 ${size}`}
    >
      Not Submitted
    </span>
  );
}
