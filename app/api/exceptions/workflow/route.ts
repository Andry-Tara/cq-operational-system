import { NextResponse } from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";


const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


const ACTIONS =
  new Set([
    "assign",
    "schedule",
    "start",
    "escalate",
    "resolve",
    "verify",
    "close",
  ]);


const PIC_ACTIONS =
  new Set([
    "start",
    "escalate",
    "resolve",
  ]);


function normalizeSource(
  value: unknown
) {
  const source =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    source ===
      "operations" ||
    source ===
      "operations_issue"
  ) {
    return "operations_issue";
  }

  if (
    source ===
      "audit" ||
    source ===
      "audit_finding"
  ) {
    return "audit_finding";
  }

  return null;
}


export async function POST(
  request: Request
) {
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


    const authAdmin =
      createAdminClient();


    const {
      data:
        profile,
      error:
        profileError,
    } =
      await authAdmin
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


    if (
      profileError
    ) {
      throw profileError;
    }


    if (
      !profile ||
      !profile.organization_id ||
      profile.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied.",
        },
        {
          status: 403,
        }
      );
    }


    const managementAccess =
      await checkPermissionApi(
        "exceptions.manage"
      );


    const canManage =
      managementAccess.ok;


    const organizationId =
      String(
        profile.organization_id
      );


    const actorUserId =
      user.id;


    const body =
      await request
        .json()
        .catch(
          () => null
        );


    if (
      !body ||
      typeof body !==
        "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid workflow request.",
        },
        {
          status: 400,
        }
      );
    }


    const sourceType =
      normalizeSource(
        body.sourceType
      );


    const sourceId =
      typeof body.sourceId ===
        "string"
        ? body.sourceId
        : "";


    const action =
      typeof body.action ===
        "string"
        ? body.action
            .trim()
            .toLowerCase()
        : "";


    if (
      !sourceType ||
      !UUID.test(
        sourceId
      ) ||
      !ACTIONS.has(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid exception workflow request.",
        },
        {
          status: 400,
        }
      );
    }


    let assignedTo:
      string | null =
      null;


    if (
      body.assignedTo !==
        undefined &&
      body.assignedTo !==
        null &&
      body.assignedTo !==
        ""
    ) {
      if (
        typeof body.assignedTo !==
          "string" ||
        !UUID.test(
          body.assignedTo
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid PIC.",
          },
          {
            status: 400,
          }
        );
      }

      assignedTo =
        body.assignedTo;
    }


    let dueAt:
      string | null =
      null;


    if (
      body.dueAt !==
        undefined &&
      body.dueAt !==
        null &&
      body.dueAt !==
        ""
    ) {
      if (
        typeof body.dueAt !==
        "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid due date.",
          },
          {
            status: 400,
          }
        );
      }


      const parsed =
        new Date(
          body.dueAt
        );


      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid due date.",
          },
          {
            status: 400,
          }
        );
      }


      dueAt =
        parsed.toISOString();
    }


    let slaHours:
      number | null =
      null;


    if (
      body.slaHours !==
        undefined &&
      body.slaHours !==
        null &&
      body.slaHours !==
        ""
    ) {
      const parsed =
        Number(
          body.slaHours
        );


      if (
        !Number.isInteger(
          parsed
        ) ||
        parsed < 1 ||
        parsed > 8760
      ) {
        return NextResponse.json(
          {
            error:
              "SLA hours must be between 1 and 8760.",
          },
          {
            status: 400,
          }
        );
      }


      slaHours =
        parsed;
    }


    const note =
      typeof body.note ===
        "string"
        ? body.note
            .trim()
            .slice(
              0,
              4000
            )
        : null;


    const admin =
      createAdminClient();


    if (!canManage) {
      if (
        !PIC_ACTIONS.has(
          action
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Only Management can perform this action.",
          },
          {
            status: 403,
          }
        );
      }


      const {
        data:
          assignedWorkflow,
        error:
          assignedWorkflowError,
      } =
        await admin
          .from(
            "exception_workflows"
          )
          .select(`
            id,
            outlet_id,
            assigned_to,
            status
          `)
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "source_type",
            sourceType
          )
          .eq(
            "source_id",
            sourceId
          )
          .eq(
            "assigned_to",
            actorUserId
          )
          .maybeSingle();


      if (
        assignedWorkflowError
      ) {
        throw assignedWorkflowError;
      }


      if (
        !assignedWorkflow
      ) {
        return NextResponse.json(
          {
            error:
              "This exception is not assigned to you.",
          },
          {
            status: 403,
          }
        );
      }


      const {
        data:
          outletAccess,
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
            actorUserId
          )
          .eq(
            "outlet_id",
            assignedWorkflow.outlet_id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();


      if (
        outletAccessError
      ) {
        throw outletAccessError;
      }


      if (
        !outletAccess
      ) {
        return NextResponse.json(
          {
            error:
              "Your outlet access is no longer active.",
          },
          {
            status: 403,
          }
        );
      }
    }


    const {
      data,
      error,
    } =
      await admin.rpc(
        "mutate_exception_workflow",
        {
          p_organization_id:
            organizationId,

          p_source_type:
            sourceType,

          p_source_id:
            sourceId,

          p_action:
            action,

          p_actor_user_id:
            actorUserId,

          p_assigned_to:
            assignedTo,

          p_due_at:
            dueAt,

          p_sla_hours:
            slaHours,

          p_note:
            note,
        }
      );


    if (error) {
      throw error;
    }


    return NextResponse.json(
      {
        workflow:
          data,
      }
    );

  } catch (
    error: any
  ) {
    console.error(
      "Exception workflow error:",
      error
    );


    const message =
      error?.message ||
      "Unable to update exception workflow.";


    const lower =
      message.toLowerCase();


    const status =
      lower.includes(
        "not found"
      )
        ? 404
        : lower.includes(
              "another organization"
            ) ||
            lower.includes(
              "permission"
            )
          ? 403
          : lower.includes(
                "cannot"
              ) ||
              lower.includes(
                "required"
              ) ||
              lower.includes(
                "must"
              )
            ? 409
            : 500;


    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }
}
