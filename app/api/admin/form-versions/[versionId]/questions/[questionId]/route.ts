import { NextResponse } from "next/server";

import { invokeBuilderRpc, isUuid, parseStrictObject, requireBoolean, requireBuilderPermission, requireNonNegativeNumber, requireNullableNumber, requireNullableString, requireString } from "@/lib/admin/draft-builder-api";

const keys = ["questionText", "helpText", "isRequired", "unit", "minValue", "maxValue", "placeholder", "sortOrder", "isActive"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string; questionId: string }> }) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;
  const { versionId, questionId } = await params;
  if (!isUuid(versionId) || !isUuid(questionId)) return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  const parsed = await parseStrictObject<Record<(typeof keys)[number], unknown>>(request, keys);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!requireString(body.questionText) || !requireNullableString(body.helpText) || !requireBoolean(body.isRequired) || !requireNullableString(body.unit) || !requireNullableNumber(body.minValue) || !requireNullableNumber(body.maxValue) || !requireNullableString(body.placeholder) || !requireNonNegativeNumber(body.sortOrder) || !Number.isInteger(body.sortOrder) || !requireBoolean(body.isActive) || (body.minValue !== null && body.maxValue !== null && body.minValue > body.maxValue)) return NextResponse.json({ error: "Invalid question input." }, { status: 400 });
  const error = await invokeBuilderRpc("update_draft_question", { p_form_version_id: versionId, p_question_id: questionId, p_question_text: body.questionText, p_help_text: body.helpText, p_is_required: body.isRequired, p_unit: body.unit, p_min_value: body.minValue, p_max_value: body.maxValue, p_placeholder: body.placeholder, p_sort_order: body.sortOrder, p_is_active: body.isActive });
  return error ?? NextResponse.json({ ok: true });
}
