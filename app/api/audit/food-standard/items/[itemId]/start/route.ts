import {
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


export async function POST(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        itemId: string;
      }>;
  },
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
      itemId,
    } =
      await params;

    const admin =
      createAdminClient();

    const {
      data: item,
      error:
        itemError,
    } =
      await admin
        .from(
          "qa_food_session_items",
        )
        .select(`
          id,
          session_id,
          state,
          started_at,
          qa_food_sessions!inner (
            id,
            outlet_id,
            created_by,
            status
          )
        `)
        .eq(
          "id",
          itemId,
        )
        .maybeSingle();

    if (
      itemError ||
      !item
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food item was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const rawSession =
      (item as any)
        .qa_food_sessions;

    const session =
      Array.isArray(
        rawSession,
      )
        ? rawSession[0]
        : rawSession;

    if (
      !session ||
      session.outlet_id !==
        outlet.id ||
      session.created_by !==
        user.id ||
      session.status !==
        "OPEN"
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food item scope mismatch.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      item.state !==
      "SELECTED"
    ) {
      return NextResponse.json(
        {
          error:
            "Only selected menu can start the timer.",
        },
        {
          status:
            409,
        },
      );
    }

    const {
      data: updated,
      error:
        updateError,
    } =
      await admin
        .from(
          "qa_food_session_items",
        )
        .update({
          state:
            "RUNNING",

          started_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          item.id,
        )
        .eq(
          "state",
          "SELECTED",
        )
        .select(`
          id,
          state,
          started_at,
          served_at,
          service_seconds,
          service_status,
          service_standard_seconds
        `)
        .single();

    if (updateError) {
      throw updateError;
    }

    await admin
      .from(
        "qa_food_events",
      )
      .insert({
        session_id:
          item.session_id,

        item_id:
          item.id,

        event_type:
          "TIMER_STARTED",

        actor_user_id:
          user.id,
      });

    return NextResponse.json({
      item:
        updated,
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food start timer error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to start QA Food timer.",
      },
      {
        status:
          500,
      },
    );
  }
}
