import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_KEYS = [
  "code",
  "displayName",
  "description",
  "isRequired",
  "isActive",
  "areaCode",
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { versionId } = await params;

  if (!UUID.test(versionId)) {
    return NextResponse.json(
      { error: "Invalid version identifier." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid section input." },
      { status: 400 },
    );
  }

  const data = body as Record<string, unknown>;

  if (Object.keys(data).some((key) => !ALLOWED_KEYS.includes(key as never))) {
    return NextResponse.json(
      { error: "Invalid section input." },
      { status: 400 },
    );
  }

  const code = data.code;
  const displayName = data.displayName;
  const description = data.description ?? null;
  const isRequired = data.isRequired;
  const isActive = data.isActive;
  const areaCode = data.areaCode ?? null;

  if (
    typeof code !== "string" ||
    code.trim() === "" ||
    typeof displayName !== "string" ||
    displayName.trim() === "" ||
    (description !== null && typeof description !== "string") ||
    typeof isRequired !== "boolean" ||
    typeof isActive !== "boolean" ||
    (areaCode !== null &&
      (typeof areaCode !== "string" ||
        !["STORE", "PRODUCTION"].includes(areaCode)))
  ) {
    return NextResponse.json(
      { error: "Invalid section input." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: section, error } = await supabase.rpc(
    "add_draft_form_version_section",
    {
      p_form_version_id: versionId,
      p_code: code.trim().toUpperCase(),
      p_display_name: displayName.trim(),
      p_description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      p_is_required: isRequired,
      p_is_active: isActive,
      p_area_code: areaCode,
    },
  );

  if (error) {
    const status =
      error.code === "23505"
        ? 409
        : error.code === "42501"
          ? 403
          : error.code === "55000"
            ? 409
            : error.code === "22023"
              ? 400
              : 500;

    const message =
      error.code === "23505"
        ? "Section code already exists in this form."
        : error.code === "55000"
          ? "This draft is no longer editable."
          : error.code === "42501"
            ? "Permission denied."
            : error.code === "22023"
              ? error.message || "Invalid section input."
              : "Unable to add section.";

    return NextResponse.json({ error: message }, { status });
  }

  const created = Array.isArray(section) ? section[0] : section;

  return NextResponse.json({ ok: true, section: created });
}
