import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function one(value: any) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export async function getAccessContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const admin =
    createAdminClient();

  const {
    data: profile,
  } =
    await admin
      .from("profiles")
      .select(`
        id,
        organization_id,
        full_name,
        job_title,
        is_active
      `)
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    !profile.organization_id ||
    profile.is_active === false
  ) {
    redirect("/auth/login");
  }

  const {
    data: roleRows,
  } =
    await admin
      .from("user_roles")
      .select(`
        role_id,
        roles (
          id,
          code,
          name,
          is_admin,
          is_active
        )
      `)
      .eq(
        "user_id",
        user.id
      );

  const roles =
    (roleRows ?? [])
      .map((row: any) =>
        one(row.roles)
      )
      .filter(
        (role: any) =>
          role &&
          role.is_active !== false
      );

  const roleIds =
    roles.map(
      (role: any) =>
        role.id
    );

  let permissionCodes:
    string[] = [];

  if (roleIds.length) {
    const {
      data:
        permissionRows,
    } =
      await admin
        .from(
          "role_permissions"
        )
        .select(`
          role_id,
          is_allowed,
          permissions (
            code,
            is_active
          )
        `)
        .in(
          "role_id",
          roleIds
        )
        .eq(
          "is_allowed",
          true
        );

    permissionCodes =
      Array.from(
        new Set(
          (permissionRows ?? [])
            .map(
              (row: any) =>
                one(
                  row.permissions
                )
            )
            .filter(
              (permission: any) =>
                permission &&
                permission.is_active !==
                  false
            )
            .map(
              (
                permission: any
              ) =>
                permission.code
            )
        )
      );
  }

  const isAdmin =
    roles.some(
      (role: any) =>
        role.is_admin === true
    );

  return {
    user,
    profile,
    roles,
    isAdmin,
    permissionCodes,
  };
}


export async function requirePermission(
  permissionCode: string
) {
  const context =
    await getAccessContext();

  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      permissionCode
    )
  ) {
    redirect("/protected");
  }

  return context;
}


export async function getAdminContext() {
  return requirePermission(
    "admin.access"
  );
}


export async function checkPermissionApi(
  permissionCode: string
) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized.",
    };
  }

  const admin =
    createAdminClient();

  const {
    data: profile,
  } =
    await admin
      .from("profiles")
      .select(`
        id,
        organization_id,
        full_name,
        is_active
      `)
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    !profile.organization_id ||
    profile.is_active === false
  ) {
    return {
      ok: false as const,
      status: 403,
      error: "Access denied.",
    };
  }

  const {
    data: roleRows,
  } =
    await admin
      .from("user_roles")
      .select(`
        role_id,
        roles (
          id,
          is_admin,
          is_active
        )
      `)
      .eq(
        "user_id",
        user.id
      );

  const roles =
    (roleRows ?? [])
      .map((row: any) =>
        one(row.roles)
      )
      .filter(
        (role: any) =>
          role &&
          role.is_active !== false
      );

  const isAdmin =
    roles.some(
      (role: any) =>
        role.is_admin === true
    );

  if (isAdmin) {
    return {
      ok: true as const,
      user,
      profile,
      isAdmin: true,
    };
  }

  const roleIds =
    roles.map(
      (role: any) =>
        role.id
    );

  if (!roleIds.length) {
    return {
      ok: false as const,
      status: 403,
      error:
        "Permission denied.",
    };
  }

  const {
    data:
      permissionRows,
  } =
    await admin
      .from(
        "role_permissions"
      )
      .select(`
        permission_id,
        permissions!inner (
          code,
          is_active
        )
      `)
      .in(
        "role_id",
        roleIds
      )
      .eq(
        "is_allowed",
        true
      );

  const allowed =
    (permissionRows ?? [])
      .map(
        (row: any) =>
          one(
            row.permissions
          )
      )
      .some(
        (permission: any) =>
          permission?.code ===
            permissionCode &&
          permission?.is_active !==
            false
      );

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      error:
        "Permission denied.",
    };
  }

  return {
    ok: true as const,
    user,
    profile,
    isAdmin: false,
  };
}


export async function checkAdminApi() {
  return checkPermissionApi(
    "admin.access"
  );
}
