import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";


const CATEGORIES =
  new Set([
    "MOD",
    "LEADER",
    "SERVER",
    "RUNNER",
    "CHECKER",
    "CASHIER",
    "HOST",
    "GRO",
    "TA_HK",
    "FLOOR",
    "OTHER",
  ]);


const AREAS =
  new Set([
    "FOH",
    "BOH",
    "BOTH",
  ]);


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


function roleCodes(
  roles: any[]
) {
  return new Set(
    (
      roles ??
      []
    ).map(
      (
        role: any
      ) =>
        String(
          role?.code ||
          ""
        )
          .trim()
          .toUpperCase()
    )
  );
}


async function authorize(
  requestedOutletId:
    string |
    null
) {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Unauthorized.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  const codes =
    roleCodes(
      context.roles
    );


  const isOrgAdmin =
    codes.has(
      "ORG_ADMIN"
    );


  const canManage =
    isOrgAdmin ||
    context.permissionCodes.includes(
      "team_structure.manage"
    );


  if (!canManage) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Forbidden.",
          },
          {
            status: 403,
          }
        ),
    };
  }


  const activeOutlet =
    await getActiveOutlet();


  let outletId =
    requestedOutletId ||
    activeOutlet?.id ||
    "";


  if (!isOrgAdmin) {
    if (
      !activeOutlet?.id
    ) {
      return {
        error:
          NextResponse.json(
            {
              error:
                "Active outlet is required.",
            },
            {
              status: 400,
            }
          ),
      };
    }


    if (
      requestedOutletId &&
      requestedOutletId !==
        activeOutlet.id
    ) {
      return {
        error:
          NextResponse.json(
            {
              error:
                "Outlet Manager can only manage the active outlet.",
            },
            {
              status: 403,
            }
          ),
      };
    }


    outletId =
      activeOutlet.id;


    const supabase =
      await createClient();


    const {
      data:
        hasOutletAccess,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            outletId,
        }
      );


    if (
      hasOutletAccess !==
      true
    ) {
      return {
        error:
          NextResponse.json(
            {
              error:
                "You do not have access to this outlet.",
            },
            {
              status: 403,
            }
          ),
      };
    }
  }


  if (!outletId) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Outlet is required.",
          },
          {
            status: 400,
          }
        ),
    };
  }


  const admin =
    createAdminClient();

  const db:
    any =
    admin;


  const {
    data:
      outlet,
  } =
    await db
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name,
        timezone,
        organization_id,
        is_active
      `)
      .eq(
        "id",
        outletId
      )
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (!outlet) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Outlet not found.",
          },
          {
            status: 404,
          }
        ),
    };
  }


  if (
    String(
      outlet.code ||
      ""
    )
      .trim()
      .toUpperCase() ===
    "CNT"
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Central Kitchen is not part of outlet Team Structure.",
          },
          {
            status: 400,
          }
        ),
    };
  }


  return {
    context,
    isOrgAdmin,
    admin:
      db,
    outlet,
  };
}


async function resolveLoginAccount(
  admin: any,
  organizationId: string,
  outletId: string,
  appUserId: string,
  excludeStaffId?: string
) {
  if (!appUserId) {
    return {
      profile:
        null,
      error:
        null,
    };
  }


  const {
    data:
      membership,
  } =
    await admin
      .from(
        "user_outlets"
      )
      .select(`
        user_id
      `)
      .eq(
        "user_id",
        appUserId
      )
      .eq(
        "outlet_id",
        outletId
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (!membership) {
    return {
      profile:
        null,

      error:
        "Selected login account is not assigned to this outlet.",
    };
  }


  const {
    data:
      profile,
  } =
    await admin
      .from(
        "profiles"
      )
      .select(`
        id,
        employee_id,
        full_name,
        job_title,
        is_active
      `)
      .eq(
        "id",
        appUserId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (!profile) {
    return {
      profile:
        null,

      error:
        "Selected login profile is not active.",
    };
  }


  let duplicateQuery =
    admin
      .from(
        "team_staff"
      )
      .select(`
        id,
        full_name
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "app_user_id",
        appUserId
      );


  if (excludeStaffId) {
    duplicateQuery =
      duplicateQuery.neq(
        "id",
        excludeStaffId
      );
  }


  const {
    data:
      duplicate,
  } =
    await duplicateQuery
      .maybeSingle();


  if (duplicate) {
    return {
      profile:
        null,

      error:
        `Login account is already linked to ${duplicate.full_name}.`,
    };
  }


  return {
    profile,
    error:
      null,
  };
}


export async function GET(
  request:
    NextRequest
) {
  const outletId =
    request.nextUrl
      .searchParams
      .get(
        "outlet_id"
      );


  const auth =
    await authorize(
      outletId
    );


  if ("error" in auth) {
    return auth.error;
  }


  const {
    admin,
    outlet,
  } =
    auth;


  const today =
    businessDate(
      outlet.timezone ||
      "Asia/Jakarta"
    );


  const [
    positionsResult,
    assignmentsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "staff_positions"
        )
        .select(`
          id,
          outlet_id,
          name,
          category,
          area,
          sort_order,
          is_active
        `)
        .eq(
          "organization_id",
          outlet.organization_id
        )
        .or(
          `outlet_id.is.null,outlet_id.eq.${outlet.id}`
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "team_staff_assignments"
        )
        .select(`
          id,
          staff_id,
          outlet_id,
          position_id,
          assignment_type,
          is_primary,
          effective_from,
          effective_to,
          notes,
          team_staff (
            id,
            employee_code,
            full_name,
            app_user_id,
            is_active
          ),
          staff_positions (
            id,
            name,
            category,
            area,
            outlet_id
          )
        `)
        .eq(
          "organization_id",
          outlet.organization_id
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .lte(
          "effective_from",
          today
        )
        .or(
          `effective_to.is.null,effective_to.gte.${today}`
        )
        .order(
          "effective_from",
          {
            ascending:
              false,
          }
        ),
    ]);


  if (
    positionsResult.error
  ) {
    return NextResponse.json(
      {
        error:
          positionsResult
            .error
            .message,
      },
      {
        status: 400,
      }
    );
  }


  if (
    assignmentsResult.error
  ) {
    return NextResponse.json(
      {
        error:
          assignmentsResult
            .error
            .message,
      },
      {
        status: 400,
      }
    );
  }


  const staff =
    (
      assignmentsResult.data ??
      []
    )
      .filter(
        (
          row: any
        ) =>
          row.team_staff
            ?.is_active !==
          false
      )
      .map(
        (
          row: any
        ) => ({
          assignmentId:
            row.id,

          staffId:
            row.staff_id,

          employeeCode:
            row.team_staff
              ?.employee_code ||
            null,

          fullName:
            row.team_staff
              ?.full_name ||
            "",

          appUserId:
            row.team_staff
              ?.app_user_id ||
            null,

          positionId:
            row.position_id,

          positionName:
            row.staff_positions
              ?.name ||
            "",

          category:
            row.staff_positions
              ?.category ||
            "OTHER",

          area:
            row.staff_positions
              ?.area ||
            "FOH",

          assignmentType:
            row.assignment_type,

          effectiveFrom:
            row.effective_from,

          effectiveTo:
            row.effective_to,

          notes:
            row.notes ||
            "",
        })
      );


  const {
    data:
      outletUserRows,
    error:
      outletUsersError,
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
        outlet.id
      )
      .eq(
        "is_active",
        true
      );


  if (
    outletUsersError
  ) {
    return NextResponse.json(
      {
        error:
          outletUsersError
            .message,
      },
      {
        status: 400,
      }
    );
  }


  const loginUserIds =
    Array.from(
      new Set(
        (
          outletUserRows ??
          []
        )
          .map(
            (
              row: any
            ) =>
              row.user_id
          )
          .filter(
            Boolean
          )
      )
    );


  let profileRows:
    any[] =
    [];


  if (
    loginUserIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(`
          id,
          employee_id,
          full_name,
          job_title,
          is_active
        `)
        .eq(
          "organization_id",
          outlet.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .in(
          "id",
          loginUserIds
        )
        .order(
          "full_name",
          {
            ascending:
              true,
          }
        );


    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }


    profileRows =
      data ??
      [];
  }


  const authResult =
    await admin.auth.admin
      .listUsers({
        page:
          1,

        perPage:
          1000,
      });


  if (
    authResult.error
  ) {
    return NextResponse.json(
      {
        error:
          authResult
            .error
            .message,
      },
      {
        status: 400,
      }
    );
  }


  const authById =
    new Map(
      (
        authResult.data
          ?.users ??
        []
      ).map(
        (
          user: any
        ) => [
          user.id,
          user,
        ]
      )
    );


  const linkedStaffByUser =
    new Map(
      staff
        .filter(
          (
            item: any
          ) =>
            Boolean(
              item.appUserId
            )
        )
        .map(
          (
            item: any
          ) => [
            item.appUserId,
            item.staffId,
          ]
        )
    );


  const loginUsers =
    profileRows.map(
      (
        profile: any
      ) => {
        const authUser =
          authById.get(
            profile.id
          ) as
            | {
                email?:
                  string |
                  null;
              }
            | undefined;


        return {
          id:
            profile.id,

          fullName:
            profile.full_name,

          employeeId:
            profile.employee_id ||
            null,

          jobTitle:
            profile.job_title ||
            null,

          email:
            authUser?.email ||
            null,

          linkedStaffId:
            linkedStaffByUser.get(
              profile.id
            ) ||
            null,
        };
      }
    );


  return NextResponse.json({
    outlet,

    positions:
      positionsResult.data ??
      [],

    staff,

    loginUsers,
  });
}


export async function POST(
  request:
    NextRequest
) {
  const body =
    await request
      .json()
      .catch(
        () =>
          null
      );


  const outletId =
    String(
      body?.outletId ||
      ""
    ).trim() ||
    null;


  const auth =
    await authorize(
      outletId
    );


  if ("error" in auth) {
    return auth.error;
  }


  const {
    context,
    isOrgAdmin,
    admin,
    outlet,
  } =
    auth;


  const action =
    String(
      body?.action ||
      ""
    )
      .trim()
      .toUpperCase();


  const today =
    businessDate(
      outlet.timezone ||
      "Asia/Jakarta"
    );


  if (
    action ===
    "CREATE_POSITION"
  ) {
    const name =
      String(
        body?.name ||
        ""
      )
        .trim()
        .slice(
          0,
          120
        );


    const category =
      String(
        body?.category ||
        ""
      )
        .trim()
        .toUpperCase();


    const area =
      String(
        body?.area ||
        ""
      )
        .trim()
        .toUpperCase();


    if (
      !name ||
      !CATEGORIES.has(
        category
      ) ||
      !AREAS.has(
        area
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Complete the position information.",
        },
        {
          status: 400,
        }
      );
    }


    const globalScope =
      isOrgAdmin &&
      body?.scope ===
        "GLOBAL";


    const {
      data:
        position,
      error,
    } =
      await admin
        .from(
          "staff_positions"
        )
        .insert({
          organization_id:
            outlet.organization_id,

          outlet_id:
            globalScope
              ? null
              : outlet.id,

          name,

          category,

          area,

          sort_order:
            500,

          is_active:
            true,

          created_by:
            context.user.id,
        })
        .select(`
          id,
          outlet_id,
          name,
          category,
          area,
          is_active
        `)
        .single();


    if (error) {
      return NextResponse.json(
        {
          error:
            error.code ===
            "23505"
              ? "Position already exists."
              : error.message,
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      position,
    });
  }


  if (
    action ===
    "CREATE_STAFF"
  ) {
    const fullName =
      String(
        body?.fullName ||
        ""
      )
        .trim()
        .slice(
          0,
          160
        );


    const employeeCode =
      String(
        body?.employeeCode ||
        ""
      )
        .trim()
        .slice(
          0,
          80
        );


    const positionId =
      String(
        body?.positionId ||
        ""
      ).trim();


    const appUserId =
      String(
        body?.appUserId ||
        ""
      ).trim();


    const loginResolution =
      await resolveLoginAccount(
        admin,
        outlet.organization_id,
        outlet.id,
        appUserId
      );


    if (
      loginResolution.error
    ) {
      return NextResponse.json(
        {
          error:
            loginResolution.error,
        },
        {
          status: 400,
        }
      );
    }


    const resolvedFullName =
      fullName ||
      loginResolution.profile
        ?.full_name ||
      "";


    const resolvedEmployeeCode =
      employeeCode ||
      loginResolution.profile
        ?.employee_id ||
      "";


    if (
      !resolvedFullName ||
      !positionId
    ) {
      return NextResponse.json(
        {
          error:
            "Name and position are required.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        position,
    } =
      await admin
        .from(
          "staff_positions"
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          is_active
        `)
        .eq(
          "id",
          positionId
        )
        .eq(
          "organization_id",
          outlet.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


    if (
      !position ||
      (
        position.outlet_id &&
        position.outlet_id !==
          outlet.id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid position.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        staff,
      error:
        staffError,
    } =
      await admin
        .from(
          "team_staff"
        )
        .insert({
          organization_id:
            outlet.organization_id,

          employee_code:
            resolvedEmployeeCode ||
            null,

          full_name:
            resolvedFullName,

          app_user_id:
            appUserId ||
            null,

          is_active:
            true,

          created_by:
            context.user.id,
        })
        .select(`
          id,
          employee_code,
          full_name
        `)
        .single();


    if (
      staffError ||
      !staff
    ) {
      return NextResponse.json(
        {
          error:
            staffError?.code ===
            "23505"
              ? "Employee code already exists."
              : staffError
                  ?.message ||
                "Unable to create staff.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      error:
        assignmentError,
    } =
      await admin.rpc(
        "assign_team_staff",
        {
          p_organization_id:
            outlet.organization_id,

          p_staff_id:
            staff.id,

          p_outlet_id:
            outlet.id,

          p_position_id:
            positionId,

          p_effective_from:
            today,

          p_user_id:
            context.user.id,

          p_notes:
            null,
        }
      );


    if (assignmentError) {
      await admin
        .from(
          "team_staff"
        )
        .delete()
        .eq(
          "id",
          staff.id
        );


      return NextResponse.json(
        {
          error:
            assignmentError.message,
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,
    });
  }


  if (
    action ===
    "UPDATE_STAFF"
  ) {
    const staffId =
      String(
        body?.staffId ||
        ""
      ).trim();


    const fullName =
      String(
        body?.fullName ||
        ""
      )
        .trim()
        .slice(
          0,
          160
        );


    const positionId =
      String(
        body?.positionId ||
        ""
      ).trim();


    const appUserId =
      String(
        body?.appUserId ||
        ""
      ).trim();


    const loginResolution =
      await resolveLoginAccount(
        admin,
        outlet.organization_id,
        outlet.id,
        appUserId,
        staffId
      );


    if (
      loginResolution.error
    ) {
      return NextResponse.json(
        {
          error:
            loginResolution.error,
        },
        {
          status: 400,
        }
      );
    }


    if (
      !staffId ||
      !fullName ||
      !positionId
    ) {
      return NextResponse.json(
        {
          error:
            "Staff, name and position are required.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        currentAssignment,
    } =
      await admin
        .from(
          "team_staff_assignments"
        )
        .select(`
          id,
          staff_id
        `)
        .eq(
          "staff_id",
          staffId
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "is_primary",
          true
        )
        .is(
          "effective_to",
          null
        )
        .maybeSingle();


    if (!currentAssignment) {
      return NextResponse.json(
        {
          error:
            "Staff is not assigned to this outlet.",
        },
        {
          status: 403,
        }
      );
    }


    const {
      data:
        position,
    } =
      await admin
        .from(
          "staff_positions"
        )
        .select(`
          id,
          outlet_id
        `)
        .eq(
          "id",
          positionId
        )
        .eq(
          "organization_id",
          outlet.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


    if (
      !position ||
      (
        position.outlet_id &&
        position.outlet_id !==
          outlet.id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid position.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      error:
        nameError,
    } =
      await admin
        .from(
          "team_staff"
        )
        .update({
          full_name:
            fullName,

          app_user_id:
            appUserId ||
            null,
        })
        .eq(
          "id",
          staffId
        )
        .eq(
          "organization_id",
          outlet.organization_id
        );


    if (nameError) {
      return NextResponse.json(
        {
          error:
            nameError.message,
        },
        {
          status: 400,
        }
      );
    }


    const {
      error:
        assignmentError,
    } =
      await admin.rpc(
        "assign_team_staff",
        {
          p_organization_id:
            outlet.organization_id,

          p_staff_id:
            staffId,

          p_outlet_id:
            outlet.id,

          p_position_id:
            positionId,

          p_effective_from:
            today,

          p_user_id:
            context.user.id,

          p_notes:
            null,
        }
      );


    if (assignmentError) {
      return NextResponse.json(
        {
          error:
            assignmentError.message,
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,
    });
  }


  if (
    action ===
    "DEACTIVATE_STAFF"
  ) {
    const staffId =
      String(
        body?.staffId ||
        ""
      ).trim();


    if (!staffId) {
      return NextResponse.json(
        {
          error:
            "staffId is required.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        currentAssignment,
    } =
      await admin
        .from(
          "team_staff_assignments"
        )
        .select(`
          id
        `)
        .eq(
          "staff_id",
          staffId
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "is_primary",
          true
        )
        .is(
          "effective_to",
          null
        )
        .maybeSingle();


    if (!currentAssignment) {
      return NextResponse.json(
        {
          error:
            "Staff is not assigned to this outlet.",
        },
        {
          status: 403,
        }
      );
    }


    const {
      error,
    } =
      await admin.rpc(
        "deactivate_team_staff",
        {
          p_staff_id:
            staffId,

          p_effective_date:
            today,
        }
      );


    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,
    });
  }


  return NextResponse.json(
    {
      error:
        "Unsupported Team Structure action.",
    },
    {
      status: 400,
    }
  );
}
