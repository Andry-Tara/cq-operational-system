
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PermissionsClient } from "./permissions-client";

export default async function PermissionsPage() {
  const {
    profile,
  } =
    await requirePermission(
      "permissions.manage"
    );

  const admin =
    createAdminClient();

  const [
    rolesResult,
    permissionsResult,
    rolePermissionsResult,
    userRolesResult,
  ] =
    await Promise.all([
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
          profile.organization_id
        )
        .order("name"),

      admin
        .from("permissions")
        .select(`
          id,
          code,
          name,
          description,
          category,
          sort_order,
          is_active
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .order("sort_order"),

      admin
        .from(
          "role_permissions"
        )
        .select(`
          role_id,
          permission_id,
          is_allowed
        `)
        .eq(
          "is_allowed",
          true
        ),

      admin
        .from("user_roles")
        .select(`
          user_id,
          role_id
        `),
    ]);

  const roles =
    rolesResult.data ?? [];

  const permissions =
    permissionsResult.data ?? [];

  const rolePermissions =
    rolePermissionsResult.data ??
    [];

  const userRoles =
    userRolesResult.data ?? [];

  const rows =
    roles.map(
      (role: any) => ({
        ...role,

        user_count:
          userRoles.filter(
            (row: any) =>
              row.role_id ===
              role.id
          ).length,

        permission_ids:
          rolePermissions
            .filter(
              (row: any) =>
                row.role_id ===
                  role.id &&
                row.is_allowed
            )
            .map(
              (row: any) =>
                row.permission_id
            ),
      })
    );

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 md:py-12">
<div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">
          Roles & Permissions
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Permissions are inherited from each role. Change a role once and every user assigned to that role follows the same access rules.
        </p>
      </div>

      <PermissionsClient
        roles={rows}
        permissions={
          permissions
        }
      />
    </main>
  );
}
