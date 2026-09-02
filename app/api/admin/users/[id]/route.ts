import { NextResponse } from "next/server";

import { checkAdminApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const access =
    await checkAdminApi();

  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
      },
      {
        status: access.status,
      }
    );
  }

  try {
    const {
      id: userId,
    } =
      await context.params;

    const body =
      await request.json();

    const fullName =
      String(
        body?.fullName ?? ""
      ).trim();

    const email =
      String(
        body?.email ?? ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body?.temporaryPassword ??
          ""
      );

    const jobTitle =
      String(
        body?.jobTitle ?? ""
      ).trim();

    const phone =
      String(
        body?.phone ?? ""
      ).trim();

    const roleId =
      String(
        body?.roleId ?? ""
      );

    const isActive =
      body?.isActive !== false;

    const outletIds =
      Array.isArray(
        body?.outletIds
      )
        ? [
            ...new Set(
              body.outletIds.map(
                String
              )
            ),
          ]
        : [];

    if (
      !fullName ||
      !email ||
      !roleId
    ) {
      return NextResponse.json(
        {
          error:
            "Name, email and role are required.",
        },
        { status: 400 }
      );
    }

    if (
      password &&
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "New password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const admin =
      createAdminClient();

    const organizationId =
      access.profile
        .organization_id;

    const {
      data:
        existingProfile,
    } =
      await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (!existingProfile) {
      return NextResponse.json(
        {
          error:
            "User not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: role,
    } =
      await admin
        .from("roles")
        .select(`
          id,
          is_admin,
          is_active
        `)
        .eq("id", roleId)
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      !role ||
      role.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid role.",
        },
        { status: 400 }
      );
    }

    if (
      access.user.id ===
        userId &&
      (
        !role.is_admin ||
        !isActive
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove your own administrator access or disable your own account.",
        },
        { status: 400 }
      );
    }

    if (
      !role.is_admin &&
      outletIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Select at least one outlet.",
        },
        { status: 400 }
      );
    }

    if (
      outletIds.length > 0
    ) {
      const {
        data:
          validOutlets,
      } =
        await admin
          .from("outlets")
          .select("id")
          .eq(
            "organization_id",
            organizationId
          )
          .in("id", outletIds);

      if (
        (validOutlets ?? [])
          .length !==
        outletIds.length
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid outlet selection.",
          },
          { status: 400 }
        );
      }
    }

    const authUpdates: any = {
      email,
      email_confirm: true,
    };

    if (password) {
      authUpdates.password =
        password;
    }

    authUpdates.ban_duration =
      isActive
        ? "none"
        : "876000h";

    const {
      error:
        authError,
    } =
      await admin.auth.admin
        .updateUserById(
          userId,
          authUpdates
        );

    if (authError) {
      return NextResponse.json(
        {
          error:
            authError.message,
        },
        { status: 400 }
      );
    }

    const {
      error:
        profileError,
    } =
      await admin
        .from("profiles")
        .update({
          full_name: fullName,
          job_title:
            jobTitle || null,
          phone:
            phone || null,
          is_active:
            isActive,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", userId)
        .eq(
          "organization_id",
          organizationId
        );

    if (profileError) {
      throw profileError;
    }

    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    const {
      error:
        userRoleError,
    } =
      await admin
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
          outlet_id: null,
        });

    if (userRoleError) {
      throw userRoleError;
    }

    await admin
      .from("user_outlets")
      .delete()
      .eq("user_id", userId);

    if (
      !role.is_admin &&
      outletIds.length > 0
    ) {
      const {
        error:
          userOutletError,
      } =
        await admin
          .from(
            "user_outlets"
          )
          .insert(
            outletIds.map(
              (
                outletId,
                index
              ) => ({
                user_id:
                  userId,
                outlet_id:
                  outletId,
                is_primary:
                  index === 0,
                is_active: true,
              })
            )
          );

      if (
        userOutletError
      ) {
        throw userOutletError;
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error(
      "Update admin user error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update user.",
      },
      { status: 500 }
    );
  }
}
