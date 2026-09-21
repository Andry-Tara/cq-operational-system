import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  posApiBaseUrl,
  posApiConfigured,
} from "@/lib/pos/chongqing-external-api";

import PosIntegrationClient from "./pos-integration-client";


export default async function PosIntegrationPage() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    redirect(
      "/login"
    );
  }


  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      "pos.manage"
    )
  ) {
    redirect(
      "/protected"
    );
  }


  const admin:
    any =
    createAdminClient();


  const [
    outletsResult,
    branchesResult,
    mappingsResult,
    syncRunsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name,
          timezone
        `)
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "pos_external_branches"
        )
        .select(`
          external_branch_id,
          name,
          address,
          phone_number,
          external_status,
          last_synced_at
        `)
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "provider",
          "CHONGQING"
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "pos_branch_mappings"
        )
        .select(`
          id,
          external_branch_id,
          external_branch_name,
          outlet_id,
          is_active
        `)
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "provider",
          "CHONGQING"
        ),

      admin
        .from(
          "pos_sync_runs"
        )
        .select(`
          id,
          sync_type,
          status,
          date_from,
          date_to,
          pages_processed,
          orders_seen,
          orders_upserted,
          items_upserted,
          unmapped_orders,
          error_message,
          started_at,
          completed_at
        `)
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "provider",
          "CHONGQING"
        )
        .order(
          "started_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          10
        ),
    ]);


  for (
    const result of [
      outletsResult,
      branchesResult,
      mappingsResult,
      syncRunsResult,
    ]
  ) {
    if (result.error) {
      throw result.error;
    }
  }


  return (
    <PosIntegrationClient
      configured={
        posApiConfigured()
      }
      baseUrl={
        posApiBaseUrl()
      }
      outlets={
        outletsResult.data ??
        []
      }
      branches={
        branchesResult.data ??
        []
      }
      mappings={
        mappingsResult.data ??
        []
      }
      syncRuns={
        syncRunsResult.data ??
        []
      }
    />
  );
}
