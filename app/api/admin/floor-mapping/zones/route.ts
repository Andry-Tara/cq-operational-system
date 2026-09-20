import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


const VALID_TYPES =
  new Set([
    "TABLE",
    "VIP",
    "FLOOR",
    "SERVER",
    "LEADER",
    "RUNNER",
    "CHECKER",
    "CASHIER",
    "HOST",
    "GRO",
    "TA_HK",
    "MOD",
    "SERVICE_AREA",
    "OTHER",
  ]);


async function adminContext() {
  const context =
    await getAccessContext();


  const allowed =
    context.isAdmin ||
    context.permissionCodes.includes(
      "admin.access"
    );


  if (
    !allowed ||
    !context.profile
      ?.organization_id
  ) {
    return null;
  }


  return context;
}


export async function POST(
  request: NextRequest
) {
  const context =
    await adminContext();


  if (!context) {
    return NextResponse.json(
      {
        error:
          "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }


  const body =
    await request.json();


  const templateId =
    String(
      body?.template_id ||
      ""
    );


  const zoneCode =
    String(
      body?.zone_code ||
      ""
    )
      .trim()
      .toUpperCase();


  const zoneName =
    String(
      body?.zone_name ||
      ""
    ).trim();


  const zoneType =
    String(
      body?.zone_type ||
      ""
    )
      .trim()
      .toUpperCase();


  const x =
    Number(
      body?.x_pct
    );


  const y =
    Number(
      body?.y_pct
    );


  const capacity =
    body?.capacity ===
      "" ||
    body?.capacity == null
      ? null
      : Number(
          body.capacity
        );


  if (
    !templateId ||
    !zoneCode ||
    !zoneName ||
    !VALID_TYPES.has(
      zoneType
    ) ||
    !Number.isFinite(
      x
    ) ||
    !Number.isFinite(
      y
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Complete the marker information first.",
      },
      {
        status: 400,
      }
    );
  }


  const admin =
    createAdminClient();


  const {
    data:
      template,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .select(`
        id,
        organization_id
      `)
      .eq(
        "id",
        templateId
      )
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .maybeSingle();


  if (!template) {
    return NextResponse.json(
      {
        error:
          "Template not found.",
      },
      {
        status: 404,
      }
    );
  }


  const {
    data:
      lastZone,
  } =
    await admin
      .from(
        "floor_mapping_zones"
      )
      .select(`
        sort_order
      `)
      .eq(
        "template_id",
        templateId
      )
      .order(
        "sort_order",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  const {
    data:
      zone,
    error,
  } =
    await admin
      .from(
        "floor_mapping_zones"
      )
      .insert({
        template_id:
          templateId,

        zone_code:
          zoneCode,

        zone_name:
          zoneName,

        zone_type:
          zoneType,

        x_pct:
          Math.max(
            0,
            Math.min(
              100,
              x
            )
          ),

        y_pct:
          Math.max(
            0,
            Math.min(
              100,
              y
            )
          ),

        shape:
          zoneType ===
          "TABLE"
            ? "CIRCLE"
            : "PILL",

        display_label:
          String(
            body?.display_label ||
            zoneCode
          ).trim(),

        capacity:
          capacity,

        sort_order:
          Number(
            lastZone
              ?.sort_order ||
            0
          ) + 1,
      })
      .select(`
        id,
        zone_code,
        zone_name,
        zone_type,
        x_pct,
        y_pct,
        shape,
        display_label,
        capacity,
        sort_order,
        is_active
      `)
      .single();


  if (error) {
    return NextResponse.json(
      {
        error:
          error.code ===
          "23505"
            ? "Marker code already exists on this template."
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

    zone,
  });
}


export async function DELETE(
  request: NextRequest
) {
  const context =
    await adminContext();


  if (!context) {
    return NextResponse.json(
      {
        error:
          "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }


  const id =
    request.nextUrl
      .searchParams
      .get(
        "id"
      );


  if (!id) {
    return NextResponse.json(
      {
        error:
          "id is required.",
      },
      {
        status: 400,
      }
    );
  }


  const admin =
    createAdminClient();


  const {
    data:
      zone,
  } =
    await admin
      .from(
        "floor_mapping_zones"
      )
      .select(`
        id,
        template_id
      `)
      .eq(
        "id",
        id
      )
      .maybeSingle();


  if (!zone) {
    return NextResponse.json(
      {
        error:
          "Marker not found.",
      },
      {
        status: 404,
      }
    );
  }


  const {
    data:
      template,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .select(`
        id
      `)
      .eq(
        "id",
        zone.template_id
      )
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .maybeSingle();


  if (!template) {
    return NextResponse.json(
      {
        error:
          "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }


  const {
    error,
  } =
    await admin
      .from(
        "floor_mapping_zones"
      )
      .delete()
      .eq(
        "id",
        id
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
