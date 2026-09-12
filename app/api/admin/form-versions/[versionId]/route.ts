import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBuilderPermission,
  requireNullableString,
} from "@/lib/admin/draft-builder-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;

  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "Invalid version identifier." }, { status: 400 });
  }

  const parsed = await parseStrictObject<{ notes: string | null }>(request, ["notes"]);
  if (parsed.response) return parsed.response;
  if (!requireNullableString(parsed.value.notes)) {
    return NextResponse.json({ error: "Notes must be text or null." }, { status: 400 });
  }

  const error = await invokeBuilderRpc("update_draft_form_version", {
    p_form_version_id: versionId,
    p_notes: parsed.value.notes,
  });

  return error ?? NextResponse.json({ ok: true });
}
