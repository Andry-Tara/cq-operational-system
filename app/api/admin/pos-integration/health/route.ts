import {
  NextResponse,
} from "next/server";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  fetchPosBranches,
  posApiBaseUrl,
  posApiConfigured,
} from "@/lib/pos/chongqing-external-api";


export async function GET() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
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


  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      "pos.manage"
    )
  ) {
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


  if (
    !posApiConfigured()
  ) {
    return NextResponse.json({
      ok:
        false,

      configured:
        false,

      baseUrl:
        posApiBaseUrl() ||
        null,

      message:
        "POS API environment variables are not configured.",
    });
  }


  try {
    const branches =
      await fetchPosBranches();


    return NextResponse.json({
      ok:
        true,

      configured:
        true,

      baseUrl:
        posApiBaseUrl(),

      branchCount:
        branches.length,

      message:
        "ChongQing External API connection is healthy.",
    });

  } catch (
    error: any
  ) {
    return NextResponse.json({
      ok:
        false,

      configured:
        true,

      baseUrl:
        posApiBaseUrl(),

      message:
        error?.message ||
        "Unable to connect to ChongQing External API.",
    });
  }
}
