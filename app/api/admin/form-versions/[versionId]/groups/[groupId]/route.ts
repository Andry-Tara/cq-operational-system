import { NextResponse } from "next/server";

import { invokeBuilderRpc, isUuid, parseStrictObject, requireBoolean, requireBuilderPermission, requireNonNegativeNumber, requireString } from "@/lib/admin/draft-builder-api";

const keys = ["name", "sortOrder", "isActive"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string; groupId: string }> }) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;
  const { versionId, groupId } = await params;
  if (!isUuid(versionId) || !isUuid(groupId)) return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  const parsed = await parseStrictObject<Record<(typeof keys)[number], unknown>>(request, keys);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!requireString(body.name) || !requireNonNegativeNumber(body.sortOrder) || !Number.isInteger(body.sortOrder) || !requireBoolean(body.isActive)) return NextResponse.json({ error: "Invalid group input." }, { status: 400 });
  const error = await invokeBuilderRpc("update_draft_question_group", { p_form_version_id: versionId, p_question_group_id: groupId, p_name: body.name, p_sort_order: body.sortOrder, p_is_active: body.isActive });
  return error ?? NextResponse.json({ ok: true });
}
