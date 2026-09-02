import {
  NextResponse,
} from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const access =
    await checkPermissionApi(
      "permissions.manage"
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

  try {
    const {
      id: roleId,
    } =
      await context.params;

    const body =
      await request.json();

    const name =
      String(
        body?.name ?? ""
      ).trim();

    const code =
      String(
        body?.code ?? ""
      )
        .trim()
        .toUpperCase();

    const description =
      String(
        body?.description ?? ""
      ).trim();

    const isAdmin =
      body?.isAdmin === true;

    const isActive =
      body?.isActive !== false;

    const permissionIds =
      Array.isArray(
        body?.permissionIds
      )
        ? [
            ...new Set(
              body.permissionIds.map(
                String
              )
            ),
          ]
        : [];

    if (
      !name ||
      !code
    ) {
      return NextResponse.json(
        {
          error:
            "Role name and code are required.",
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data:
        currentUserRole,
    } =
      await admin
        .from("user_roles")
        .select(`
          id,
          role_id
        `)
        .eq(
          "user_id",
          access.user.id
        )
        .eq(
          "role_id",
          roleId
        )
        .maybeSingle();

    if (
      currentUserRole &&
      (
        !isAdmin ||
        !isActive
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove administrator access or disable the role currently used by your own account.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error:
        roleError,
    } =
      await admin
        .from("roles")
        .update({
          name,
          code,

          description:
            description ||
            null,

          is_admin:
            isAdmin,

          is_active:
            isActive,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          roleId
        )
        .eq(
          "organization_id",
          access.profile
            .organization_id
        );

    if (roleError) {
      return NextResponse.json(
        {
          error:
            roleError.message,
        },
        {
          status: 400,
        }
      );
    }

    const {
      error:
        clearError,
    } =
      await admin
        .from(
          "role_permissions"
        )
        .delete()
        .eq(
          "role_id",
          roleId
        );

    if (clearError) {
      return NextResponse.json(
        {
          error:
            clearError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (
      permissionIds.length
    ) {
      const {
        error:
          insertError,
      } =
        await admin
          .from(
            "role_permissions"
          )
          .insert(
            permissionIds.map(
              (
                permissionId
              ) => ({
                role_id:
                  roleId,

                permission_id:
                  permissionId,

                is_allowed:
                  true,
              })
            )
          );

      if (insertError) {
        return NextResponse.json(
          {
            error:
              insertError.message,
          },
          {
            status: 400,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update role.",
      },
      {
        status: 500,
      }
    );
  }
}
