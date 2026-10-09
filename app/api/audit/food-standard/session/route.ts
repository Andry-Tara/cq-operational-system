import { NextRequest, NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { getActiveOutlet } from "@/lib/active-outlet";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


function businessDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function runtimeContext() {
  const access = await checkPermissionApi("audit.submit");

  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: access.error },
        { status: access.status },
      ),
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  const activeOutlet = await getActiveOutlet();

  if (!activeOutlet) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Outlet belum dipilih.",
          code: "OUTLET_REQUIRED",
        },
        { status: 400 },
      ),
    };
  }

  const {
    data: hasOutletAccess,
    error: outletAccessError,
  } = await supabase.rpc(
    "has_outlet_access",
    {
      p_outlet_id: activeOutlet.id,
    },
  );

  if (
    outletAccessError ||
    hasOutletAccess !== true
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke outlet ini.",
        },
        { status: 403 },
      ),
    };
  }

  const admin = createAdminClient();

  const [
    profileResult,
    outletResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(`
        id,
        full_name,
        organization_id,
        is_active
      `)
      .eq("id", user.id)
      .maybeSingle(),

    admin
      .from("outlets")
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
        activeOutlet.id,
      )
      .eq(
        "is_active",
        true,
      )
      .maybeSingle(),
  ]);

  const profile =
    profileResult.data;

  const outlet =
    outletResult.data;

  if (
    profileResult.error ||
    !profile ||
    profile.is_active === false
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Active auditor profile was not found.",
        },
        { status: 403 },
      ),
    };
  }

  if (
    outletResult.error ||
    !outlet
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Active outlet was not found.",
        },
        { status: 404 },
      ),
    };
  }

  if (
    outlet.organization_id !==
    profile.organization_id
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Outlet organization mismatch.",
        },
        { status: 403 },
      ),
    };
  }

  if (
    String(
      outlet.code,
    ).toUpperCase() === "CNT"
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "QA Food Standard is only available for restaurant outlets.",
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true as const,
    admin,
    user,
    profile,
    outlet,
    date:
      businessDate(
        outlet.timezone ||
          "Asia/Jakarta",
      ),
  };
}

async function loadOpenSession(
  admin: ReturnType<
    typeof createAdminClient
  >,
  {
    outletId,
    organizationId,
    userId,
  }: {
    outletId: string;
    organizationId: string;
    userId: string;
    date?: string;
  },
) {
  const {
    data: sessions,
    error: sessionError,
  } =
    await admin
      .from(
        "qa_food_sessions",
      )
      .select(`
        id,
        outlet_id,
        business_date,
        status,
        target_menu_count,
        result_status,
        qa_number,
        score,
        max_score,
        scoring_snapshot,
        auditor_name_snapshot,
        started_at,
        finalized_at,
        created_at
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "outlet_id",
        outletId,
      )
      .eq(
        "created_by",
        userId,
      )
      .eq(
        "status",
        "OPEN",
      )
      .order(
        "started_at",
        {
          ascending: false,
        },
      );

  if (sessionError) {
    throw sessionError;
  }

  if (
    !sessions ||
    sessions.length === 0
  ) {
    return null;
  }

  const sessionIds =
    sessions.map(
      (
        session,
      ) =>
        session.id,
    );

  const {
    data: allItems,
    error: itemError,
  } =
    await admin
      .from(
        "qa_food_session_items",
      )
      .select(`
        id,
        session_id,
        menu_id,
        round_no,
        sequence_no,
        state,
        menu_name_snapshot,
        category_snapshot,
        service_standard_seconds,
        selected_at,
        started_at,
        served_at,
        service_seconds,
        service_status
      `)
      .in(
        "session_id",
        sessionIds,
      );

  if (itemError) {
    throw itemError;
  }

  const itemsBySession =
    new Map<
      string,
      any[]
    >();

  for (
    const item
    of allItems ?? []
  ) {
    const current =
      itemsBySession.get(
        item.session_id,
      ) ??
      [];

    current.push(
      item,
    );

    itemsBySession.set(
      item.session_id,
      current,
    );
  }

  const ranked =
    sessions
      .map(
        (
          session,
        ) => {
          const activeItems =
            (
              itemsBySession.get(
                session.id,
              ) ??
              []
            ).filter(
              (
                item,
              ) =>
                item.state !==
                "VOIDED",
            );

          const assessedCount =
            activeItems.filter(
              (
                item,
              ) =>
                item.state ===
                "ASSESSED",
            ).length;

          return {
            session,
            activeItems,
            assessedCount,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) => {
          // 1. Prefer sessions that already contain menus.
          if (
            b.activeItems.length !==
            a.activeItems.length
          ) {
            return (
              b.activeItems.length -
              a.activeItems.length
            );
          }

          // 2. Prefer the session with more completed assessments.
          if (
            b.assessedCount !==
            a.assessedCount
          ) {
            return (
              b.assessedCount -
              a.assessedCount
            );
          }

          // 3. If progress is equal, use the newest session.
          return (
            new Date(
              b.session.started_at,
            ).getTime() -
            new Date(
              a.session.started_at,
            ).getTime()
          );
        },
      );

  const selected =
    ranked[0];

  if (!selected) {
    return null;
  }

  const session =
    selected.session;

  const activeItems =
    selected.activeItems;

  const assessedCount =
    selected.assessedCount;

  const runningCount =
    activeItems.filter(
      (
        item,
      ) =>
        item.state ===
        "RUNNING",
    ).length;

  const lateCount =
    activeItems.filter(
      (
        item,
      ) =>
        item.service_status ===
        "LATE",
    ).length;

  return {
    ...session,

    item_count:
      activeItems.length,

    assessed_count:
      assessedCount,

    running_count:
      runningCount,

    late_count:
      lateCount,

    items:
      activeItems
        .sort(
          (
            a,
            b,
          ) =>
            Number(
              a.sequence_no ||
                0,
            ) -
            Number(
              b.sequence_no ||
                0,
            ),
        ),
  };
}

async function loadSessionById(
  admin: ReturnType<
    typeof createAdminClient
  >,
  {
    sessionId,
    outletId,
    organizationId,
    userId,
  }: {
    sessionId: string;
    outletId: string;
    organizationId: string;
    userId: string;
  },
) {
  const {
    data: session,
    error: sessionError,
  } =
    await admin
      .from(
        "qa_food_sessions",
      )
      .select(`
        id,
        outlet_id,
        business_date,
        status,
        target_menu_count,
        result_status,
        qa_number,
        score,
        max_score,
        scoring_snapshot,
        auditor_name_snapshot,
        started_at,
        finalized_at,
        created_at
      `)
      .eq(
        "id",
        sessionId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "outlet_id",
        outletId,
      )
      .eq(
        "created_by",
        userId,
      )
      .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  const {
    data: items,
    error: itemError,
  } =
    await admin
      .from(
        "qa_food_session_items",
      )
      .select(`
        id,
        menu_id,
        round_no,
        sequence_no,
        state,
        menu_name_snapshot,
        category_snapshot,
        service_standard_seconds,
        selected_at,
        started_at,
        served_at,
        service_seconds,
        service_status
      `)
      .eq(
        "session_id",
        session.id,
      );

  if (itemError) {
    throw itemError;
  }

  const activeItems =
    (
      items ??
      []
    ).filter(
      (item) =>
        item.state !==
        "VOIDED",
    );

  return {
    ...session,

    item_count:
      activeItems.length,

    assessed_count:
      activeItems.filter(
        (item) =>
          item.state ===
          "ASSESSED",
      ).length,

    running_count:
      activeItems.filter(
        (item) =>
          item.state ===
          "RUNNING",
      ).length,

    late_count:
      activeItems.filter(
        (item) =>
          item.service_status ===
          "LATE",
      ).length,

    items:
      activeItems.sort(
        (a, b) =>
          Number(
            a.sequence_no || 0,
          ) -
          Number(
            b.sequence_no || 0,
          ),
      ),
  };
}


export async function GET(
  request: NextRequest,
) {
  try {
    const context =
      await runtimeContext();

    if (!context.ok) {
      return context.response;
    }

    const requestedSessionId =
      request.nextUrl
        .searchParams
        .get(
          "session_id",
        )
        ?.trim() ||
      "";

    let session = null;

    if (requestedSessionId) {
      if (
        !UUID.test(
          requestedSessionId,
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

      session =
        await loadSessionById(
          context.admin,
          {
            sessionId:
              requestedSessionId,

            outletId:
              context.outlet.id,

            organizationId:
              context.profile
                .organization_id,

            userId:
              context.user.id,
          },
        );

    } else {
      session =
        await loadOpenSession(
          context.admin,
          {
            outletId:
              context.outlet.id,

            organizationId:
              context.profile
                .organization_id,

            userId:
              context.user.id,
          },
        );
    }

    return NextResponse.json({
      session,

      business_date:
        context.date,
    });

  } catch (error: any) {
    console.error(
      "QA Food session GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load QA Food session.",
      },
      {
        status:
          500,
      },
    );
  }
}

export async function POST() {
  try {
    const context =
      await runtimeContext();

    if (!context.ok) {
      return context.response;
    }

    // ========================================================
    // ALWAYS RESUME EXISTING OPEN SESSION FIRST.
    // Business-date rollover must never create a second OPEN
    // session.
    // ========================================================

    const existing =
      await loadOpenSession(
        context.admin,
        {
          outletId:
            context.outlet.id,

          organizationId:
            context.profile
              .organization_id,

          userId:
            context.user.id,
        },
      );

    if (existing) {
      return NextResponse.json({
        session:
          existing,

        resumed:
          true,
      });
    }


    const {
      data: created,
      error: createError,
    } =
      await context.admin
        .from(
          "qa_food_sessions",
        )
        .insert({
          organization_id:
            context.profile
              .organization_id,

          outlet_id:
            context.outlet.id,

          business_date:
            context.date,

          status:
            "OPEN",

          target_menu_count:
            10,

          created_by:
            context.user.id,

          auditor_name_snapshot:
            context.profile
              .full_name ||
            context.user.email ||
            "Auditor",
        })
        .select(`
          id,
          outlet_id,
          business_date,
          status,
          target_menu_count,
          result_status,
          qa_number,
          score,
          max_score,
          scoring_snapshot,
          auditor_name_snapshot,
          started_at,
          finalized_at,
          created_at
        `)
        .single();


    if (createError) {
      // Unique OPEN-session guard may win a race.
      // Load the winning session instead of returning an error.
      if (
        createError.code ===
        "23505"
      ) {
        const concurrent =
          await loadOpenSession(
            context.admin,
            {
              outletId:
                context.outlet.id,

              organizationId:
                context.profile
                  .organization_id,

              userId:
                context.user.id,
            },
          );

        if (concurrent) {
          return NextResponse.json({
            session:
              concurrent,

            resumed:
              true,
          });
        }
      }

      throw createError;
    }


    return NextResponse.json({
      session: {
        ...created,

        item_count:
          0,

        assessed_count:
          0,

        running_count:
          0,

        late_count:
          0,

        items:
          [],
      },

      resumed:
        false,
    });

  } catch (error: any) {
    console.error(
      "QA Food session POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to start QA Food session.",
      },
      {
        status:
          500,
      },
    );
  }
}
