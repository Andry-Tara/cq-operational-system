import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  ExceptionWorkflowPanel,
} from "@/components/exceptions/exception-workflow-panel";


const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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
    return "border-[#D8D355] bg-[#F8F7DF] text-[#66620A]";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
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
        "long",

      year:
        "numeric",
    }
  ).format(
    new Date(
      `${value}T12:00:00`
    )
  );
}


export default async function ExceptionDetailPage({
  params,
}: {
  params:
    Promise<{
      source: string;
      id: string;
    }>;
}) {
  const resolvedParams =
    await params;


  const source =
    String(
      resolvedParams?.source ??
      ""
    )
      .trim()
      .toLowerCase();


  const id =
    String(
      resolvedParams?.id ??
      ""
    )
      .trim()
      .toLowerCase();


  if (
    ![
      "operations",
      "audit",
    ].includes(
      source
    ) ||
    !UUID.test(
      id
    )
  ) {
    redirect(
      "/protected/exceptions"
    );
}


  const {
    user,
    profile,
    isAdmin,
    permissionCodes,
  } =
    await getAccessContext();


  const canManage =
    isAdmin ||
    permissionCodes.includes(
      "exceptions.manage"
    );


  const hasOrganizationView =
    isAdmin ||
    permissionCodes.includes(
      "exceptions.view"
    );


  const admin =
    createAdminClient();


  const sourceType =
    source ===
      "operations"
      ? "operations_issue"
      : "audit_finding";


  let isAssignedPic =
    false;


  if (!canManage) {
    const {
      data:
        accessWorkflow,
      error:
        accessWorkflowError,
    } =
      await admin
        .from(
          "exception_workflows"
        )
        .select(`
          id,
          outlet_id,
          assigned_to
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "source_type",
          sourceType
        )
        .eq(
          "source_id",
          id
        )
        .eq(
          "assigned_to",
          user.id
        )
        .maybeSingle();


    if (
      accessWorkflowError
    ) {
      throw accessWorkflowError;
    }


    if (
      accessWorkflow
    ) {
      const {
        data:
          assignedOutletAccess,
        error:
          assignedOutletAccessError,
      } =
        await admin
          .from(
            "user_outlets"
          )
          .select(
            "outlet_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "outlet_id",
            accessWorkflow.outlet_id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();


      if (
        assignedOutletAccessError
      ) {
        throw assignedOutletAccessError;
      }


      isAssignedPic =
        Boolean(
          assignedOutletAccess
        );
    }
  }


  if (
    !hasOrganizationView &&
    !isAssignedPic
  ) {
    redirect(
      "/protected"
    );
  }


  const canExecute =
    canManage ||
    isAssignedPic;


  let title =
    "Exception";

  let description:
    string | null =
    null;

  let severity =
    "medium";

  let exceptionOutletId:
    string | null =
    null;

  let outletName =
    "Unknown Outlet";

  let area =
    "-";

  let reference =
    "-";

  let eventDate =
    "";

  let sourceHref =
    "/protected/exceptions";


  // ==========================================================
  // OPERATIONS SOURCE
  // ==========================================================

  if (
    sourceType ===
      "operations_issue"
  ) {
    const {
      data:
        issue,
      error:
        issueError,
    } =
      await admin
        .from(
          "issues"
        )
        .select(`
          id,
          report_id,
          title,
          description,
          severity,
          status,
          created_at
        `)
        .eq(
          "id",
          id
        )
        .maybeSingle();


    if (
      issueError
    ) {
      throw issueError;
    }


    if (!issue) {
      redirect(
      "/protected/exceptions"
    );
}


    const {
      data:
        report,
      error:
        reportError,
    } =
      await admin
        .from(
          "reports"
        )
        .select(`
          id,
          outlet_id,
          form_id,
          report_number,
          business_date
        `)
        .eq(
          "id",
          issue.report_id
        )
        .maybeSingle();


    if (
      reportError
    ) {
      throw reportError;
    }


    if (!report) {
      redirect(
      "/protected/exceptions"
    );
}


    const [
      outletResult,
      formResult,
    ] =
      await Promise.all([
        admin
          .from(
            "outlets"
          )
          .select(`
            id,
            name,
            organization_id
          `)
          .eq(
            "id",
            report.outlet_id
          )
          .eq(
            "organization_id",
            profile.organization_id
          )
          .maybeSingle(),

        admin
          .from(
            "forms"
          )
          .select(`
            id,
            name,
            code
          `)
          .eq(
            "id",
            report.form_id
          )
          .eq(
            "organization_id",
            profile.organization_id
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


    if (
      !outletResult.data
    ) {
      redirect(
      "/protected/exceptions"
    );
}


    title =
      String(
        issue.title ||
        "Operational Issue"
      );


    description =
      issue.description
        ? String(
            issue.description
          )
        : null;


    severity =
      String(
        issue.severity ||
        "medium"
      )
        .trim()
        .toLowerCase();


    exceptionOutletId =
      String(
        outletResult
          .data
          .id
      );


    outletName =
      String(
        outletResult
          .data
          .name ||
        "Unknown Outlet"
      );


    area =
      String(
        formResult
          .data
          ?.name ||
        formResult
          .data
          ?.code ||
        "Operational Report"
      );


    reference =
      String(
        report.report_number ||
        "Report"
      );


    eventDate =
      String(
        report.business_date
      );


    sourceHref =
      `/protected/reports?date=${report.business_date}&detail=${report.id}`;
  }


  // ==========================================================
  // AUDIT SOURCE
  // ==========================================================

  if (
    sourceType ===
      "audit_finding"
  ) {
    const {
      data:
        finding,
      error:
        findingError,
    } =
      await admin
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
        .eq(
          "id",
          id
        )
        .maybeSingle();


    if (
      findingError
    ) {
      throw findingError;
    }


    if (!finding) {
      redirect(
      "/protected/exceptions"
    );
}


    const {
      data:
        session,
      error:
        sessionError,
    } =
      await admin
        .from(
          "audit_sessions"
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          audit_number,
          audit_date,
          status
        `)
        .eq(
          "id",
          finding.audit_session_id
        )
        .eq(
          "organization_id",
          profile.organization_id
        )
        .maybeSingle();


    if (
      sessionError
    ) {
      throw sessionError;
    }


    if (!session) {
      redirect(
      "/protected/exceptions"
    );
}


    const {
      data:
        outlet,
      error:
        outletError,
    } =
      await admin
        .from(
          "outlets"
        )
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          session.outlet_id
        )
        .eq(
          "organization_id",
          profile.organization_id
        )
        .maybeSingle();


    if (
      outletError
    ) {
      throw outletError;
    }


    if (!outlet) {
      redirect(
      "/protected/exceptions"
    );
}


    title =
      String(
        finding.question_text_snapshot ||
        finding.finding_category_name_snapshot ||
        "Audit Finding"
      );


    description =
      finding.notes
        ? String(
            finding.notes
          )
        : null;


    severity =
      String(
        finding.risk_level ||
        "medium"
      )
        .trim()
        .toLowerCase();


    exceptionOutletId =
      String(
        outlet.id
      );


    outletName =
      String(
        outlet.name ||
        "Unknown Outlet"
      );


    area =
      String(
        finding.area_name_snapshot ||
        finding.finding_category_name_snapshot ||
        "Outlet Audit"
      );


    reference =
      String(
        session.audit_number ||
        "Audit"
      );


    eventDate =
      String(
        session.audit_date
      );


    sourceHref =
      `/protected/audit/${session.id}/report`;
  }


  // ==========================================================
  // WORKFLOW
  // ==========================================================

  const {
    data:
      workflow,
    error:
      workflowError,
  } =
    await admin
      .from(
        "exception_workflows"
      )
      .select(`
        id,
        organization_id,
        outlet_id,
        source_type,
        source_id,
        status,
        assigned_to,
        assigned_by,
        assigned_at,
        due_at,
        sla_hours,
        escalated_at,
        escalated_by,
        resolution_note,
        resolved_at,
        resolved_by,
        verified_at,
        verified_by,
        closed_at,
        closed_by,
        created_at,
        updated_at
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "source_type",
        sourceType
      )
      .eq(
        "source_id",
        id
      )
      .maybeSingle();


  if (
    workflowError
  ) {
    throw workflowError;
  }


  let events:
    any[] =
    [];


  if (
    workflow?.id
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "exception_workflow_events"
        )
        .select(`
          id,
          event_type,
          from_status,
          to_status,
          actor_user_id,
          note,
          created_at
        `)
        .eq(
          "workflow_id",
          workflow.id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          100
        );


    if (error) {
      throw error;
    }


    events =
      data ??
      [];
  }


  // ==========================================================
  // PIC CANDIDATES
  //
  // Exception PICs are outlet scoped.
  // Do not expose every organization user in this selector.
  // ==========================================================

  if (
    !exceptionOutletId
  ) {
    throw new Error(
      "Exception outlet could not be resolved."
    );
  }


  const {
    data:
      userOutletRows,
    error:
      userOutletError,
  } =
    await admin
      .from(
        "user_outlets"
      )
      .select(`
        user_id
      `)
      .eq(
        "outlet_id",
        exceptionOutletId
      )
      .eq(
        "is_active",
        true
      );


  if (
    userOutletError
  ) {
    throw userOutletError;
  }


  const outletUserIds =
    Array.from(
      new Set(
        (
          userOutletRows ??
          []
        )
          .map(
            row =>
              String(
                row.user_id ||
                ""
              )
          )
          .filter(
            Boolean
          )
      )
    );


  let profiles:
    any[] =
    [];


  if (
    outletUserIds.length
  ) {
    const {
      data:
        profileRows,
      error:
        profileError,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(`
          id,
          full_name,
          job_title,
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
        .in(
          "id",
          outletUserIds
        )
        .order(
          "full_name"
        );


    if (
      profileError
    ) {
      throw profileError;
    }


    profiles =
      profileRows ??
      [];
  }


  const profileById =
    new Map(
      profiles.map(
        row => [
          String(
            row.id
          ),
          row,
        ]
      )
    );


  const assignedName =
    workflow
      ?.assigned_to
      ? String(
          profileById.get(
            String(
              workflow.assigned_to
            )
          )
            ?.full_name ||
          "Assigned User"
        )
      : null;


  const eventRows =
    events.map(
      event => ({
        id:
          String(
            event.id
          ),

        eventType:
          String(
            event.event_type
          ),

        fromStatus:
          event.from_status
            ? String(
                event.from_status
              )
            : null,

        toStatus:
          event.to_status
            ? String(
                event.to_status
              )
            : null,

        note:
          event.note
            ? String(
                event.note
              )
            : null,

        actorName:
          event.actor_user_id
            ? String(
                profileById.get(
                  String(
                    event.actor_user_id
                  )
                )
                  ?.full_name ||
                "System User"
              )
            : "System",

        createdAt:
          String(
            event.created_at
          ),
      })
    );


  const activeStatuses =
    new Set([
      "open",
      "assigned",
      "in_progress",
    ]);


  const isOverdue =
    Boolean(
      workflow?.due_at &&
      activeStatuses.has(
        String(
          workflow.status
        )
      ) &&
      new Date(
        workflow.due_at
      ).getTime() <
        Date.now()
    );


  return (
    <main className="min-h-screen bg-[#F6F4F1] text-[#292824]">

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 md:py-9">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <Link
              href="/protected/exceptions"
              className="text-xs font-black text-red-700 transition hover:text-red-800"
            >
              ← Exception Center
            </Link>


            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              Exception Management
            </p>


            <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">
              {
                title
              }
            </h1>


            {
              description && (
                <p className="mt-3 max-w-4xl text-sm leading-6 text-[#6F6961]">
                  {
                    description
                  }
                </p>
              )
            }

          </div>


          <Link
            href={
              sourceHref
            }
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DDD8D0] bg-white px-5 text-xs font-black text-[#292824] transition hover:border-[#D8D355]"
          >
            Open Source Report →
          </Link>

        </div>


        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

          <div className="rounded-2xl border border-[#E6E1DA] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
              Outlet
            </p>

            <p className="mt-2 text-sm font-black">
              {
                outletName
              }
            </p>
          </div>


          <div className="rounded-2xl border border-[#E6E1DA] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
              Area
            </p>

            <p className="mt-2 text-sm font-black">
              {
                area
              }
            </p>
          </div>


          <div className="rounded-2xl border border-[#E6E1DA] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
              Reference
            </p>

            <p className="mt-2 truncate text-sm font-black">
              {
                reference
              }
            </p>
          </div>


          <div className="rounded-2xl border border-[#E6E1DA] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
              Date
            </p>

            <p className="mt-2 text-sm font-black">
              {
                eventDate
                  ? dateLabel(
                      eventDate
                    )
                  : "-"
              }
            </p>
          </div>


          <div className="rounded-2xl border border-[#E6E1DA] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
              Severity
            </p>

            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${severityClass(
                severity
              )}`}
            >
              {
                severity
              }
            </span>
          </div>

        </section>


        <div className="mt-5">

          <ExceptionWorkflowPanel
            sourceType={
              sourceType
            }
            sourceId={
              id
            }
            workflow={
              workflow
            }
            profiles={
              profiles.map(
                row => ({
                  id:
                    String(
                      row.id
                    ),

                  fullName:
                    String(
                      row.full_name ||
                      "Operational User"
                    ),

                  jobTitle:
                    row.job_title
                      ? String(
                          row.job_title
                        )
                      : null,

                  active:
                    row.is_active !==
                    false,
                })
              )
            }
            events={
              eventRows
            }
            canManage={
              canManage
            }
            canExecute={
              canExecute
            }
            assignedName={
              assignedName
            }
            isOverdue={
              isOverdue
            }
          />

        </div>

      </div>

    </main>
  );
}
