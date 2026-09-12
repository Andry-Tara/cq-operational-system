import { NextResponse } from "next/server";

import { invokeBuilderRpc, isUuid, parseStrictObject, requireBoolean, requireBuilderPermission, requireNonNegativeNumber, requireString } from "@/lib/admin/draft-builder-api";

const keys = ["label", "sortOrder", "isFailure"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string; optionId: string }> }) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;
  const { versionId, optionId } = await params;
  if (!isUuid(versionId) || !isUuid(optionId)) return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  const parsed = await parseStrictObject<Record<(typeof keys)[number], unknown>>(request, keys);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!requireString(body.label) || !requireNonNegativeNumber(body.sortOrder) || !Number.isInteger(body.sortOrder) || !requireBoolean(body.isFailure)) return NextResponse.json({ error: "Invalid option input." }, { status: 400 });
  const error = await invokeBuilderRpc("update_draft_question_option", { p_form_version_id: versionId, p_option_id: optionId, p_label: body.label, p_sort_order: body.sortOrder, p_is_failure: body.isFailure });
  return error ?? NextResponse.json({ ok: true });
}
