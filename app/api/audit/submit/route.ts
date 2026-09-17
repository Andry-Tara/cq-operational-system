import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request
) {
  try {
    const access =
      await checkPermissionApi(
        "audit.submit"
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
        }
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
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => null
        );

    const sessionId =
      typeof body?.sessionId ===
      "string"
        ? body.sessionId
        : "";

    if (
      !UUID.test(
        sessionId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid audit session.",
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data,
      error,
    } =
      await admin.rpc(
        "submit_audit_with_monthly_score",
        {
          p_session_id:
            sessionId,

          p_auditor_user_id:
            user.id,
        }
      );

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.session
    ) {
      throw new Error(
        "Audit scoring transaction returned an invalid response."
      );
    }

    return NextResponse.json(
      data
    );
  } catch (
    error: any
  ) {
    console.error(
      "Audit submit error:",
      error
    );

    const message =
      error?.message ||
      "Unable to submit audit.";

    const status =
      message.includes(
        "tidak ditemukan"
      )
        ? 404
        : message.includes(
              "bukan milik"
            )
          ? 403
          : message.includes(
                "tidak dapat disubmit"
              )
            ? 409
            : 500;

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }
}
