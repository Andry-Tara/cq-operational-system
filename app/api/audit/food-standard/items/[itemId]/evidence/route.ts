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

import {
  distanceMeters,
} from "@/lib/photo-evidence/distance";


function safeFilename(
  value: string,
) {
  return (
    value
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .slice(
        0,
        120,
      ) ||
    "photo.jpg"
  );
}


function numericHeader(
  request:
    NextRequest,
  name:
    string,
) {
  const raw =
    request.headers.get(
      name,
    );

  if (
    raw == null ||
    raw ===
      ""
  ) {
    return null;
  }

  const value =
    Number(
      raw,
    );

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}


async function runtimeContext() {
  const access =
    await checkPermissionApi(
      "audit.submit",
    );

  if (!access.ok) {
    return {
      ok:
        false as const,

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
      ok:
        false as const,

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

  const activeOutlet =
    await getActiveOutlet();

  if (!activeOutlet) {
    return {
      ok:
        false as const,

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
    data:
      outlet,
    error:
      outletError,
  } =
    await admin
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
        activeOutlet.id,
      )
      .maybeSingle();

  if (
    outletError ||
    !outlet
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            error:
              "Active outlet was not found.",
          },
          {
            status:
              404,
          },
        ),
    };
  }

  return {
    ok:
      true as const,

    admin,
    user,
    outlet,
  };
}


async function loadItem(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  itemId:
    string,
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


function sessionOf(
  item: any,
) {
  const raw =
    item
      ?.qa_food_sessions;

  return Array.isArray(
    raw,
  )
    ? raw[0]
    : raw;
}


export async function POST(
  request:
    NextRequest,
  {
    params,
  }: {
    params:
      Promise<{
        itemId:
          string;
      }>;
  },
) {
  let uploadedPath:
    string | null =
    null;

  try {
    const ctx =
      await runtimeContext();

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
      sessionOf(
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
            "QA Food evidence scope mismatch.",
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
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Mark Served before adding photo evidence.",
        },
        {
          status:
            409,
        },
      );
    }


    const {
      count,
      error:
        countError,
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

    if (countError) {
      throw countError;
    }

    if (
      Number(
        count ||
          0,
      ) >=
      3
    ) {
      return NextResponse.json(
        {
          error:
            "Maksimal 3 photo evidence per menu.",
        },
        {
          status:
            409,
        },
      );
    }


    const contentType =
      request.headers.get(
        "content-type",
      ) ||
      "";

    if (
      !contentType.startsWith(
        "image/",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Evidence harus berupa gambar.",
        },
        {
          status:
            400,
        },
      );
    }


    const captureSource =
      request.headers.get(
        "x-capture-source",
      ) ===
      "CAMERA"
        ? "CAMERA"
        : "GALLERY";


    const originalFilename =
      safeFilename(
        decodeURIComponent(
          request.headers.get(
            "x-file-name",
          ) ||
            "photo.jpg",
        ),
      );


    let capturedAt:
      string | null =
      null;

    let latitude:
      number | null =
      null;

    let longitude:
      number | null =
      null;

    let accuracy:
      number | null =
      null;

    let distance:
      number | null =
      null;

    let locationStatus =
      "GALLERY";

    let watermarkVersion:
      string | null =
      null;


    if (
      captureSource ===
      "CAMERA"
    ) {
      const rawCapturedAt =
        request.headers.get(
          "x-captured-at",
        );

      if (
        !rawCapturedAt ||
        Number.isNaN(
          new Date(
            rawCapturedAt,
          ).getTime(),
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Camera capture timestamp is missing.",
          },
          {
            status:
              400,
          },
        );
      }

      capturedAt =
        new Date(
          rawCapturedAt,
        ).toISOString();

      watermarkVersion =
        request.headers.get(
          "x-watermark-version",
        );

      if (
        watermarkVersion !==
        "OPS_PHOTO_V1"
      ) {
        return NextResponse.json(
          {
            error:
              "Camera evidence must contain OPS timestamp watermark.",
          },
          {
            status:
              400,
          },
        );
      }

      latitude =
        numericHeader(
          request,
          "x-latitude",
        );

      longitude =
        numericHeader(
          request,
          "x-longitude",
        );

      accuracy =
        numericHeader(
          request,
          "x-location-accuracy-m",
        );


      const hasDeviceGps =
        latitude !==
          null &&
        longitude !==
          null;

      const hasOutletGps =
        ctx.outlet
          .latitude !==
          null &&
        ctx.outlet
          .longitude !==
          null;


      if (
        hasDeviceGps &&
        hasOutletGps
      ) {
        distance =
          distanceMeters(
            latitude!,
            longitude!,
            Number(
              ctx.outlet
                .latitude,
            ),
            Number(
              ctx.outlet
                .longitude,
            ),
          );

        if (
          accuracy !==
            null &&
          accuracy >
            Number(
              ctx.outlet
                .photo_location_accuracy_threshold_m ||
                100,
            )
        ) {
          locationStatus =
            "LOW_ACCURACY";
        } else if (
          distance >
          Number(
            ctx.outlet
              .photo_geofence_radius_m ||
              150,
          )
        ) {
          locationStatus =
            "OUTSIDE_AREA";
        } else {
          locationStatus =
            "VERIFIED";
        }
      } else {
        locationStatus =
          "LOCATION_UNAVAILABLE";
      }
    }


    const bytes =
      new Uint8Array(
        await request.arrayBuffer(),
      );

    if (
      bytes.byteLength <
      1
    ) {
      return NextResponse.json(
        {
          error:
            "File foto kosong.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      bytes.byteLength >
      8 *
        1024 *
        1024
    ) {
      return NextResponse.json(
        {
          error:
            "Maksimal ukuran foto 8 MB.",
        },
        {
          status:
            413,
        },
      );
    }


    uploadedPath = [
      "qa-food",
      session.id,
      item.id,
      `${crypto.randomUUID()}.jpg`,
    ].join(
      "/",
    );


    const {
      error:
        uploadError,
    } =
      await ctx.admin
        .storage
        .from(
          "operational-photos",
        )
        .upload(
          uploadedPath,
          bytes,
          {
            contentType,

            upsert:
              false,
          },
        );

    if (
      uploadError
    ) {
      throw uploadError;
    }


    const {
      data:
        evidence,
      error:
        evidenceError,
    } =
      await ctx.admin
        .from(
          "qa_food_evidence",
        )
        .insert({
          item_id:
            item.id,

          storage_bucket:
            "operational-photos",

          storage_path:
            uploadedPath,

          original_filename:
            originalFilename,

          mime_type:
            contentType,

          file_size:
            bytes.byteLength,

          sort_order:
            (
              Number(
                count ||
                  0,
              ) +
              1
            ) *
            10,

          captured_by:
            ctx.user.id,

          captured_at:
            capturedAt,

          uploaded_at:
            new Date()
              .toISOString(),

          capture_source:
            captureSource,

          latitude,

          longitude,

          location_accuracy_m:
            accuracy,

          outlet_latitude:
            ctx.outlet
              .latitude,

          outlet_longitude:
            ctx.outlet
              .longitude,

          distance_from_outlet_m:
            distance,

          location_status:
            locationStatus,

          outlet_timezone:
            ctx.outlet
              .timezone ||
            "Asia/Jakarta",

          watermark_version:
            watermarkVersion,
        })
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
          latitude,
          longitude,
          location_accuracy_m,
          distance_from_outlet_m,
          location_status,
          outlet_timezone,
          watermark_version,
          created_at
        `)
        .single();

    if (
      evidenceError
    ) {
      throw evidenceError;
    }


    const {
      data:
        signed,
    } =
      await ctx.admin
        .storage
        .from(
          "operational-photos",
        )
        .createSignedUrl(
          uploadedPath,
          60 *
            60,
        );


    return NextResponse.json({
      evidence: {
        ...evidence,

        signed_url:
          signed
            ?.signedUrl ||
          null,
      },
    });
  } catch (
    error: any
  ) {
    if (
      uploadedPath
    ) {
      try {
        const admin =
          createAdminClient();

        await admin.storage
          .from(
            "operational-photos",
          )
          .remove([
            uploadedPath,
          ]);
      } catch {}
    }

    console.error(
      "QA Food evidence upload error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to upload photo evidence.",
      },
      {
        status:
          500,
      },
    );
  }
}


export async function DELETE(
  request:
    NextRequest,
  {
    params,
  }: {
    params:
      Promise<{
        itemId:
          string;
      }>;
  },
) {
  try {
    const ctx =
      await runtimeContext();

    if (!ctx.ok) {
      return ctx.response;
    }

    const {
      itemId,
    } =
      await params;

    const {
      evidence_id,
    } =
      await request.json();

    const item =
      await loadItem(
        ctx.admin,
        itemId,
      );

    const session =
      sessionOf(
        item,
      );

    if (
      !item ||
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
            "QA Food evidence scope mismatch.",
        },
        {
          status:
            403,
        },
      );
    }

    const {
      data:
        evidence,
      error:
        evidenceError,
    } =
      await ctx.admin
        .from(
          "qa_food_evidence",
        )
        .select(`
          id,
          storage_bucket,
          storage_path
        `)
        .eq(
          "id",
          evidence_id,
        )
        .eq(
          "item_id",
          item.id,
        )
        .maybeSingle();

    if (
      evidenceError
    ) {
      throw evidenceError;
    }

    if (!evidence) {
      return NextResponse.json(
        {
          error:
            "Photo evidence was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const {
      error:
        storageError,
    } =
      await ctx.admin
        .storage
        .from(
          evidence
            .storage_bucket,
        )
        .remove([
          evidence
            .storage_path,
        ]);

    if (
      storageError
    ) {
      throw storageError;
    }

    const {
      error:
        deleteError,
    } =
      await ctx.admin
        .from(
          "qa_food_evidence",
        )
        .delete()
        .eq(
          "id",
          evidence.id,
        );

    if (
      deleteError
    ) {
      throw deleteError;
    }

    return NextResponse.json({
      ok:
        true,
    });
  } catch (
    error: any
  ) {
    console.error(
      "QA Food evidence delete error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to delete photo evidence.",
      },
      {
        status:
          500,
      },
    );
  }
}
