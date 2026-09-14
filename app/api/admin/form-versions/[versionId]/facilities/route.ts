import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ versionId: string }>;
  },
) {
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { versionId } = await params;

  if (!UUID_PATTERN.test(versionId)) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const {
    data: version,
    error: versionError,
  } = await admin
    .from("form_versions")
    .select(
      "id, status, forms!inner(organization_id)",
    )
    .eq("id", versionId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json(
      { error: "Draft form version was not found." },
      { status: 404 },
    );
  }

  if (version.status !== "draft") {
    return NextResponse.json(
      { error: "This form version is no longer editable." },
      { status: 409 },
    );
  }

  const form = Array.isArray(version.forms)
    ? version.forms[0]
    : version.forms;

  if (!form?.organization_id) {
    return NextResponse.json(
      { error: "Form organization was not found." },
      { status: 404 },
    );
  }

  const {
    data: facilities,
    error: facilityError,
  } = await admin
    .from("facility_definitions")
    .select("code, name, description")
    .eq("organization_id", form.organization_id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (facilityError) {
    return NextResponse.json(
      { error: "Unable to load facility master." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    facilities: facilities ?? [],
  });
}
