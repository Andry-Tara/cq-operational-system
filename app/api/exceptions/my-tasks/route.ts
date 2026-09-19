import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


export async function GET() {
  try {
    const supabase =
      await createClient();


    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();


    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }


    const admin =
      createAdminClient();


    const {
      data:
        profile,
      error:
        profileError,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(`
          id,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    if (profileError) {
      throw profileError;
    }


    if (
      !profile ||
      !profile.organization_id ||
      profile.is_active ===
        false
    ) {
      return NextResponse.json({
        tasks: [],
      });
    }


    const {
      data:
        outletAccessRows,
      error:
        outletAccessError,
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
          "is_active",
          true
        );


    if (outletAccessError) {
      throw outletAccessError;
    }


    const outletIds =
      Array.from(
        new Set(
          (
            outletAccessRows ??
            []
          )
            .map(
              row =>
                String(
                  row.outlet_id ||
                  ""
                )
            )
            .filter(
              Boolean
            )
        )
      );


    if (!outletIds.length) {
      return NextResponse.json({
        tasks: [],
      });
    }


    const {
      data:
        workflowRows,
      error:
        workflowError,
    } =
      await admin
        .from(
          "exception_workflows"
        )
        .select(`
          id,
          outlet_id,
          source_type,
          source_id,
          status,
          due_at,
          sla_hours,
          escalated_at,
          assigned_at,
          updated_at
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "assigned_to",
          user.id
        )
        .in(
          "outlet_id",
          outletIds
        )
        .in(
          "status",
          [
            "assigned",
            "in_progress",
          ]
        )
        .order(
          "updated_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          30
        );


    if (workflowError) {
      throw workflowError;
    }


    const workflows =
      workflowRows ??
      [];


    if (!workflows.length) {
      return NextResponse.json({
        tasks: [],
      });
    }


    const workflowOutletIds =
      Array.from(
        new Set(
          workflows.map(
            row =>
              String(
                row.outlet_id
              )
          )
        )
      );


    const {
      data:
        outletRows,
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
        .in(
          "id",
          workflowOutletIds
        );


    if (outletError) {
      throw outletError;
    }


    const outletById =
      new Map(
        (
          outletRows ??
          []
        ).map(
          row => [
            String(
              row.id
            ),
            row,
          ]
        )
      );


    const operationIds =
      workflows
        .filter(
          row =>
            row.source_type ===
            "operations_issue"
        )
        .map(
          row =>
            String(
              row.source_id
            )
        );


    const auditIds =
      workflows
        .filter(
          row =>
            row.source_type ===
            "audit_finding"
        )
        .map(
          row =>
            String(
              row.source_id
            )
        );


    let issues:
      any[] =
      [];


    if (operationIds.length) {
      const {
        data,
        error,
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
            severity
          `)
          .in(
            "id",
            operationIds
          );


      if (error) {
        throw error;
      }


      issues =
        data ??
        [];
    }


    let findings:
      any[] =
      [];


    if (auditIds.length) {
      const {
        data,
        error,
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
            notes
          `)
          .in(
            "id",
            auditIds
          );


      if (error) {
        throw error;
      }


      findings =
        data ??
        [];
    }


    const reportIds =
      Array.from(
        new Set(
          issues
            .map(
              issue =>
                String(
                  issue.report_id ||
                  ""
                )
            )
            .filter(
              Boolean
            )
        )
      );


    let reports:
      any[] =
      [];


    if (reportIds.length) {
      const {
        data,
        error,
      } =
        await admin
          .from(
            "reports"
          )
          .select(`
            id,
            report_number,
            business_date
          `)
          .in(
            "id",
            reportIds
          );


      if (error) {
        throw error;
      }


      reports =
        data ??
        [];
    }


    const sessionIds =
      Array.from(
        new Set(
          findings
            .map(
              finding =>
                String(
                  finding.audit_session_id ||
                  ""
                )
            )
            .filter(
              Boolean
            )
        )
      );


    let sessions:
      any[] =
      [];


    if (sessionIds.length) {
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
            audit_number,
            audit_date
          `)
          .in(
            "id",
            sessionIds
          );


      if (error) {
        throw error;
      }


      sessions =
        data ??
        [];
    }


    const issueById =
      new Map(
        issues.map(
          row => [
            String(
              row.id
            ),
            row,
          ]
        )
      );


    const findingById =
      new Map(
        findings.map(
          row => [
            String(
              row.id
            ),
            row,
          ]
        )
      );


    const reportById =
      new Map(
        reports.map(
          row => [
            String(
              row.id
            ),
            row,
          ]
        )
      );


    const sessionById =
      new Map(
        sessions.map(
          row => [
            String(
              row.id
            ),
            row,
          ]
        )
      );


    const now =
      Date.now();


    const tasks:
      any[] =
      [];


    for (
      const workflow
      of workflows
    ) {
      const outlet =
        outletById.get(
          String(
            workflow.outlet_id
          )
        );


      if (
        workflow.source_type ===
        "operations_issue"
      ) {
        const issue =
          issueById.get(
            String(
              workflow.source_id
            )
          );


        if (!issue) {
          continue;
        }


        const report =
          reportById.get(
            String(
              issue.report_id
            )
          );


        tasks.push({
          id:
            String(
              workflow.id
            ),

          source:
            "operations",

          sourceId:
            String(
              workflow.source_id
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

          outletName:
            String(
              outlet?.name ||
              "Outlet"
            ),

          area:
            "Operations",

          reference:
            String(
              report?.report_number ||
              "Operational Report"
            ),

          severity:
            String(
              issue.severity ||
              "medium"
            )
              .toLowerCase(),

          status:
            String(
              workflow.status
            ),

          dueAt:
            workflow.due_at
              ? String(
                  workflow.due_at
                )
              : null,

          slaHours:
            workflow.sla_hours ??
            null,

          escalated:
            Boolean(
              workflow.escalated_at
            ),

          overdue:
            Boolean(
              workflow.due_at &&
              new Date(
                workflow.due_at
              ).getTime() <
                now
            ),

          href:
            `/protected/exceptions/operations/${workflow.source_id}`,
        });


        continue;
      }


      const finding =
        findingById.get(
          String(
            workflow.source_id
          )
        );


      if (!finding) {
        continue;
      }


      const session =
        sessionById.get(
          String(
            finding.audit_session_id
          )
        );


      tasks.push({
        id:
          String(
            workflow.id
          ),

        source:
          "audit",

        sourceId:
          String(
            workflow.source_id
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

        outletName:
          String(
            outlet?.name ||
            "Outlet"
          ),

        area:
          String(
            finding.area_name_snapshot ||
            finding.finding_category_name_snapshot ||
            "Outlet Audit"
          ),

        reference:
          String(
            session?.audit_number ||
            "Audit"
          ),

        severity:
          String(
            finding.risk_level ||
            "medium"
          )
            .toLowerCase(),

        status:
          String(
            workflow.status
          ),

        dueAt:
          workflow.due_at
            ? String(
                workflow.due_at
              )
            : null,

        slaHours:
          workflow.sla_hours ??
          null,

        escalated:
          Boolean(
            workflow.escalated_at
          ),

        overdue:
          Boolean(
            workflow.due_at &&
            new Date(
              workflow.due_at
            ).getTime() <
              now
          ),

        href:
          `/protected/exceptions/audit/${workflow.source_id}`,
      });
    }


    tasks.sort(
      (
        a,
        b
      ) => {
        if (
          a.overdue !==
          b.overdue
        ) {
          return a.overdue
            ? -1
            : 1;
        }


        if (
          a.dueAt &&
          b.dueAt
        ) {
          return (
            new Date(
              a.dueAt
            ).getTime() -
            new Date(
              b.dueAt
            ).getTime()
          );
        }


        return a.dueAt
          ? -1
          : b.dueAt
            ? 1
            : 0;
      }
    );


    return NextResponse.json({
      tasks,
    });

  } catch (
    error
  ) {
    console.error(
      "My exception tasks error:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Unable to load exception tasks.",
      },
      {
        status: 500,
      }
    );
  }
}
