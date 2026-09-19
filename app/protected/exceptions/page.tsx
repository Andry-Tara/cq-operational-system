import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


type ExceptionSource =
  | "operations"
  | "audit";


type ExceptionRow = {
  key: string;
  source: ExceptionSource;

  outletId: string;
  outletName: string;

  title: string;
  description: string | null;

  severity: string;
  status: string;

  area: string;
  reference: string;

  eventDate: string;
  createdAt: string;

  href: string;
};


function jakartaBusinessDate(
  daysAgo = 0
) {
  const now =
    new Date();

  now.setUTCDate(
    now.getUTCDate() -
      daysAgo
  );

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
  ).format(
    now
  );
}


function formatDate(
  value: string
) {
  try {
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
  } catch {
    return value;
  }
}


function normalizedSeverity(
  value: unknown
) {
  const severity =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "critical",
      "major",
      "medium",
      "minor",
    ].includes(
      severity
    )
  ) {
    return severity;
  }

  return "medium";
}


function normalizedStatus(
  value: unknown
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function severityClass(
  severity: string
) {
  if (
    severity ===
    "critical"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    severity ===
    "major"
  ) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (
    severity ===
    "medium"
  ) {
    return "border-[#D8D355]/70 bg-[#D8D355]/15 text-[#66620A]";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}


function statusClass(
  status: string
) {
  if (
    status ===
    "closed"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status ===
    "verified"
  ) {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (
    status ===
    "resolved"
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (
    status ===
    "completed"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status ===
    "in_progress"
  ) {
    return "border-[#D8D355]/70 bg-[#D8D355]/15 text-[#66620A]";
  }

  if (
    status ===
    "assigned"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (
    status ===
    "finding"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}


function sourceLabel(
  source: ExceptionSource
) {
  return source ===
    "audit"
    ? "Audit"
    : "Operations";
}


// ============================================================
// BATCH LOADER
//
// Supabase PostgREST builders are PromiseLike / thenable,
// not native Promise instances.
// ============================================================

async function loadInBatches({
  ids,
  loader,
}: {
  ids: string[];
  loader:
    (
      ids: string[]
    ) =>
      PromiseLike<any>;
}) {
  if (
    !ids.length
  ) {
    return [];
  }

  const batchSize =
    200;

  const batches:
    string[][] =
    [];

  for (
    let index = 0;
    index <
    ids.length;
    index +=
      batchSize
  ) {
    batches.push(
      ids.slice(
        index,
        index +
          batchSize
      )
    );
  }

  const results =
    await Promise.all(
      batches.map(
        batch =>
          loader(
            batch
          )
      )
    );

  const rows:
    any[] =
    [];

  for (
    const result
    of results
  ) {
    if (
      result.error
    ) {
      throw result.error;
    }

    rows.push(
      ...(
        result.data ??
        []
      )
    );
  }

  return rows;
}


export default async function ExceptionCenterPage({
  searchParams,
}: {
  searchParams:
    Promise<{
      source?: string;
      severity?: string;
      status?: string;
      outlet?: string;
      days?: string;
      q?: string;
    }>;
}) {
  const {
    profile,
    isAdmin,
    permissionCodes,
  } =
    await getAccessContext();


  const canView =
    isAdmin ||
    permissionCodes.includes(
      "exceptions.view"
    );


  if (
    !canView
  ) {
    redirect(
      "/protected"
    );
  }


  const params =
    await searchParams;


  const requestedDays =
    Number(
      params.days ||
      30
    );


  const days =
    [
      30,
      60,
      90,
    ].includes(
      requestedDays
    )
      ? requestedDays
      : 30;


  const selectedSource =
    String(
      params.source ||
      "ALL"
    )
      .trim()
      .toUpperCase();


  const selectedSeverity =
    String(
      params.severity ||
      "all"
    )
      .trim()
      .toLowerCase();


  const selectedStatus =
    String(
      params.status ||
      "all"
    )
      .trim()
      .toLowerCase();


  const selectedOutlet =
    String(
      params.outlet ||
      "ALL"
    )
      .trim();


  const search =
    String(
      params.q ||
      ""
    )
      .trim()
      .toLowerCase();


  const startDate =
    jakartaBusinessDate(
      days -
        1
    );


  const admin =
    createAdminClient();


  const {
    data:
      outletData,
    error:
      outletError,
  } =
    await admin
      .from(
        "outlets"
      )
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
        "is_active",
        true
      )
      .order(
        "name"
      );


  if (
    outletError
  ) {
    throw outletError;
  }


  const outlets =
    outletData ??
    [];


  const outletIds =
    outlets.map(
      outlet =>
        String(
          outlet.id
        )
    );


  if (
    !outletIds.length
  ) {
    return (
      <main className="min-h-screen bg-[#F6F4F1] p-6">
        <div className="mx-auto max-w-xl rounded-[28px] border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-black">
            Exception Center
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            No active outlets available.
          </p>
        </div>
      </main>
    );
  }


  const outletById =
    new Map(
      outlets.map(
        outlet => [
          String(
            outlet.id
          ),
          outlet,
        ]
      )
    );


  const [
    reportResult,
    formResult,
    auditSessionResult,
  ] =
    await Promise.all([
      admin
        .from(
          "reports"
        )
        .select(`
          id,
          outlet_id,
          form_id,
          report_number,
          business_date,
          status,
          created_at
        `)
        .in(
          "outlet_id",
          outletIds
        )
        .gte(
          "business_date",
          startDate
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1500
        ),

      admin
        .from(
          "forms"
        )
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "organization_id",
          profile.organization_id
        ),

      admin
        .from(
          "audit_sessions"
        )
        .select(`
          id,
          outlet_id,
          audit_number,
          audit_date,
          status,
          submitted_at
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "status",
          "submitted"
        )
        .in(
          "outlet_id",
          outletIds
        )
        .gte(
          "audit_date",
          startDate
        )
        .order(
          "submitted_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1000
        ),
    ]);


  if (
    reportResult.error
  ) {
    throw reportResult.error;
  }

  if (
    formResult.error
  ) {
    throw formResult.error;
  }

  if (
    auditSessionResult.error
  ) {
    throw auditSessionResult.error;
  }


  const reports =
    reportResult.data ??
    [];

  const forms =
    formResult.data ??
    [];

  const auditSessions =
    auditSessionResult.data ??
    [];


  const reportById =
    new Map(
      reports.map(
        report => [
          String(
            report.id
          ),
          report,
        ]
      )
    );


  const formById =
    new Map(
      forms.map(
        form => [
          String(
            form.id
          ),
          form,
        ]
      )
    );


  const sessionById =
    new Map(
      auditSessions.map(
        session => [
          String(
            session.id
          ),
          session,
        ]
      )
    );


  const reportIds =
    reports.map(
      report =>
        String(
          report.id
        )
    );


  const sessionIds =
    auditSessions.map(
      session =>
        String(
          session.id
        )
    );


  const [
    issueRows,
    auditFindingRows,
  ] =
    await Promise.all([
      loadInBatches({
        ids:
          reportIds,

        loader:
          batch =>
            admin
              .from(
                "issues"
              )
              .select(`
                id,
                report_id,
                report_section_id,
                title,
                description,
                severity,
                status,
                created_at
              `)
              .in(
                "report_id",
                batch
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              ),
      }),

      loadInBatches({
        ids:
          sessionIds,

        loader:
          batch =>
            admin
              .from(
                "audit_findings"
              )
              .select(`
                id,
                audit_session_id,
                question_text_snapshot,
                area_name_snapshot,
                finding_category_name_snapshot,
                risk_level,
                notes,
                created_at
              `)
              .in(
                "audit_session_id",
                batch
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              ),
      }),
    ]);



  // ==========================================================
  // EXCEPTION WORKFLOW STATE
  // ==========================================================

  const operationIssueIds =
    issueRows.map(
      issue =>
        String(
          issue.id
        )
    );


  const auditFindingIds =
    auditFindingRows.map(
      finding =>
        String(
          finding.id
        )
    );


  const [
    operationWorkflowRows,
    auditWorkflowRows,
  ] =
    await Promise.all([
      loadInBatches({
        ids:
          operationIssueIds,

        loader:
          batch =>
            admin
              .from(
                "exception_workflows"
              )
              .select(`
                source_type,
                source_id,
                status,
                assigned_to,
                due_at,
                sla_hours,
                escalated_at
              `)
              .eq(
                "organization_id",
                profile.organization_id
              )
              .eq(
                "source_type",
                "operations_issue"
              )
              .in(
                "source_id",
                batch
              ),
      }),

      loadInBatches({
        ids:
          auditFindingIds,

        loader:
          batch =>
            admin
              .from(
                "exception_workflows"
              )
              .select(`
                source_type,
                source_id,
                status,
                assigned_to,
                due_at,
                sla_hours,
                escalated_at
              `)
              .eq(
                "organization_id",
                profile.organization_id
              )
              .eq(
                "source_type",
                "audit_finding"
              )
              .in(
                "source_id",
                batch
              ),
      }),
    ]);


  const workflowBySource =
    new Map(
      [
        ...operationWorkflowRows,
        ...auditWorkflowRows,
      ].map(
        workflow => [
          `${workflow.source_type}:${workflow.source_id}`,
          workflow,
        ]
      )
    );


  const exceptions:
    ExceptionRow[] =
    [];


  for (
    const issue
    of issueRows
  ) {
    const report =
      reportById.get(
        String(
          issue.report_id
        )
      );

    if (
      !report
    ) {
      continue;
    }


    const outlet =
      outletById.get(
        String(
          report.outlet_id
        )
      );


    const form =
      formById.get(
        String(
          report.form_id
        )
      );


    exceptions.push({
      key:
        `operations:${issue.id}`,

      source:
        "operations",

      outletId:
        String(
          report.outlet_id
        ),

      outletName:
        String(
          outlet?.name ||
          "Unknown Outlet"
        ),

      title:
        String(
          issue.title ||
          "Operational Issue"
        ),

      description:
        issue.description
          ? String(
              issue.description
            )
          : null,

      severity:
        normalizedSeverity(
          issue.severity
        ),

      status:
        normalizedStatus(
          workflowBySource.get(
            `operations_issue:${issue.id}`
          )?.status ||
          issue.status
        ) ||
        "open",

      area:
        String(
          form?.name ||
          form?.code ||
          "Operational Report"
        ),

      reference:
        String(
          report.report_number ||
          "Report"
        ),

      eventDate:
        String(
          report.business_date
        ),

      createdAt:
        String(
          issue.created_at ||
          `${report.business_date}T00:00:00`
        ),

      href:
        `/protected/exceptions/operations/${issue.id}`,
    });
  }


  for (
    const finding
    of auditFindingRows
  ) {
    const session =
      sessionById.get(
        String(
          finding.audit_session_id
        )
      );

    if (
      !session
    ) {
      continue;
    }


    const outlet =
      outletById.get(
        String(
          session.outlet_id
        )
      );


    exceptions.push({
      key:
        `audit:${finding.id}`,

      source:
        "audit",

      outletId:
        String(
          session.outlet_id
        ),

      outletName:
        String(
          outlet?.name ||
          "Unknown Outlet"
        ),

      title:
        String(
          finding.question_text_snapshot ||
          finding.finding_category_name_snapshot ||
          "Audit Finding"
        ),

      description:
        finding.notes
          ? String(
              finding.notes
            )
          : null,

      severity:
        normalizedSeverity(
          finding.risk_level
        ),

      status:
        normalizedStatus(
          workflowBySource.get(
            `audit_finding:${finding.id}`
          )?.status ||
          "open"
        ) ||
        "open",

      area:
        String(
          finding.area_name_snapshot ||
          finding.finding_category_name_snapshot ||
          "Audit"
        ),

      reference:
        String(
          session.audit_number ||
          "Audit"
        ),

      eventDate:
        String(
          session.audit_date
        ),

      createdAt:
        String(
          finding.created_at ||
          session.submitted_at ||
          `${session.audit_date}T00:00:00`
        ),

      href:
        `/protected/exceptions/audit/${finding.id}`,
    });
  }


  exceptions.sort(
    (
      left,
      right
    ) =>
      right.createdAt.localeCompare(
        left.createdAt
      )
  );


  const filtered =
    exceptions.filter(
      item => {
        if (
          selectedSource !==
            "ALL" &&
          item.source.toUpperCase() !==
            selectedSource
        ) {
          return false;
        }


        if (
          selectedSeverity !==
            "all" &&
          item.severity !==
            selectedSeverity
        ) {
          return false;
        }


        if (
          selectedOutlet !==
            "ALL" &&
          item.outletId !==
            selectedOutlet
        ) {
          return false;
        }


        if (
          selectedStatus ===
            "active" &&
          ![
            "open",
            "in_progress",
          ].includes(
            item.status
          )
        ) {
          return false;
        }


        if (
          selectedStatus ===
            "resolved" &&
          ![
            "closed",
            "resolved",
            "completed",
          ].includes(
            item.status
          )
        ) {
          return false;
        }


        if (
          selectedStatus ===
            "finding" &&
          item.status !==
            "finding"
        ) {
          return false;
        }


        if (
          search
        ) {
          const haystack =
            [
              item.title,
              item.description,
              item.outletName,
              item.area,
              item.reference,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase();


          if (
            !haystack.includes(
              search
            )
          ) {
            return false;
          }
        }


        return true;
      }
    );


  const activeOperational =
    filtered.filter(
      item =>
        item.source ===
          "operations" &&
        [
          "open",
          "in_progress",
        ].includes(
          item.status
        )
    ).length;


  const highRisk =
    filtered.filter(
      item =>
        [
          "critical",
          "major",
        ].includes(
          item.severity
        )
    ).length;


  const auditFindingCount =
    filtered.filter(
      item =>
        item.source ===
        "audit"
    ).length;


  const resolvedOperational =
    filtered.filter(
      item =>
        item.source ===
          "operations" &&
        [
          "closed",
          "resolved",
          "completed",
        ].includes(
          item.status
        )
    ).length;


  // ==========================================================
  // FILTER CONTEXT
  // ==========================================================

  const selectedOutletLabel =
    selectedOutlet ===
      "ALL"
      ? "All Outlets"
      : String(
          outletById.get(
            selectedOutlet
          )?.name ||
          "Selected Outlet"
        );


  const filterContext =
    [
      selectedOutletLabel,

      selectedSource !==
        "ALL"
        ? selectedSource ===
            "AUDIT"
          ? "Audit"
          : "Operations"
        : "All Sources",

      selectedSeverity !==
        "all"
        ? selectedSeverity
            .charAt(
              0
            )
            .toUpperCase() +
          selectedSeverity.slice(
            1
          )
        : null,

      selectedStatus !==
        "all"
        ? selectedStatus ===
            "active"
          ? "Active"
          : selectedStatus ===
              "resolved"
            ? "Resolved"
            : "Audit Finding"
        : null,

      `Last ${days} Days`,

      `${filtered.length} exception${
        filtered.length ===
        1
          ? ""
          : "s"
      }`,
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );


  const metrics = [
    {
      label:
        "Filtered Results",
      value:
        filtered.length,
      helper:
        `Last ${days} days`,
    },
    {
      label:
        "Active Operations",
      value:
        activeOperational,
      helper:
        "Open + In Progress",
    },
    {
      label:
        "High Risk",
      value:
        highRisk,
      helper:
        "Critical + Major",
    },
    {
      label:
        "Audit Findings",
      value:
        auditFindingCount,
      helper:
        "Submitted audits",
    },
    {
      label:
        "Resolved Ops",
      value:
        resolvedOperational,
      helper:
        "Closed / Resolved",
    },
  ];


  return (
    <main className="min-h-screen bg-[#F6F4F1]/75 text-[#292824]">
      <div className="mx-auto w-full max-w-[1540px] px-4 py-7 sm:px-6 md:px-8 md:py-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D8D355]" />

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                Management Intelligence
              </p>
            </div>

            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] md:text-5xl">
              Exception Center
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-medium text-[#777169]">
              Operational issues and audit findings across all active outlets.
            </p>
          </div>

          <Link
            href="/protected"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E3DED6] bg-white px-4 text-xs font-black text-[#48453F]"
          >
            ← Dashboard
          </Link>
        </header>


        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(
            metric => (
              <div
                key={
                  metric.label
                }
                className="rounded-[24px] border border-[#E5E0D9] bg-white p-5 shadow-[0_8px_24px_rgba(79,73,64,0.025)]"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8D877E]">
                  {
                    metric.label
                  }
                </p>

                <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  {
                    metric.value
                  }
                </p>

                <p className="mt-1 text-xs font-semibold text-[#777169]">
                  {
                    metric.helper
                  }
                </p>
              </div>
            )
          )}
        </section>


        <section className="mt-6 rounded-[28px] border border-[#E5E0D9] bg-white p-4 shadow-sm md:p-5">
          <form
            method="get"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
          >
            <select
              name="source"
              defaultValue={
                selectedSource
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold"
            >
              <option value="ALL">
                All Sources
              </option>
              <option value="OPERATIONS">
                Operations
              </option>
              <option value="AUDIT">
                Audit
              </option>
            </select>


            <select
              name="severity"
              defaultValue={
                selectedSeverity
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold"
            >
              <option value="all">
                All Severity
              </option>
              <option value="critical">
                Critical
              </option>
              <option value="major">
                Major
              </option>
              <option value="medium">
                Medium
              </option>
              <option value="minor">
                Minor
              </option>
            </select>


            <select
              name="status"
              defaultValue={
                selectedStatus
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold"
            >
              <option value="all">
                All Status
              </option>
              <option value="active">
                Active Operations
              </option>
              <option value="resolved">
                Resolved Operations
              </option>
              <option value="finding">
                Audit Finding
              </option>
            </select>


            <select
              name="outlet"
              defaultValue={
                selectedOutlet
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold"
            >
              <option value="ALL">
                All Outlets
              </option>

              {outlets.map(
                outlet => (
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


            <select
              name="days"
              defaultValue={
                String(
                  days
                )
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold"
            >
              <option value="30">
                Last 30 Days
              </option>
              <option value="60">
                Last 60 Days
              </option>
              <option value="90">
                Last 90 Days
              </option>
            </select>


            <div className="flex gap-2">
              <input
                name="q"
                defaultValue={
                  params.q ||
                  ""
                }
                placeholder="Search..."
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-[#292824] placeholder:text-neutral-400"
              />

              <button
                type="submit"
                className="h-11 rounded-xl bg-[#D8D355] px-4 text-xs font-black text-[#39380C]"
              >
                Apply
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-col gap-2 border-t border-[#EEEAE4] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-bold text-[#918B82]">
              {
                filterContext
              }
            </p>

            <Link
              href="/protected/exceptions"
              className="text-[10px] font-black text-red-700 transition hover:text-red-800"
            >
              Clear Filters
            </Link>
          </div>
        </section>


        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#918B82]">
                Exception Feed
              </p>

              <h2 className="mt-1 text-xl font-black">
                {
                  filtered.length
                } result
                {
                  filtered.length ===
                  1
                    ? ""
                    : "s"
                }
              </h2>
            </div>

            <p className="text-right text-[10px] font-semibold text-neutral-400">
              Exception Workflow · V2
            </p>
          </div>


          {!filtered.length ? (
            <div className="rounded-[28px] border border-[#E5E0D9] bg-white px-6 py-14 text-center">
              <p className="text-sm font-black">
                No exceptions found
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Try another filter or date window.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(
                item => (
                  <Link
                    key={
                      item.key
                    }
                    href={
                      item.href
                    }
                    className="group rounded-[24px] border border-[#E5E0D9] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D8D2C8] hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-600">
                            {
                              sourceLabel(
                                item.source
                              )
                            }
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${severityClass(
                              item.severity
                            )}`}
                          >
                            {
                              item.severity
                            }
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${statusClass(
                              item.status
                            )}`}
                          >
                            {
                              item.status.replace(
                                "_",
                                " "
                              )
                            }
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-black">
                          {
                            item.title
                          }
                        </h3>

                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#777169]">
                            {
                              item.description
                            }
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-neutral-400">
                          <span>
                            {
                              item.outletName
                            }
                          </span>

                          <span>
                            {
                              item.area
                            }
                          </span>

                          <span>
                            {
                              item.reference
                            }
                          </span>

                          <span>
                            {
                              formatDate(
                                item.eventDate
                              )
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-xs font-black text-red-700">
                        Open Detail
                        <span className="transition group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>


        <div className="mt-6 rounded-[22px] border border-dashed border-[#D8D2CA] bg-white/60 px-5 py-4 text-xs leading-5 text-[#777169]">
          V1 uses the existing operational issue lifecycle and submitted audit findings.
          Assignment, due date, SLA, escalation and audit remediation will follow in V2.
        </div>
      </div>
    </main>
  );
}
