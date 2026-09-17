import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SHARE_VALIDITY_MS =
  7 *
  24 *
  60 *
  60 *
  1000;

function hashToken(
  token: string,
) {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

async function getOwnedSession(
  sessionId: string,
) {
  const access =
    await checkPermissionApi(
      "audit.submit",
    );

  if (!access.ok) {
    return {
      error:
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
      error:
        NextResponse.json(
          {
            error:
              "Unauthorized",
          },
          {
            status: 401,
          },
        ),
    };
  }

  const admin =
    createAdminClient();

  const {
    data: session,
    error:
      sessionError,
  } =
    await admin
      .from(
        "audit_sessions",
      )
      .select(`
        id,
        organization_id,
        audit_number,
        status,
        auditor_user_id,
        pdf_storage_path
      `)
      .eq(
        "id",
        sessionId,
      )
      .maybeSingle();

  if (
    sessionError ||
    !session
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Audit session tidak ditemukan.",
          },
          {
            status: 404,
          },
        ),
    };
  }

  if (
    session.auditor_user_id !==
    user.id
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Audit session bukan milik user ini.",
          },
          {
            status: 403,
          },
        ),
    };
  }

  if (
    session.status !==
    "submitted"
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Audit belum disubmit.",
          },
          {
            status: 409,
          },
        ),
    };
  }

  return {
    admin,
    user,
    session,
  };
}

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      sessionId: string;
    }>;
  },
) {
  try {
    const {
      sessionId,
    } =
      await params;

    if (
      !UUID.test(
        sessionId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid audit session.",
        },
        {
          status: 400,
        },
      );
    }

    const context =
      await getOwnedSession(
        sessionId,
      );

    if (
      "error" in context
    ) {
      return context.error;
    }

    const {
      admin,
      user,
      session,
    } =
      context;

    if (
      !session.pdf_storage_path
    ) {
      return NextResponse.json(
        {
          error:
            "Audit PDF belum dipersist.",

          code:
            "AUDIT_PDF_NOT_READY",
        },
        {
          status: 409,
        },
      );
    }

    const now =
      new Date();

    // Revoke any previous non-revoked link.
    // This also cleans up expired links before creating a new one.
    const {
      error: revokeError,
    } =
      await admin
        .from(
          "audit_report_shares",
        )
        .update({
          revoked_at:
            now.toISOString(),
        })
        .eq(
          "audit_session_id",
          session.id,
        )
        .is(
          "revoked_at",
          null,
        );

    if (revokeError) {
      throw revokeError;
    }

    const token =
      randomBytes(32)
        .toString(
          "base64url",
        );

    const tokenHash =
      hashToken(token);

    const expiresAt =
      new Date(
        now.getTime() +
          SHARE_VALIDITY_MS,
      );

    const {
      data: share,
      error:
        insertError,
    } =
      await admin
        .from(
          "audit_report_shares",
        )
        .insert({
          audit_session_id:
            session.id,

          organization_id:
            session.organization_id,

          created_by:
            user.id,

          token_hash:
            tokenHash,

          expires_at:
            expiresAt
              .toISOString(),
        })
        .select(`
          id,
          expires_at
        `)
        .single();

    if (
      insertError ||
      !share
    ) {
      throw (
        insertError ||
        new Error(
          "Unable to create audit share.",
        )
      );
    }

    return NextResponse.json({
      success: true,

      sharePath:
        `/r/a/${token}`,

      expiresAt:
        share.expires_at,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Create audit share error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to share audit report.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      sessionId: string;
    }>;
  },
) {
  try {
    const {
      sessionId,
    } =
      await params;

    if (
      !UUID.test(
        sessionId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid audit session.",
        },
        {
          status: 400,
        },
      );
    }

    const context =
      await getOwnedSession(
        sessionId,
      );

    if (
      "error" in context
    ) {
      return context.error;
    }

    const {
      admin,
      session,
    } =
      context;

    const {
      error,
    } =
      await admin
        .from(
          "audit_report_shares",
        )
        .update({
          revoked_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "audit_session_id",
          session.id,
        )
        .is(
          "revoked_at",
          null,
        );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Revoke audit share error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to revoke audit share.",
      },
      {
        status: 500,
      },
    );
  }
}
