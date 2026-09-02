import { NextResponse } from "next/server";

import { checkAdminApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request
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
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "Temporary password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const organizationId =
      access.profile
        .organization_id;

    const admin =
      createAdminClient();

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

    const {
      data: created,
      error: authError,
    } =
      await admin.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name:
              fullName,
          },
        });

    if (
      authError ||
      !created.user
    ) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Unable to create authentication user.",
        },
        { status: 400 }
      );
    }

    const userId =
      created.user.id;

    try {
      const {
        error:
          profileError,
      } =
        await admin
          .from("profiles")
          .upsert(
            {
              id: userId,
              organization_id:
                organizationId,
              full_name:
                fullName,
              job_title:
                jobTitle || null,
              phone:
                phone || null,
              is_active: true,
            },
            {
              onConflict: "id",
            }
          );

      if (profileError) {
        throw profileError;
      }

      const {
        error: roleError,
      } =
        await admin
          .from("user_roles")
          .insert({
            user_id: userId,
            role_id: roleId,
            outlet_id: null,
          });

      if (roleError) {
        throw roleError;
      }

      if (
        !role.is_admin &&
        outletIds.length > 0
      ) {
        const rows =
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
          );

        const {
          error:
            outletError,
        } =
          await admin
            .from(
              "user_outlets"
            )
            .insert(rows);

        if (outletError) {
          throw outletError;
        }
      }

      return NextResponse.json({
        success: true,
        userId,
      });
    } catch (databaseError: any) {
      await admin.auth.admin
        .deleteUser(userId);

      return NextResponse.json(
        {
          error:
            databaseError?.message ||
            "Unable to create user profile.",
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error(
      "Create admin user error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to create user.",
      },
      { status: 500 }
    );
  }
}
