
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const {
    profile: adminProfile,
  } =
    await requirePermission("users.manage");

  const admin =
    createAdminClient();

  const organizationId =
    adminProfile.organization_id;

  const [
    profilesResult,
    rolesResult,
    outletsResult,
    userRolesResult,
    userOutletsResult,
    authResult,
  ] =
    await Promise.all([
      admin
        .from("profiles")
        .select(`
          id,
          employee_id,
          full_name,
          phone,
          job_title,
          is_active,
          created_at
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .order("full_name"),

      admin
        .from("roles")
        .select(`
          id,
          code,
          name,
          description,
          is_admin,
          is_active
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .order("name"),

      admin
        .from("outlets")
        .select(`
          id,
          code,
          name,
          timezone,
          is_active
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq("is_active", true)
        .order("name"),

      admin
        .from("user_roles")
        .select(`
          user_id,
          role_id,
          outlet_id
        `),

      admin
        .from("user_outlets")
        .select(`
          user_id,
          outlet_id,
          is_primary,
          is_active
        `)
        .eq("is_active", true),

      admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ]);

  const profiles =
    profilesResult.data ?? [];

  const roles =
    rolesResult.data ?? [];

  const outlets =
    outletsResult.data ?? [];

  const userRoles =
    userRolesResult.data ?? [];

  const userOutlets =
    userOutletsResult.data ?? [];

  const authUsers =
    authResult.data?.users ?? [];

  const authMap =
    new Map(
      authUsers.map((user) => [
        user.id,
        user,
      ])
    );

  const roleMap =
    new Map(
      roles.map((role) => [
        role.id,
        role,
      ])
    );

  const users =
    profiles.map((profile: any) => {
      const authUser =
        authMap.get(profile.id);

      const roleAssignment =
        userRoles.find(
          (item: any) =>
            item.user_id === profile.id
        );

      const role =
        roleAssignment
          ? roleMap.get(
              roleAssignment.role_id
            )
          : null;

      const outletIds =
        userOutlets
          .filter(
            (item: any) =>
              item.user_id ===
              profile.id
          )
          .map(
            (item: any) =>
              item.outlet_id
          );

      return {
        ...profile,
        email:
          authUser?.email ?? "",
        role_id:
          role?.id ?? null,
        role_name:
          role?.name ?? null,
        role_code:
          role?.code ?? null,
        is_admin:
          role?.is_admin === true,
        outlet_ids: outletIds,
      };
    });

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 md:py-12">
<div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">
          Users
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Create users and manage role and outlet access.
        </p>
      </div>

      <UsersClient
        users={users}
        roles={roles}
        outlets={outlets}
      />
    </main>
  );
}
