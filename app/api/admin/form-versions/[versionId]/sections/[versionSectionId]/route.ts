import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBoolean,
  requireBuilderPermission,
  requireNonNegativeNumber,
  requireNullableString,
  requireString,
} from "@/lib/admin/draft-builder-api";

const keys = ["displayName", "description", "sortOrder", "isRequired", "isActive"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string; versionSectionId: string }> }) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;
  const { versionId, versionSectionId } = await params;
  if (!isUuid(versionId) || !isUuid(versionSectionId)) return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  const parsed = await parseStrictObject<Record<(typeof keys)[number], unknown>>(request, keys);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!requireString(body.displayName) || !requireNullableString(body.description) || !requireNonNegativeNumber(body.sortOrder) || !Number.isInteger(body.sortOrder) || !requireBoolean(body.isRequired) || !requireBoolean(body.isActive)) return NextResponse.json({ error: "Invalid section input." }, { status: 400 });
  const error = await invokeBuilderRpc("update_draft_form_version_section", { p_form_version_id: versionId, p_version_section_id: versionSectionId, p_display_name: body.displayName, p_description: body.description, p_sort_order: body.sortOrder, p_is_required: body.isRequired, p_is_active: body.isActive });
  return error ?? NextResponse.json({ ok: true });
}
