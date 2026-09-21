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


async function authorize() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Unauthorized.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      "pos.manage"
    )
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Forbidden.",
          },
          {
            status: 403,
          }
        ),
    };
  }


  return {
    context,
  };
}


export async function POST(
  request:
    NextRequest
) {
  const auth =
    await authorize();


  if ("error" in auth) {
    return auth.error;
  }


  const {
    context,
  } =
    auth;


  const body =
    await request
      .json()
      .catch(
        () =>
          null
      );


  const action =
    String(
      body?.action ||
      "SET"
    )
      .trim()
      .toUpperCase();


  const externalBranchId =
    Number(
      body?.externalBranchId
    );


  const outletId =
    String(
      body?.outletId ||
      ""
    ).trim();


  if (
    !Number.isFinite(
      externalBranchId
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid external branch.",
      },
      {
        status: 400,
      }
    );
  }


  const admin:
    any =
    createAdminClient();


  if (
    action ===
    "DELETE"
  ) {
    const {
      error,
    } =
      await admin
        .from(
          "pos_branch_mappings"
        )
        .delete()
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "provider",
          "CHONGQING"
        )
        .eq(
          "external_branch_id",
          externalBranchId
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


  if (!outletId) {
    return NextResponse.json(
      {
        error:
          "Outlet is required.",
      },
      {
        status: 400,
      }
    );
  }


  const [
    branchResult,
    outletResult,
  ] =
    await Promise.all([
      admin
        .from(
          "pos_external_branches"
        )
        .select(
          "external_branch_id, name"
        )
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "provider",
          "CHONGQING"
        )
        .eq(
          "external_branch_id",
          externalBranchId
        )
        .maybeSingle(),

      admin
        .from(
          "outlets"
        )
        .select(
          "id, name"
        )
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "id",
          outletId
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),
    ]);


  const branch =
    branchResult.data;

  const outlet =
    outletResult.data;


  if (!branch) {
    return NextResponse.json(
      {
        error:
          "External branch not found. Refresh branches first.",
      },
      {
        status: 400,
      }
    );
  }


  if (!outlet) {
    return NextResponse.json(
      {
        error:
          "Outlet not found.",
      },
      {
        status: 400,
      }
    );
  }


  const {
    error,
  } =
    await admin
      .from(
        "pos_branch_mappings"
      )
      .upsert({
        organization_id:
          context.profile
            .organization_id,

        provider:
          "CHONGQING",

        external_branch_id:
          externalBranchId,

        external_branch_name:
          branch.name,

        outlet_id:
          outletId,

        is_active:
          true,

        created_by:
          context.user.id,
      }, {
        onConflict:
          "organization_id,provider,external_branch_id",
      });


  if (error) {
    return NextResponse.json(
      {
        error:
          error.code ===
          "23505"
            ? "This outlet is already mapped to another POS branch."
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
  });
}
