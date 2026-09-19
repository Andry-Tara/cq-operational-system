import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";


export async function POST(
  request: NextRequest
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


    const outlet =
      await getActiveOutlet();

    if (!outlet) {
      return NextResponse.json(
        {
          error:
            "Outlet belum dipilih.",
        },
        {
          status: 400,
        }
      );
    }


    const body =
      await request.json();

    const shift =
      typeof body?.shift ===
      "string"
        ? body.shift
        : "";

    const checks =
      Array.isArray(
        body?.checks
      )
        ? body.checks
        : [];


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "submit_test_food_v1",
        {
          p_outlet_id:
            outlet.id,
          p_shift:
            shift,
          p_checks:
            checks,
        }
      );


    if (error) {
      const message =
        error.message ||
        "Unable to submit Test Food.";

      const conflict =
        message
          .toLowerCase()
          .includes(
            "already been submitted"
          );

      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status:
            conflict
              ? 409
              : 400,
        }
      );
    }


    return NextResponse.json(
      data
    );

  } catch (error: any) {
    console.error(
      "Test Food submit error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to submit Test Food.",
      },
      {
        status: 500,
      }
    );
  }
}
