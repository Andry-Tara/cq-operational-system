import {
  requirePermission,
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import FloorMappingAdminClient from "./floor-mapping-admin-client";


export default async function FloorMappingAdminPage() {
  await requirePermission(
    "admin.access"
  );


  const context =
    await getAccessContext();


  const organizationId =
    context.profile
      ?.organization_id;


  if (!organizationId) {
    throw new Error(
      "Organization context is required."
    );
  }


  const admin =
    createAdminClient();


  const {
    data:
      outlets,
    error,
  } =
    await admin
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      )
      .neq(
        "code",
        "CNT"
      )
      .order(
        "name",
        {
          ascending:
            true,
        }
      );


  if (error) {
    throw error;
  }


  return (
    <FloorMappingAdminClient
      outlets={
        outlets ??
        []
      }
    />
  );
}
