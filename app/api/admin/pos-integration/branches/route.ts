import {
  NextResponse,
} from "next/server";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  fetchPosBranches,
} from "@/lib/pos/chongqing-external-api";


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


export async function POST() {
  const auth =
    await authorize();


  if ("error" in auth) {
    return auth.error;
  }


  const {
    context,
  } =
    auth;


  const admin:
    any =
    createAdminClient();


  const {
    data:
      syncRun,
  } =
    await admin
      .from(
        "pos_sync_runs"
      )
      .insert({
        organization_id:
          context.profile
            .organization_id,

        provider:
          "CHONGQING",

        sync_type:
          "BRANCHES",

        status:
          "RUNNING",

        created_by:
          context.user.id,
      })
      .select(
        "id"
      )
      .single();


  try {
    const branches =
      await fetchPosBranches();


    const rows =
      branches.map(
        branch => ({
          organization_id:
            context.profile
              .organization_id,

          provider:
            "CHONGQING",

          external_branch_id:
            branch.id,

          name:
            branch.name,

          address:
            branch.address ??
            null,

          phone_number:
            branch.phone_number ??
            null,

          external_status:
            branch.status ??
            null,

          raw_payload:
            branch,

          last_synced_at:
            new Date()
              .toISOString(),
        })
      );


    if (
      rows.length >
      0
    ) {
      const {
        error,
      } =
        await admin
          .from(
            "pos_external_branches"
          )
          .upsert(
            rows,
            {
              onConflict:
                "organization_id,provider,external_branch_id",
            }
          );


      if (error) {
        throw error;
      }
    }


    if (syncRun?.id) {
      await admin
        .from(
          "pos_sync_runs"
        )
        .update({
          status:
            "SUCCESS",

          pages_processed:
            1,

          orders_seen:
            branches.length,

          completed_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          syncRun.id
        );
    }


    return NextResponse.json({
      ok:
        true,

      branches:
        branches.length,
    });

  } catch (
    error: any
  ) {
    if (syncRun?.id) {
      await admin
        .from(
          "pos_sync_runs"
        )
        .update({
          status:
            "FAILED",

          error_message:
            error?.message ||
            "Unable to refresh branches.",

          completed_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          syncRun.id
        );
    }


    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to refresh branches.",
      },
      {
        status: 400,
      }
    );
  }
}
