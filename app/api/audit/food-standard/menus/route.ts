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


async function context() {
  const access =
    await checkPermissionApi(
      "audit.submit",
    );

  if (!access.ok) {
    return {
      ok: false as const,
      response:
        NextResponse.json(
          {
            error:
              access.error,
          },
          {
            status:
              access.status,
          },
        ),
    };
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
    return {
      ok: false as const,
      response:
        NextResponse.json(
          {
            error:
              "Unauthorized.",
          },
          {
            status:
              401,
          },
        ),
    };
  }

  const outlet =
    await getActiveOutlet();

  if (!outlet) {
    return {
      ok: false as const,
      response:
        NextResponse.json(
          {
            error:
              "Outlet belum dipilih.",
          },
          {
            status:
              400,
          },
        ),
    };
  }

  const admin =
    createAdminClient();

  const {
    data: profile,
    error: profileError,
  } =
    await admin
      .from(
        "profiles",
      )
      .select(`
        id,
        organization_id,
        is_active
      `)
      .eq(
        "id",
        user.id,
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.is_active ===
      false
  ) {
    return {
      ok: false as const,
      response:
        NextResponse.json(
          {
            error:
              "Active auditor profile was not found.",
          },
          {
            status:
              403,
          },
        ),
    };
  }

  return {
    ok: true as const,
    admin,
    user,
    outlet,
    profile,
  };
}


async function openSession(
  admin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
  outletId: string,
) {
  const {
    data,
    error,
  } =
    await admin
      .from(
        "qa_food_sessions",
      )
      .select(`
        id,
        organization_id,
        outlet_id,
        status,
        target_menu_count
      `)
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
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}


export async function GET() {
  try {
    const ctx =
      await context();

    if (!ctx.ok) {
      return ctx.response;
    }

    const session =
      await openSession(
        ctx.admin,
        ctx.user.id,
        ctx.outlet.id,
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Open QA Food session was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const [
      scopeResult,
      itemResult,
    ] =
      await Promise.all([
        ctx.admin
          .from(
            "qa_food_menu_outlets",
          )
          .select(`
            menu_id,
            service_standard_seconds,
            qa_food_menus!inner (
              id,
              name,
              category,
              source,
              source_menu_key,
              is_active
            )
          `)
          .eq(
            "outlet_id",
            ctx.outlet.id,
          )
          .eq(
            "is_active",
            true,
          )
          .eq(
            "qa_eligible",
            true,
          )
          .eq(
            "qa_food_menus.organization_id",
            ctx.profile.organization_id,
          )
          .eq(
            "qa_food_menus.is_active",
            true,
          ),

        ctx.admin
          .from(
            "qa_food_session_items",
          )
          .select(`
            menu_id,
            state
          `)
          .eq(
            "session_id",
            session.id,
          ),
      ]);

    if (
      scopeResult.error
    ) {
      throw scopeResult.error;
    }

    if (
      itemResult.error
    ) {
      throw itemResult.error;
    }

    const used =
      new Set(
        (
          itemResult.data ??
          []
        )
          .filter(
            (item) =>
              item.state !==
              "VOIDED",
          )
          .map(
            (item) =>
              item.menu_id,
          ),
      );

    const menus =
      (
        scopeResult.data ??
        []
      )
        .flatMap(
          (
            row: any,
          ) => {
            const raw =
              row.qa_food_menus;

            const menu =
              Array.isArray(
                raw,
              )
                ? raw[0]
                : raw;

            if (
              !menu ||
              used.has(
                menu.id,
              )
            ) {
              return [];
            }

            return [
              {
                id:
                  menu.id,

                name:
                  menu.name,

                category:
                  menu.category ||
                  "OTHER",

                source:
                  menu.source,

                source_menu_key:
                  menu.source_menu_key,

                service_standard_seconds:
                  Number(
                    row.service_standard_seconds ||
                      780,
                  ),
              },
            ];
          },
        )
        .sort(
          (
            a,
            b,
          ) =>
            String(
              a.category,
            ).localeCompare(
              String(
                b.category,
              ),
            ) ||
            String(
              a.name,
            ).localeCompare(
              String(
                b.name,
              ),
            ),
        );

    return NextResponse.json({
      menus,
      remaining:
        Math.max(
          0,
          Number(
            session.target_menu_count ||
              10,
          ) -
            used.size,
        ),
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food menus GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load QA Food menus.",
      },
      {
        status:
          500,
      },
    );
  }
}


export async function POST(
  request: NextRequest,
) {
  try {
    const ctx =
      await context();

    if (!ctx.ok) {
      return ctx.response;
    }

    const session =
      await openSession(
        ctx.admin,
        ctx.user.id,
        ctx.outlet.id,
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Open QA Food session was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const body =
      await request.json();

    const requestedIds =
      Array.isArray(
        body?.menu_ids,
      )
        ? [
            ...new Set(
              body.menu_ids
                .map(
                  (
                    value: unknown,
                  ) =>
                    typeof value ===
                    "string"
                      ? value.trim()
                      : "",
                )
                .filter(
                  Boolean,
                ),
            ),
          ]
        : [];

    if (
      requestedIds.length <
        1 ||
      requestedIds.length >
        4
    ) {
      return NextResponse.json(
        {
          error:
            "Pilih 1 sampai 4 menu untuk order round ini.",
        },
        {
          status:
            400,
        },
      );
    }

    const {
      data:
        currentItems,
      error:
        currentError,
    } =
      await ctx.admin
        .from(
          "qa_food_session_items",
        )
        .select(`
          id,
          menu_id,
          round_no,
          sequence_no,
          state
        `)
        .eq(
          "session_id",
          session.id,
        );

    if (currentError) {
      throw currentError;
    }

    const active =
      (
        currentItems ??
        []
      ).filter(
        (item) =>
          item.state !==
          "VOIDED",
      );

    const remaining =
      Number(
        session.target_menu_count ||
          10,
      ) -
      active.length;

    if (
      requestedIds.length >
      remaining
    ) {
      return NextResponse.json(
        {
          error:
            `Session hanya memiliki ${remaining} slot menu tersisa.`,
        },
        {
          status:
            409,
        },
      );
    }

    const used =
      new Set(
        active.map(
          (item) =>
            item.menu_id,
        ),
      );

    if (
      requestedIds.some(
        (id) =>
          used.has(id),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Menu yang sudah pernah dipilih tidak boleh dipilih lagi.",
        },
        {
          status:
            409,
        },
      );
    }

    const {
      data:
        mappings,
      error:
        mappingError,
    } =
      await ctx.admin
        .from(
          "qa_food_menu_outlets",
        )
        .select(`
          menu_id,
          qa_eligible,
          is_active,
          qa_food_menus!inner (
            id,
            organization_id,
            is_active
          )
        `)
        .eq(
          "outlet_id",
          ctx.outlet.id,
        )
        .eq(
          "is_active",
          true,
        )
        .eq(
          "qa_eligible",
          true,
        )
        .in(
          "menu_id",
          requestedIds,
        );

    if (mappingError) {
      throw mappingError;
    }

    const validIds =
      new Set(
        (
          mappings ??
          []
        )
          .filter(
            (
              row: any,
            ) => {
              const raw =
                row.qa_food_menus;

              const menu =
                Array.isArray(
                  raw,
                )
                  ? raw[0]
                  : raw;

              return (
                menu &&
                menu.is_active ===
                  true &&
                menu.organization_id ===
                  ctx.profile
                    .organization_id
              );
            },
          )
          .map(
            (row) =>
              row.menu_id,
          ),
      );

    if (
      requestedIds.some(
        (id) =>
          !validIds.has(
            id,
          ),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "One or more selected menus are not QA eligible for this outlet.",
        },
        {
          status:
            400,
        },
      );
    }

    const nextRound =
      Math.max(
        0,
        ...active.map(
          (item) =>
            Number(
              item.round_no ||
                0,
            ),
        ),
      ) + 1;

    const nextSequence =
      Math.max(
        0,
        ...active.map(
          (item) =>
            Number(
              item.sequence_no ||
                0,
            ),
        ),
      ) + 1;

    const rows =
      requestedIds.map(
        (
          menuId,
          index,
        ) => ({
          session_id:
            session.id,

          menu_id:
            menuId,

          round_no:
            nextRound,

          sequence_no:
            nextSequence +
            index,

          state:
            "SELECTED",
        }),
      );

    const {
      data:
        inserted,
      error:
        insertError,
    } =
      await ctx.admin
        .from(
          "qa_food_session_items",
        )
        .insert(
          rows,
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
        `);

    if (insertError) {
      throw insertError;
    }

    await ctx.admin
      .from(
        "qa_food_events",
      )
      .insert({
        session_id:
          session.id,

        event_type:
          "MENUS_ADDED",

        actor_user_id:
          ctx.user.id,

        payload: {
          round_no:
            nextRound,

          menu_ids:
            requestedIds,
        },
      });

    return NextResponse.json({
      ok:
        true,

      round_no:
        nextRound,

      items:
        inserted ??
        [],
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food menus POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to add QA Food menus.",
      },
      {
        status:
          500,
      },
    );
  }
}
