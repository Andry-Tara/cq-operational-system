import {
  revalidatePath,
} from "next/cache";

import {
  NextResponse,
} from "next/server";

import {
  checkAdminApi,
} from "@/lib/admin/require-admin";

import {
  createClient,
} from "@/lib/supabase/server";

type Context = {
  params: Promise<{
    outletId: string;
    facilityId: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: Context
) {
  const access =
    await checkAdminApi();

  if (!access.ok) {
    return NextResponse.json(
      {
        error:
          access.error,
      },
      {
        status:
          access.status,
      }
    );
  }

  try {
    const {
      outletId,
      facilityId,
    } =
      await context.params;

    if (
      !outletId ||
      !facilityId
    ) {
      return NextResponse.json(
        {
          error:
            "Outlet and facility are required.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => null
        );

    if (
      !body ||
      typeof body.isAvailable !==
        "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "isAvailable must be boolean.",
        },
        {
          status: 400,
        }
      );
    }

    const expectedUpdatedAt =
      body.expectedUpdatedAt ===
        null ||
      body.expectedUpdatedAt ===
        undefined
        ? null
        : String(
            body.expectedUpdatedAt
          );

    if (
      expectedUpdatedAt &&
      Number.isNaN(
        Date.parse(
          expectedUpdatedAt
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid expectedUpdatedAt.",
        },
        {
          status: 400,
        }
      );
    }

    const reason =
      String(
        body.reason ??
          "Admin outlet facility matrix"
      )
        .trim()
        .slice(
          0,
          500
        ) ||
      null;

    const supabase =
      await createClient();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "set_outlet_facility_availability",
        {
          p_outlet_id:
            outletId,
          p_facility_id:
            facilityId,
          p_is_available:
            body.isAvailable,
          p_expected_updated_at:
            expectedUpdatedAt,
          p_reason:
            reason,
        }
      );

    if (error) {
      const message =
        String(
          error.message ||
            ""
        );

      if (
        error.code ===
          "40001" ||
        message.includes(
          "OUTLET_FACILITY_STALE"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Facility configuration changed elsewhere. Refresh the page before trying again.",
            code:
              "OUTLET_FACILITY_STALE",
          },
          {
            status: 409,
          }
        );
      }

      if (
        message.includes(
          "OUTLET_FACILITY_OPEN_REPORT"
        )
      ) {
        return NextResponse.json(
          {
            error:
              message.replace(
                /^.*OUTLET_FACILITY_OPEN_REPORT:\s*/,
                ""
              ),
            code:
              "OUTLET_FACILITY_OPEN_REPORT",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.code ===
          "42501" ||
        message.includes(
          "OUTLET_FACILITY_FORBIDDEN"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "You are not authorized to manage outlet facilities.",
          },
          {
            status: 403,
          }
        );
      }

      console.error(
        "Outlet facility update failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to update outlet facility.",
        },
        {
          status: 500,
        }
      );
    }

    revalidatePath(
      "/protected/admin/facilities"
    );

    return NextResponse.json({
      facility:
        data,
    });
  } catch (error) {
    console.error(
      "Outlet facility request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update outlet facility.",
      },
      {
        status: 500,
      }
    );
  }
}
