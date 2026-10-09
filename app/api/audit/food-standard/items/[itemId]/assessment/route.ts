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


const VALID_STATUS =
  new Set([
    "STANDARD",
    "NOT_STANDARD",
  ]);


const CRITERIA = [
  {
    status:
      "visual_status",
    note:
      "visual_note",
    label:
      "Visual / Presentation",
  },
  {
    status:
      "serving_method_status",
    note:
      "serving_method_note",
    label:
      "Serving Method",
  },
  {
    status:
      "plating_status",
    note:
      "plating_note",
    label:
      "Plating & Garnish",
  },
  {
    status:
      "aroma_status",
    note:
      "aroma_note",
    label:
      "Aroma",
  },
  {
    status:
      "ingredients_status",
    note:
      "ingredients_note",
    label:
      "Ingredients",
  },
  {
    status:
      "portion_status",
    note:
      "portion_note",
    label:
      "Portion",
  },
  {
    status:
      "temperature_status",
    note:
      "temperature_note",
    label:
      "Temperature",
  },
  {
    status:
      "taste_status",
    note:
      "taste_note",
    label:
      "Taste",
  },
  {
    status:
      "texture_status",
    note:
      "texture_note",
    label:
      "Texture",
  },
] as const;


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

  return {
    ok: true as const,
    admin:
      createAdminClient(),
    user,
    outlet,
  };
}


async function loadItem(
  admin: ReturnType<
    typeof createAdminClient
  >,
  itemId: string,
) {
  const {
    data,
    error,
  } =
    await admin
      .from(
        "qa_food_session_items",
      )
      .select(`
        id,
        session_id,
        state,
        menu_name_snapshot,
        service_status,
        service_seconds,
        served_at,
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

  if (error) {
    throw error;
  }

  return data;
}


function scopedSession(
  item: any,
) {
  const raw =
    item?.qa_food_sessions;

  return Array.isArray(
    raw,
  )
    ? raw[0]
    : raw;
}


function parseOptionalNumber(
  value: FormDataEntryValue | null,
) {
  if (
    value == null ||
    String(
      value,
    ).trim() ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      String(
        value,
      )
        .trim()
        .replace(
          ",",
          ".",
        ),
    );

  return number;
}


function extensionFor(
  file: File,
) {
  const fromName =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        "",
      );

  if (
    fromName &&
    fromName.length <=
      5
  ) {
    return fromName;
  }

  if (
    file.type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    file.type ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    file.type ===
      "image/heic" ||
    file.type ===
      "image/heif"
  ) {
    return "heic";
  }

  return "jpg";
}


export async function GET(
  _request: NextRequest,
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
    const ctx =
      await context();

    if (!ctx.ok) {
      return ctx.response;
    }

    const {
      itemId,
    } =
      await params;

    const item =
      await loadItem(
        ctx.admin,
        itemId,
      );

    if (!item) {
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

    const session =
      scopedSession(
        item,
      );

    if (
      !session ||
      session.outlet_id !==
        ctx.outlet.id ||
      session.created_by !==
        ctx.user.id ||
      session.status !==
        "OPEN"
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food assessment scope mismatch.",
        },
        {
          status:
            403,
        },
      );
    }

    const [
      assessmentResult,
      evidenceResult,
    ] =
      await Promise.all([
        ctx.admin
          .from(
            "qa_food_assessments",
          )
          .select(`
            id,
            item_id,

            visual_status,
            visual_note,

            serving_method_status,
            serving_method_note,

            plating_status,
            plating_note,

            aroma_status,
            aroma_note,

            ingredients_status,
            ingredients_note,

            portion_status,
            portion_note,

            temperature_status,
            temperature_note,

            taste_status,
            taste_note,

            texture_status,
            texture_note,

            weight_grams,
            serving_temperature_c,

            result_status,
            assessed_at
          `)
          .eq(
            "item_id",
            item.id,
          )
          .maybeSingle(),

        ctx.admin
          .from(
            "qa_food_evidence",
          )
          .select(`
            id,
            storage_bucket,
            storage_path,
            original_filename,
            mime_type,
            file_size,
            sort_order,
            captured_at,
            uploaded_at,
            capture_source,
            location_accuracy_m,
            distance_from_outlet_m,
            location_status,
            outlet_timezone,
            watermark_version,
            created_at
          `)
          .eq(
            "item_id",
            item.id,
          )
          .order(
            "sort_order",
            {
              ascending:
                true,
            },
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            },
          ),
      ]);

    if (
      assessmentResult.error
    ) {
      throw assessmentResult.error;
    }

    if (
      evidenceResult.error
    ) {
      throw evidenceResult.error;
    }

    const evidence =
      await Promise.all(
        (
          evidenceResult.data ??
          []
        ).map(
          async (
            row,
          ) => {
            const {
              data:
                signed,
            } =
              await ctx.admin.storage
                .from(
                  row.storage_bucket,
                )
                .createSignedUrl(
                  row.storage_path,
                  60 * 60,
                );

            return {
              ...row,

              signed_url:
                signed
                  ?.signedUrl ||
                null,
            };
          },
        ),
      );

    const {
      data: photoOutlet,
      error: photoOutletError,
    } =
      await ctx.admin
        .from(
          "outlets",
        )
        .select(`
          id,
          name,
          timezone,
          latitude,
          longitude,
          photo_geofence_radius_m,
          photo_location_accuracy_threshold_m
        `)
        .eq(
          "id",
          ctx.outlet.id,
        )
        .single();

    if (
      photoOutletError
    ) {
      throw photoOutletError;
    }

    return NextResponse.json({
      photo_context: {
        outletName:
          photoOutlet.name,

        timezone:
          photoOutlet.timezone ||
          "Asia/Jakarta",

        latitude:
          photoOutlet.latitude,

        longitude:
          photoOutlet.longitude,

        geofenceRadiusM:
          Number(
            photoOutlet.photo_geofence_radius_m ||
            150,
          ),

        accuracyThresholdM:
          Number(
            photoOutlet.photo_location_accuracy_threshold_m ||
            100,
          ),
      },

      item: {
        id:
          item.id,

        menu_name:
          item.menu_name_snapshot,

        state:
          item.state,

        service_status:
          item.service_status,

        service_seconds:
          item.service_seconds,
      },

      assessment:
        assessmentResult.data ||
        null,

      evidence,
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food assessment GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load assessment.",
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
    const ctx =
      await context();

    if (!ctx.ok) {
      return ctx.response;
    }

    const {
      itemId,
    } =
      await params;

    const item =
      await loadItem(
        ctx.admin,
        itemId,
      );

    if (!item) {
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

    const session =
      scopedSession(
        item,
      );

    if (
      !session ||
      session.outlet_id !==
        ctx.outlet.id ||
      session.created_by !==
        ctx.user.id ||
      session.status !==
        "OPEN"
    ) {
      return NextResponse.json(
        {
          error:
            "QA Food assessment scope mismatch.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      ![
        "SERVED",
        "ASSESSED",
      ].includes(
        item.state,
      ) ||
      !item.served_at
    ) {
      return NextResponse.json(
        {
          error:
            "Mark Served before completing Quality Assessment.",
        },
        {
          status:
            409,
        },
      );
    }

    const body =
      await request.json();

    const assessmentData:
      Record<
        string,
        string | null
      > = {};

    const issueCriteria:
      string[] = [];

    for (
      const criterion of
      CRITERIA
    ) {
      const status =
        String(
          body?.[
            criterion.status
          ] ||
            "",
        ).trim();

      if (
        !VALID_STATUS.has(
          status,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Semua 9 Quality Assessment wajib diisi.",
          },
          {
            status:
              400,
          },
        );
      }

      const note =
        String(
          body?.[
            criterion.note
          ] ||
            "",
        ).trim();

      if (
        status ===
          "NOT_STANDARD" &&
        !note
      ) {
        return NextResponse.json(
          {
            error:
              `${criterion.label}: Reason / Notes wajib diisi.`,
          },
          {
            status:
              400,
          },
        );
      }

      assessmentData[
        criterion.status
      ] =
        status;

      assessmentData[
        criterion.note
      ] =
        status ===
        "NOT_STANDARD"
          ? note
          : null;

      if (
        status ===
        "NOT_STANDARD"
      ) {
        issueCriteria.push(
          criterion.status,
        );
      }
    }

    const weightRaw =
      body?.weight_grams;

    const weight =
      weightRaw ===
        "" ||
      weightRaw == null
        ? null
        : Number(
            String(
              weightRaw,
            ).replace(
              ",",
              ".",
            ),
          );

    const temperatureRaw =
      body
        ?.serving_temperature_c;

    const temperature =
      temperatureRaw ===
        "" ||
      temperatureRaw == null
        ? null
        : Number(
            String(
              temperatureRaw,
            ).replace(
              ",",
              ".",
            ),
          );

    if (
      weight !== null &&
      (
        !Number.isFinite(
          weight,
        ) ||
        weight < 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Weight tidak valid.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      temperature !==
        null &&
      (
        !Number.isFinite(
          temperature,
        ) ||
        temperature <
          -20 ||
        temperature >
          150
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Serving temperature tidak valid.",
        },
        {
          status:
            400,
        },
      );
    }

    const {
      count:
        evidenceCount,
      error:
        evidenceError,
    } =
      await ctx.admin
        .from(
          "qa_food_evidence",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "item_id",
          item.id,
        );

    if (
      evidenceError
    ) {
      throw evidenceError;
    }

    if (
      Number(
        evidenceCount ||
          0,
      ) <
      1
    ) {
      return NextResponse.json(
        {
          error:
            "Minimal 1 photo evidence wajib untuk setiap menu.",
        },
        {
          status:
            400,
        },
      );
    }

    const {
      data:
        assessment,
      error:
        assessmentError,
    } =
      await ctx.admin
        .from(
          "qa_food_assessments",
        )
        .upsert(
          {
            item_id:
              item.id,

            ...assessmentData,

            weight_grams:
              weight,

            serving_temperature_c:
              temperature,

            notes:
              null,

            assessed_by:
              ctx.user.id,

            assessed_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "item_id",
          },
        )
        .select(`
          id,
          item_id,
          result_status,
          assessed_at
        `)
        .single();

    if (
      assessmentError
    ) {
      throw assessmentError;
    }

    await ctx.admin
      .from(
        "qa_food_events",
      )
      .insert({
        session_id:
          item.session_id,

        item_id:
          item.id,

        event_type:
          item.state ===
          "ASSESSED"
            ? "QUALITY_ASSESSMENT_UPDATED"
            : "QUALITY_ASSESSED",

        actor_user_id:
          ctx.user.id,

        payload: {
          result_status:
            assessment
              .result_status,

          service_status:
            item.service_status,

          issue_criteria:
            issueCriteria,

          evidence_count:
            Number(
              evidenceCount ||
                0,
            ),
        },
      });

    return NextResponse.json({
      assessment,

      evidence_count:
        Number(
          evidenceCount ||
            0,
        ),
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food assessment POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to save Quality Assessment.",
      },
      {
        status:
          500,
      },
    );
  }
}
