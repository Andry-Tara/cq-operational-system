import {
  NextResponse,
} from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export async function POST(
  request: Request
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
      data: role,
      error:
        roleError,
    } =
      await admin
        .from("roles")
        .insert({
          organization_id:
            access.profile
              .organization_id,

          name,
          code,

          description:
            description ||
            null,

          is_admin:
            isAdmin,

          is_active:
            isActive,
        })
        .select(`
          id,
          name,
          code
        `)
        .single();

    if (
      roleError ||
      !role
    ) {
      return NextResponse.json(
        {
          error:
            roleError
              ?.message ||
            "Unable to create role.",
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
          permissionError,
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
                  role.id,

                permission_id:
                  permissionId,

                is_allowed:
                  true,
              })
            )
          );

      if (permissionError) {
        await admin
          .from("roles")
          .delete()
          .eq(
            "id",
            role.id
          );

        return NextResponse.json(
          {
            error:
              permissionError
                .message,
          },
          {
            status: 400,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      role,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to create role.",
      },
      {
        status: 500,
      }
    );
  }
}
