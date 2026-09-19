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


const VALID =
  new Set([
    "STANDARD",
    "NOT_STANDARD",
  ]);


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


    const checkId =
      typeof body?.check_id ===
      "string"
        ? body.check_id.trim()
        : "";


    const correctionNote =
      typeof body?.correction_note ===
      "string"
        ? body.correction_note.trim()
        : "";


    const colorStatus =
      String(
        body?.color_status ||
        ""
      )
        .trim()
        .toUpperCase();


    const tasteStatus =
      String(
        body?.taste_status ||
        ""
      )
        .trim()
        .toUpperCase();


    const textureStatus =
      String(
        body?.texture_status ||
        ""
      )
        .trim()
        .toUpperCase();


    const notes =
      typeof body?.notes ===
      "string"
        ? body.notes.trim()
        : "";


    if (
      !checkId ||
      !correctionNote
    ) {
      return NextResponse.json(
        {
          error:
            "Correction Note is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !VALID.has(
        colorStatus
      ) ||
      !VALID.has(
        tasteStatus
      ) ||
      !VALID.has(
        textureStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Warna, Rasa, and Tekstur are required.",
        },
        {
          status: 400,
        }
      );
    }


    const stillNotStandard =
      colorStatus ===
        "NOT_STANDARD" ||
      tasteStatus ===
        "NOT_STANDARD" ||
      textureStatus ===
        "NOT_STANDARD";


    if (
      stillNotStandard &&
      !notes
    ) {
      return NextResponse.json(
        {
          error:
            "Notes are required when Re-Test is still Not Standard.",
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
      assignmentResult,
      checkResult,
    ] =
      await Promise.all([
        admin
          .from(
            "profiles"
          )
          .select(`
            id,
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

        admin
          .from(
            "test_food_checks"
          )
          .select(`
            id,
            session_id,
            result_status
          `)
          .eq(
            "id",
            checkId
          )
          .maybeSingle(),
      ]);


    const profile =
      profileResult.data;

    const assignment =
      assignmentResult.data;

    const check =
      checkResult.data;


    if (
      !profile ||
      !assignment
    ) {
      return NextResponse.json(
        {
          error:
            "Test Food Re-Test can only be completed by an assigned outlet PIC.",
        },
        {
          status: 403,
        }
      );
    }


    if (!check) {
      return NextResponse.json(
        {
          error:
            "Test Food check was not found.",
        },
        {
          status: 404,
        }
      );
    }


    if (
      check.result_status !==
      "NEEDS_CORRECTION"
    ) {
      return NextResponse.json(
        {
          error:
            "This menu does not require a Re-Test.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        session,
      error:
        sessionError,
    } =
      await admin
        .from(
          "test_food_sessions"
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          status
        `)
        .eq(
          "id",
          check.session_id
        )
        .maybeSingle();


    if (
      sessionError ||
      !session
    ) {
      return NextResponse.json(
        {
          error:
            sessionError?.message ||
            "Test Food session was not found.",
        },
        {
          status: 404,
        }
      );
    }


    if (
      session.organization_id !==
        profile.organization_id ||
      session.outlet_id !==
        outlet.id ||
      session.status !==
        "SUBMITTED"
    ) {
      return NextResponse.json(
        {
          error:
            "Test Food Re-Test scope mismatch.",
        },
        {
          status: 403,
        }
      );
    }


    const {
      data:
        latestRetest,
      error:
        latestError,
    } =
      await admin
        .from(
          "test_food_retests"
        )
        .select(`
          id,
          attempt_no,
          result_status
        `)
        .eq(
          "check_id",
          check.id
        )
        .order(
          "attempt_no",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle();


    if (latestError) {
      return NextResponse.json(
        {
          error:
            latestError.message,
        },
        {
          status: 400,
        }
      );
    }


    if (
      latestRetest
        ?.result_status ===
      "PASS"
    ) {
      return NextResponse.json(
        {
          error:
            "This Test Food item has already passed Re-Test.",
        },
        {
          status: 409,
        }
      );
    }


    const attemptNo =
      Number(
        latestRetest
          ?.attempt_no ||
        0
      ) + 1;


    const {
      data:
        inserted,
      error:
        insertError,
    } =
      await admin
        .from(
          "test_food_retests"
        )
        .insert({
          check_id:
            check.id,

          attempt_no:
            attemptNo,

          correction_note:
            correctionNote,

          color_status:
            colorStatus,

          taste_status:
            tasteStatus,

          texture_status:
            textureStatus,

          notes:
            notes ||
            null,

          tested_by:
            user.id,
        })
        .select(`
          id,
          attempt_no,
          result_status,
          tested_at
        `)
        .single();


    if (insertError) {
      return NextResponse.json(
        {
          error:
            insertError.message,
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      retest:
        inserted,
    });

  } catch (error: any) {
    console.error(
      "Test Food Re-Test error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to submit Test Food Re-Test.",
      },
      {
        status: 500,
      }
    );
  }
}
