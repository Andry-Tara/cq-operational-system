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


const SESSION_TYPES =
  new Set([
    "MORNING",
    "AFTERNOON",
    "CLOSING",
  ]);


const ACTIONS =
  new Set([
    "SAVE_DRAFT",
    "SUBMIT",
  ]);


const ROLE_TYPES =
  new Set([
    "LEADER",
    "SERVER",
    "RUNNER",
    "CHECKER",
    "CASHIER",
    "HOST",
    "GRO",
    "TA_HK",
    "MOD",
    "FLOOR",
    "OTHER",
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


function cleanNames(
  input: unknown
) {
  if (
    !Array.isArray(
      input
    )
  ) {
    return [];
  }


  return input
    .map(
      (
        item
      ) =>
        String(
          item ||
          ""
        ).trim()
    )
    .filter(
      Boolean
    )
    .slice(
      0,
      20
    );
}


export async function POST(
  request: NextRequest
) {
  try {
    const context =
      await getAccessContext();


    if (
      !context.user ||
      !context.profile
        ?.organization_id
    ) {
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


    const activeOutlet =
      await getActiveOutlet();


    if (!activeOutlet) {
      return NextResponse.json(
        {
          error:
            "Outlet belum dipilih.",

          code:
            "OUTLET_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }


    const supabase =
      await createClient();


    if (
      !context.isAdmin
    ) {
      const {
        data:
          hasOutletAccess,
        error:
          accessError,
      } =
        await supabase.rpc(
          "has_outlet_access",
          {
            p_outlet_id:
              activeOutlet.id,
          }
        );


      if (
        accessError ||
        hasOutletAccess !==
          true
      ) {
        return NextResponse.json(
          {
            error:
              "Anda tidak memiliki akses ke outlet aktif ini.",
          },
          {
            status: 403,
          }
        );
      }
    }


    const body =
      await request
        .json()
        .catch(
          () =>
            null
        );


    const sessionType =
      String(
        body?.sessionType ||
        ""
      )
        .trim()
        .toUpperCase();


    const action =
      String(
        body?.action ||
        ""
      )
        .trim()
        .toUpperCase();


    if (
      !SESSION_TYPES.has(
        sessionType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid session.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !ACTIONS.has(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action.",
        },
        {
          status: 400,
        }
      );
    }


    const staffPins =
      Array.isArray(
        body?.staffPins
      )
        ? body.staffPins
            .slice(
              0,
              100
            )
            .map(
              (
                item: any,
                index: number
              ) => {
                const roleType =
                  String(
                    item?.roleType ||
                    ""
                  )
                    .trim()
                    .toUpperCase();


                const x =
                  Number(
                    item?.xPct
                  );


                const y =
                  Number(
                    item?.yPct
                  );


                if (
                  !ROLE_TYPES.has(
                    roleType
                  ) ||
                  !Number.isFinite(
                    x
                  ) ||
                  !Number.isFinite(
                    y
                  ) ||
                  x < 0 ||
                  x > 100 ||
                  y < 0 ||
                  y > 100
                ) {
                  throw new Error(
                    "Invalid FOH staff position."
                  );
                }


                const names =
                  cleanNames(
                    item?.assignedNames
                  );


                if (
                  !String(
                    item?.positionLabel ||
                    ""
                  ).trim() ||
                  names.length ===
                    0
                ) {
                  throw new Error(
                    "Complete the FOH staff assignment."
                  );
                }


                return {
                  position_label:
                    String(
                      item.positionLabel
                    )
                      .trim()
                      .slice(
                        0,
                        120
                      ),

                  role_type:
                    roleType,

                  assigned_names:
                    names,

                  x_pct:
                    Number(
                      x.toFixed(
                        3
                      )
                    ),

                  y_pct:
                    Number(
                      y.toFixed(
                        3
                      )
                    ),

                  notes:
                    String(
                      item?.notes ||
                      ""
                    )
                      .trim()
                      .slice(
                        0,
                        500
                      ),

                  sort_order:
                    index + 1,
                };
              }
            )
        : [];


    const bohAssignments =
      Array.isArray(
        body?.bohAssignments
      )
        ? body.bohAssignments
            .slice(
              0,
              100
            )
            .map(
              (
                item: any,
                index: number
              ) => {
                const positionId =
                  String(
                    item?.positionId ||
                    ""
                  ).trim();


                const names =
                  cleanNames(
                    item?.assignedNames
                  );


                if (
                  !positionId ||
                  names.length ===
                    0
                ) {
                  throw new Error(
                    "Complete the BOH assignment."
                  );
                }


                return {
                  position_id:
                    positionId,

                  assigned_names:
                    names,

                  station_note:
                    String(
                      item?.stationNote ||
                      ""
                    )
                      .trim()
                      .slice(
                        0,
                        300
                      ),

                  sort_order:
                    index + 1,
                };
              }
            )
        : [];


    const admin =
      createAdminClient();


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
          code,
          name,
          timezone,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          activeOutlet.id
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


    if (
      outletError ||
      !outlet
    ) {
      return NextResponse.json(
        {
          error:
            outletError
              ?.message ||
            "Outlet tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
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
      return NextResponse.json(
        {
          error:
            "Central Kitchen does not use Floor Mapping.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        template,
      error:
        templateError,
    } =
      await admin
        .from(
          "floor_mapping_templates"
        )
        .select(`
          id,
          outlet_id,
          organization_id,
          is_active
        `)
        .eq(
          "outlet_id",
          outlet.id
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
      templateError ||
      !template
    ) {
      return NextResponse.json(
        {
          error:
            "Active Floor Mapping template not found for this outlet.",
        },
        {
          status: 409,
        }
      );
    }


    const today =
      businessDate(
        outlet.timezone ||
        "Asia/Jakarta"
      );


    const picName =
      context.profile
        ?.full_name ||
      context.user.email ||
      "Operational User";


    const {
      data:
        result,
      error:
        saveError,
    } =
      await admin
        .rpc(
          "save_floor_mapping_runtime",
          {
            p_organization_id:
              outlet.organization_id,

            p_outlet_id:
              outlet.id,

            p_template_id:
              template.id,

            p_business_date:
              today,

            p_session_type:
              sessionType,

            p_action:
              action,

            p_user_id:
              context.user.id,

            p_pic_name:
              picName,

            p_general_notes:
              String(
                body?.generalNotes ||
                ""
              )
                .trim()
                .slice(
                  0,
                  2000
                ),

            p_staff_pins:
              staffPins,

            p_boh_assignments:
              bohAssignments,
          }
        )
        .single();


    if (
      saveError ||
      !result
    ) {
      return NextResponse.json(
        {
          error:
            saveError
              ?.message ||
            "Unable to save Floor Mapping.",
        },
        {
          status: 400,
        }
      );
    }


    const runtimeResult =
      result as {
        out_session_id:
          string;

        out_status:
          string;

        out_submitted_at:
          string |
          null;
      };


    return NextResponse.json({
      ok:
        true,

      session: {
        id:
          runtimeResult
            .out_session_id,

        status:
          runtimeResult
            .out_status,

        submittedAt:
          runtimeResult
            .out_submitted_at,
      },
    });

  } catch (
    error: any
  ) {
    console.error(
      "Floor Mapping save error:",
      error
    );


    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to save Floor Mapping.",
      },
      {
        status: 500,
      }
    );
  }
}
