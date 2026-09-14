import { NextResponse } from "next/server";

import { checkAdminApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const OUTLET_OPERATION_FORM_CODES = [
  "OPENING_FOH",
  "OPENING_BOH",
  "CLOSING_FOH",
  "CLOSING_BOH",
] as const;

type PermissionInput = {
  outletId: string;
  formId: string;
  canFill: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canOverride: boolean;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseAssignments(value: unknown): PermissionInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byKey = new Map<string, PermissionInput>();

  for (const raw of value) {
    const outletId = clean(raw?.outletId);
    const formId = clean(raw?.formId);

    if (!outletId || !formId) {
      continue;
    }

    const row: PermissionInput = {
      outletId,
      formId,
      canFill: raw?.canFill === true,
      canSubmit: raw?.canSubmit === true,
      canReview: raw?.canReview === true,
      canOverride: raw?.canOverride === true,
    };

    if (
      !row.canFill &&
      !row.canSubmit &&
      !row.canReview &&
      !row.canOverride
    ) {
      continue;
    }

    byKey.set(`${outletId}:${formId}`, row);
  }

  return Array.from(byKey.values());
}

export async function GET(request: Request) {
  const access = await checkAdminApi();

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  try {
    const url = new URL(request.url);
    const userId = clean(url.searchParams.get("userId"));

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const organizationId = access.profile.organization_id;

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const [
      formsResult,
      outletsResult,
      userOutletsResult,
    ] = await Promise.all([
      admin
        .from("forms")
        .select(`
          id,
          code,
          name
        `)
        .eq("organization_id", organizationId)
        .in("code", [...OUTLET_OPERATION_FORM_CODES])
        .order("name"),
      admin
        .from("outlets")
        .select(`
          id,
          code,
          name
        `)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name"),
      admin
        .from("user_outlets")
        .select(`
          outlet_id,
          is_active
        `)
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    if (formsResult.error) {
      throw formsResult.error;
    }

    if (outletsResult.error) {
      throw outletsResult.error;
    }

    if (userOutletsResult.error) {
      throw userOutletsResult.error;
    }

    const forms = formsResult.data ?? [];
    const outlets = outletsResult.data ?? [];
    const formIds = forms.map((item: any) => item.id);

    const permissionsResult =
      formIds.length > 0
        ? await admin
            .from("user_form_permissions")
            .select(`
              outlet_id,
              form_id,
              can_fill,
              can_submit,
              can_review,
              can_override
            `)
            .eq("user_id", userId)
            .in("form_id", formIds)
        : {
            data: [],
            error: null,
          };

    if (permissionsResult.error) {
      throw permissionsResult.error;
    }

    return NextResponse.json({
      success: true,
      forms,
      outlets,
      userOutletIds: (userOutletsResult.data ?? []).map(
        (item: any) => item.outlet_id
      ),
      assignments: (permissionsResult.data ?? []).map(
        (item: any) => ({
          outletId: item.outlet_id,
          formId: item.form_id,
          canFill: item.can_fill === true,
          canSubmit: item.can_submit === true,
          canReview: item.can_review === true,
          canOverride: item.can_override === true,
        })
      ),
    });
  } catch (error: any) {
    console.error(
      "Load Outlet Operations access error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load Outlet Operations access.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const access = await checkAdminApi();

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  try {
    const body = await request.json();
    const userId = clean(body?.userId);
    const assignments = parseAssignments(
      body?.assignments
    );

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const organizationId = access.profile.organization_id;

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const [
      formsResult,
      outletsResult,
      userOutletsResult,
    ] = await Promise.all([
      admin
        .from("forms")
        .select(`
          id,
          code
        `)
        .eq("organization_id", organizationId)
        .in("code", [...OUTLET_OPERATION_FORM_CODES]),
      admin
        .from("outlets")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
      admin
        .from("user_outlets")
        .select(`
          outlet_id,
          is_active
        `)
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    if (formsResult.error) {
      throw formsResult.error;
    }

    if (outletsResult.error) {
      throw outletsResult.error;
    }

    if (userOutletsResult.error) {
      throw userOutletsResult.error;
    }

    const formIds = new Set(
      (formsResult.data ?? []).map(
        (item: any) => String(item.id)
      )
    );

    const organizationOutletIds = new Set(
      (outletsResult.data ?? []).map(
        (item: any) => String(item.id)
      )
    );

    const userOutletIds = new Set(
      (userOutletsResult.data ?? []).map(
        (item: any) => String(item.outlet_id)
      )
    );

    for (const item of assignments) {
      if (!formIds.has(item.formId)) {
        return NextResponse.json(
          {
            error:
              "Invalid Outlet Operations form assignment.",
          },
          { status: 400 }
        );
      }

      if (
        !organizationOutletIds.has(item.outletId) ||
        !userOutletIds.has(item.outletId)
      ) {
        return NextResponse.json(
          {
            error:
              "Outlet Operations access can only be assigned to an outlet already assigned to this user. Save Outlet Access first, then reopen the user.",
          },
          { status: 400 }
        );
      }
    }

    const targetFormIds = Array.from(formIds);

    if (targetFormIds.length > 0) {
      const {
        error: deleteError,
      } = await admin
        .from("user_form_permissions")
        .delete()
        .eq("user_id", userId)
        .in("form_id", targetFormIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (assignments.length > 0) {
      const {
        error: insertError,
      } = await admin
        .from("user_form_permissions")
        .insert(
          assignments.map((item) => ({
            user_id: userId,
            outlet_id: item.outletId,
            form_id: item.formId,
            can_fill: item.canFill,
            can_submit: item.canSubmit,
            can_review: item.canReview,
            can_override: item.canOverride,
            updated_at: new Date().toISOString(),
          }))
        );

      if (insertError) {
        throw insertError;
      }
    }

    return NextResponse.json({
      success: true,
      assignments,
    });
  } catch (error: any) {
    console.error(
      "Save Outlet Operations access error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to save Outlet Operations access.",
      },
      { status: 500 }
    );
  }
}
