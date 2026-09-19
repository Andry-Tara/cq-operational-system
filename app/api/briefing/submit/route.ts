import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";


export const runtime =
  "nodejs";


const VALID_SESSIONS =
  new Set([
    "MORNING",
    "AFTERNOON",
    "CLOSING",
  ]);


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


function safeExtension(
  mimeType: string
) {
  switch (
    mimeType.toLowerCase()
  ) {
    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/heic":
      return "heic";

    case "image/heif":
      return "heif";

    default:
      return "jpg";
  }
}


export async function POST(
  request: NextRequest
) {
  let uploadedPath:
    string |
    null =
    null;


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


    const formData =
      await request.formData();


    const sessionType =
      String(
        formData.get(
          "session_type"
        ) ||
        ""
      )
        .trim()
        .toUpperCase();


    const title =
      String(
        formData.get(
          "title"
        ) ||
        ""
      )
        .trim()
        .slice(
          0,
          250
        );


    const notes =
      String(
        formData.get(
          "notes"
        ) ||
        ""
      )
        .trim()
        .slice(
          0,
          10000
        );


    const sectionsRaw =
      String(
        formData.get(
          "sections"
        ) ||
        "[]"
      );


    const photo =
      formData.get(
        "photo"
      );


    if (
      !VALID_SESSIONS.has(
        sessionType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Session must be Morning, Afternoon, or Closing.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !(photo instanceof File) ||
      photo.size === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Briefing photo is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !String(
        photo.type ||
        ""
      ).startsWith(
        "image/"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Briefing photo must be an image.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      photo.size >
      10 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          error:
            "Briefing photo maximum size is 10 MB.",
        },
        {
          status: 400,
        }
      );
    }


    let sections:
      Array<{
        title: string;
        content: string;
      }>;


    try {
      const parsed =
        JSON.parse(
          sectionsRaw
        );


      if (
        !Array.isArray(
          parsed
        )
      ) {
        throw new Error(
          "Invalid sections."
        );
      }


      if (
        parsed.length >
        20
      ) {
        throw new Error(
          "Maximum 20 custom sections."
        );
      }


      sections =
        parsed.map(
          (
            item: any
          ) => ({
            title:
              String(
                item?.title ||
                ""
              )
                .trim()
                .slice(
                  0,
                  250
                ),

            content:
              String(
                item?.content ||
                ""
              )
                .trim()
                .slice(
                  0,
                  10000
                ),
          })
        );


      if (
        sections.some(
          (
            item
          ) =>
            !item.title ||
            !item.content
        )
      ) {
        throw new Error(
          "Custom section title and content are required."
        );
      }

    } catch (
      error: any
    ) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "Invalid Briefing sections.",
        },
        {
          status: 400,
        }
      );
    }


    const admin =
      createAdminClient();


    const [
      profileResult,
      outletResult,
      assignmentResult,
    ] =
      await Promise.all([
        admin
          .from(
            "profiles"
          )
          .select(`
            id,
            full_name,
            organization_id,
            is_active
          `)
          .eq(
            "id",
            user.id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle(),

        admin
          .from(
            "outlets"
          )
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
            outlet.id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle(),

        admin
          .from(
            "user_outlets"
          )
          .select(`
            outlet_id
          `)
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "outlet_id",
            outlet.id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle(),
      ]);


    const profile =
      profileResult.data;

    const outletRow =
      outletResult.data;

    const assignment =
      assignmentResult.data;


    if (
      !profile ||
      !outletRow ||
      !assignment
    ) {
      return NextResponse.json(
        {
          error:
            "Briefing can only be submitted by an assigned outlet PIC.",
        },
        {
          status: 403,
        }
      );
    }


    if (
      profile.organization_id !==
      outletRow.organization_id
    ) {
      return NextResponse.json(
        {
          error:
            "Briefing organization mismatch.",
        },
        {
          status: 403,
        }
      );
    }


    if (
      String(
        outletRow.code
      )
        .trim()
        .toUpperCase() ===
      "CNT"
    ) {
      return NextResponse.json(
        {
          error:
            "Central Kitchen is not available for outlet Briefing.",
        },
        {
          status: 400,
        }
      );
    }


    const date =
      businessDate(
        outletRow.timezone ||
        "Asia/Jakarta"
      );


    const {
      data:
        existing,
    } =
      await admin
        .from(
          "briefing_sessions"
        )
        .select(`
          id
        `)
        .eq(
          "outlet_id",
          outletRow.id
        )
        .eq(
          "business_date",
          date
        )
        .eq(
          "session_type",
          sessionType
        )
        .maybeSingle();


    if (existing) {
      return NextResponse.json(
        {
          error:
            "This Briefing session has already been submitted today.",
        },
        {
          status: 409,
        }
      );
    }


    const extension =
      safeExtension(
        photo.type ||
        "image/jpeg"
      );


    const objectName =
      crypto.randomUUID();


    const storagePath =
      [
        "briefings",
        profile.organization_id,
        outletRow.id,
        date,
        sessionType.toLowerCase(),
        `${objectName}.${extension}`,
      ].join(
        "/"
      );


    const buffer =
      Buffer.from(
        await photo.arrayBuffer()
      );


    const {
      error:
        uploadError,
    } =
      await admin.storage
        .from(
          "operational-photos"
        )
        .upload(
          storagePath,
          buffer,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              photo.type ||
              "image/jpeg",
          }
        );


    if (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError.message ||
            "Unable to upload Briefing photo.",
        },
        {
          status: 400,
        }
      );
    }


    uploadedPath =
      storagePath;


    const {
      data:
        inserted,
      error:
        insertError,
    } =
      await admin
        .from(
          "briefing_sessions"
        )
        .insert({
          organization_id:
            profile.organization_id,

          outlet_id:
            outletRow.id,

          business_date:
            date,

          session_type:
            sessionType,

          title:
            title ||
            null,

          notes:
            notes ||
            null,

          sections,

          photo_storage_path:
            storagePath,

          photo_original_filename:
            photo.name ||
            null,

          photo_mime_type:
            photo.type ||
            null,

          photo_size_bytes:
            photo.size,

          created_by:
            user.id,

          pic_name_snapshot:
            profile.full_name ||
            user.email ||
            "Outlet PIC",
        })
        .select(`
          id,
          business_date,
          session_type,
          title,
          submitted_at
        `)
        .single();


    if (insertError) {
      await admin.storage
        .from(
          "operational-photos"
        )
        .remove([
          storagePath,
        ]);


      uploadedPath =
        null;


      const conflict =
        insertError.code ===
        "23505";


      return NextResponse.json(
        {
          error:
            conflict
              ? "This Briefing session has already been submitted today."
              : insertError.message,
        },
        {
          status:
            conflict
              ? 409
              : 400,
        }
      );
    }


    uploadedPath =
      null;


    return NextResponse.json({
      ok:
        true,

      briefing:
        inserted,
    });

  } catch (
    error: any
  ) {
    console.error(
      "Briefing submit error:",
      error
    );


    if (
      uploadedPath
    ) {
      try {
        const admin =
          createAdminClient();


        await admin.storage
          .from(
            "operational-photos"
          )
          .remove([
            uploadedPath,
          ]);

      } catch {
        // best effort cleanup
      }
    }


    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to submit Briefing.",
      },
      {
        status: 500,
      }
    );
  }
}
