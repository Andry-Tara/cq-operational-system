import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  checkPermissionApi,
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


const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


export async function POST(
  request: NextRequest,
) {
  try {
    const access =
      await checkPermissionApi(
        "audit.submit",
      );

    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        },
      );
    }


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
          status:
            401,
        },
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
          status:
            400,
        },
      );
    }


    const {
      data:
        hasOutletAccess,

      error:
        outletAccessError,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            outlet.id,
        },
      );


    if (
      outletAccessError ||
      hasOutletAccess !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke outlet ini.",
        },
        {
          status:
            403,
        },
      );
    }


    const body =
      await request
        .json()
        .catch(
          () => ({}),
        );


    const sessionId =
      typeof body?.session_id ===
      "string"
        ? body.session_id.trim()
        : "";


    if (
      !UUID.test(
        sessionId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid QA Food session.",
        },
        {
          status:
            400,
        },
      );
    }


    const admin =
      createAdminClient();


    const {
      data:
        session,

      error:
        sessionError,
    } =
      await admin
        .from(
          "qa_food_sessions",
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          created_by,
          status
        `)
        .eq(
          "id",
          sessionId,
        )
        .maybeSingle();


    if (
      sessionError ||
      !session
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food session was not found.",
        },
        {
          status:
            404,
        },
      );
    }


    if (
      session.outlet_id !==
      outlet.id
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food session outlet mismatch.",
        },
        {
          status:
            403,
        },
      );
    }


    if (
      session.created_by !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Only the assessor who started this session can finalize it.",
        },
        {
          status:
            403,
        },
      );
    }


    const {
      data:
        finalized,

      error:
        finalizeError,
    } =
      await admin.rpc(
        "finalize_qa_food_session_v1",
        {
          p_session_id:
            sessionId,

          p_actor_user_id:
            user.id,
        },
      );


    if (finalizeError) {
      return NextResponse.json(
        {
          error:
            finalizeError.message ||
            "Unable to finalize QA Food assessment.",
        },
        {
          status:
            409,
        },
      );
    }


    return NextResponse.json(
      {
        session:
          finalized,
      },
      {
        status:
          200,
      },
    );

  } catch (
    error: any
  ) {
    console.error(
      "QA Food finalize error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to finalize QA Food assessment.",
      },
      {
        status:
          500,
      },
    );
  }
}
