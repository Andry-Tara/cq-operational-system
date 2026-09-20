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


const BUCKET =
  "operational-photos";


const DEFAULT_BOH_POSITIONS = [
  [
    "LEADER_1",
    "Leader 1",
    null,
  ],
  [
    "LEADER_2",
    "Leader 2",
    null,
  ],
  [
    "COOK_1",
    "Cook 1",
    null,
  ],
  [
    "COOK_2",
    "Cook 2",
    null,
  ],
  [
    "COOK_3",
    "Cook 3",
    null,
  ],
  [
    "COOK_4",
    "Cook 4",
    null,
  ],
  [
    "COOK_5",
    "Cook 5",
    null,
  ],
  [
    "COOK_6",
    "Cook 6",
    null,
  ],
  [
    "COOK_7",
    "Cook 7",
    null,
  ],
  [
    "STEWARD_1",
    "Steward 1",
    "Dishwasher",
  ],
  [
    "STEWARD_2",
    "Steward 2",
    "Dishwasher",
  ],
] as const;


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


function imageExtension(
  mime: string
) {
  switch (
    String(
      mime ||
      ""
    ).toLowerCase()
  ) {
    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    default:
      return "jpg";
  }
}


export async function GET(
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


  const outletId =
    request.nextUrl
      .searchParams
      .get(
        "outlet_id"
      );


  const requestedTemplateId =
    request.nextUrl
      .searchParams
      .get(
        "template_id"
      );


  if (!outletId) {
    return NextResponse.json(
      {
        error:
          "outlet_id is required.",
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
      outlet,
  } =
    await admin
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name,
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
    return NextResponse.json(
      {
        error:
          "Outlet not found.",
      },
      {
        status: 404,
      }
    );
  }


  const {
    data:
      templates,
    error:
      templatesError,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .select(`
        id,
        outlet_id,
        name,
        version_number,
        image_storage_path,
        image_width,
        image_height,
        is_active,
        created_at
      `)
      .eq(
        "outlet_id",
        outletId
      )
      .order(
        "version_number",
        {
          ascending:
            false,
        }
      );


  if (templatesError) {
    return NextResponse.json(
      {
        error:
          templatesError.message,
      },
      {
        status: 400,
      }
    );
  }


  const templateRows =
    templates ??
    [];


  let selected =
    requestedTemplateId
      ? templateRows.find(
          (
            item
          ) =>
            item.id ===
            requestedTemplateId
        )
      : templateRows.find(
          (
            item
          ) =>
            item.is_active
        ) ||
        templateRows[0];


  if (
    requestedTemplateId &&
    !selected
  ) {
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


  let imageUrl:
    string |
    null =
    null;

  let zones:
    any[] =
    [];

  let bohPositions:
    any[] =
    [];


  if (selected) {
    const [
      signedResult,
      zoneResult,
      bohResult,
    ] =
      await Promise.all([
        admin.storage
          .from(
            BUCKET
          )
          .createSignedUrl(
            selected
              .image_storage_path,
            3600
          ),

        admin
          .from(
            "floor_mapping_zones"
          )
          .select(`
            id,
            zone_code,
            zone_name,
            zone_type,
            x_pct,
            y_pct,
            width_pct,
            height_pct,
            shape,
            display_label,
            capacity,
            sort_order,
            is_active
          `)
          .eq(
            "template_id",
            selected.id
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
          ),

        admin
          .from(
            "floor_mapping_boh_positions"
          )
          .select(`
            id,
            position_code,
            position_name,
            default_station,
            sort_order,
            is_active
          `)
          .eq(
            "template_id",
            selected.id
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
          ),
      ]);


    imageUrl =
      signedResult
        .data
        ?.signedUrl ||
      null;


    if (
      zoneResult.error
    ) {
      return NextResponse.json(
        {
          error:
            zoneResult
              .error
              .message,
        },
        {
          status: 400,
        }
      );
    }


    if (
      bohResult.error
    ) {
      return NextResponse.json(
        {
          error:
            bohResult
              .error
              .message,
        },
        {
          status: 400,
        }
      );
    }


    zones =
      zoneResult.data ??
      [];


    bohPositions =
      bohResult.data ??
      [];
  }


  return NextResponse.json({
    outlet,

    templates:
      templateRows,

    selectedTemplate:
      selected ??
      null,

    imageUrl,

    zones,

    bohPositions,
  });
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


  const formData =
    await request.formData();


  const outletId =
    String(
      formData.get(
        "outlet_id"
      ) ||
      ""
    ).trim();


  const name =
    String(
      formData.get(
        "name"
      ) ||
      ""
    )
      .trim()
      .slice(
        0,
        180
      );


  const activate =
    String(
      formData.get(
        "activate"
      ) ||
      "true"
    ) !==
    "false";


  const image =
    formData.get(
      "image"
    );


  if (
    !outletId ||
    !name
  ) {
    return NextResponse.json(
      {
        error:
          "Outlet and template name are required.",
      },
      {
        status: 400,
      }
    );
  }


  if (
    !(image instanceof File) ||
    image.size ===
      0
  ) {
    return NextResponse.json(
      {
        error:
          "Floor plan image is required.",
      },
      {
        status: 400,
      }
    );
  }


  if (
    !image.type.startsWith(
      "image/"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Floor plan must be an image.",
      },
      {
        status: 400,
      }
    );
  }


  if (
    image.size >
    15 * 1024 * 1024
  ) {
    return NextResponse.json(
      {
        error:
          "Floor plan maximum size is 15 MB.",
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
      outlet,
  } =
    await admin
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name,
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
    return NextResponse.json(
      {
        error:
          "Outlet not found.",
      },
      {
        status: 404,
      }
    );
  }


  if (
    String(
      outlet.code
    )
      .trim()
      .toUpperCase() ===
    "CNT"
  ) {
    return NextResponse.json(
      {
        error:
          "Central Kitchen cannot use Floor Mapping.",
      },
      {
        status: 400,
      }
    );
  }


  const {
    data:
      latest,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .select(`
        version_number
      `)
      .eq(
        "outlet_id",
        outlet.id
      )
      .order(
        "version_number",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  const version =
    Number(
      latest
        ?.version_number ||
      0
    ) + 1;


  const extension =
    imageExtension(
      image.type
    );


  const storagePath =
    [
      "floor-mapping",
      "templates",
      outlet.organization_id,
      outlet.id,
      `v${version}`,
      `${
        crypto.randomUUID()
      }.${extension}`,
    ].join(
      "/"
    );


  const buffer =
    Buffer.from(
      await image.arrayBuffer()
    );


  const {
    error:
      uploadError,
  } =
    await admin.storage
      .from(
        BUCKET
      )
      .upload(
        storagePath,
        buffer,
        {
          cacheControl:
            "3600",

          contentType:
            image.type,

          upsert:
            false,
        }
      );


  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message,
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
      insertError,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .insert({
        organization_id:
          outlet.organization_id,

        outlet_id:
          outlet.id,

        name,

        version_number:
          version,

        image_storage_path:
          storagePath,

        is_active:
          false,

        created_by:
          context.user.id,
      })
      .select(`
        id,
        name,
        version_number,
        is_active
      `)
      .single();


  if (
    insertError ||
    !template
  ) {
    await admin.storage
      .from(
        BUCKET
      )
      .remove([
        storagePath,
      ]);


    return NextResponse.json(
      {
        error:
          insertError
            ?.message ||
          "Unable to create template.",
      },
      {
        status: 400,
      }
    );
  }


  const bohRows =
    DEFAULT_BOH_POSITIONS.map(
      (
        [
          code,
          position,
          station,
        ],
        index
      ) => ({
        template_id:
          template.id,

        position_code:
          code,

        position_name:
          position,

        default_station:
          station,

        sort_order:
          index + 1,
      })
    );


  const {
    error:
      bohError,
  } =
    await admin
      .from(
        "floor_mapping_boh_positions"
      )
      .insert(
        bohRows
      );


  if (bohError) {
    await admin
      .from(
        "floor_mapping_templates"
      )
      .delete()
      .eq(
        "id",
        template.id
      );


    await admin.storage
      .from(
        BUCKET
      )
      .remove([
        storagePath,
      ]);


    return NextResponse.json(
      {
        error:
          bohError.message,
      },
      {
        status: 400,
      }
    );
  }


  if (activate) {
    const {
      error:
        activateError,
    } =
      await admin.rpc(
        "activate_floor_mapping_template",
        {
          p_template_id:
            template.id,
        }
      );


    if (activateError) {
      return NextResponse.json(
        {
          error:
            activateError.message,
        },
        {
          status: 400,
        }
      );
    }
  }


  return NextResponse.json({
    ok:
      true,

    template: {
      ...template,

      is_active:
        activate,
    },
  });
}


export async function PATCH(
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


  if (!templateId) {
    return NextResponse.json(
      {
        error:
          "template_id is required.",
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
    error,
  } =
    await admin.rpc(
      "activate_floor_mapping_template",
      {
        p_template_id:
          templateId,
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
