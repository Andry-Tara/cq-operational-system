import { NextResponse } from "next/server";

import { invokeBuilderRpc, isUuid, parseStrictObject, requireBuilderPermission, requireNullableString, requireString } from "@/lib/admin/draft-builder-api";

const baseKeys = ["resourceType", "resourceId", "locale"] as const;
const locales = ["en", "id-ID"] as const;

type TranslationBody = Record<string, unknown>;

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const access = await requireBuilderPermission();
  if (access.response) return access.response;
  const { versionId } = await params;
  if (!isUuid(versionId)) return NextResponse.json({ error: "Invalid version identifier." }, { status: 400 });
  let body: TranslationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.resourceId !== "string" || !isUuid(body.resourceId) || !locales.includes(body.locale as (typeof locales)[number])) return NextResponse.json({ error: "Invalid translation input." }, { status: 400 });
  const resourceType = body.resourceType;
  const locale = body.locale;
  const resourceId = body.resourceId;
  if (resourceType === "section") {
    const parsed = await parseStrictObject<Record<string, unknown>>(requestFromBody(body), [...baseKeys, "displayName", "description"]);
    if (parsed.response || !requireString(body.displayName) || !requireNullableString(body.description)) return parsed.response ?? NextResponse.json({ error: "Invalid section translation." }, { status: 400 });
    const error = await invokeBuilderRpc("upsert_draft_section_translation", { p_form_version_id: versionId, p_version_section_id: resourceId, p_locale: locale, p_display_name: body.displayName, p_description: body.description });
    return error ?? NextResponse.json({ ok: true });
  } else if (resourceType === "group") {
    const parsed = await parseStrictObject<Record<string, unknown>>(requestFromBody(body), [...baseKeys, "displayName", "description"]);
    if (parsed.response || !requireString(body.displayName) || !requireNullableString(body.description)) return parsed.response ?? NextResponse.json({ error: "Invalid group translation." }, { status: 400 });
    const error = await invokeBuilderRpc("upsert_draft_group_translation", { p_form_version_id: versionId, p_question_group_id: resourceId, p_locale: locale, p_display_name: body.displayName, p_description: body.description });
    return error ?? NextResponse.json({ ok: true });
  } else if (resourceType === "question") {
    const parsed = await parseStrictObject<Record<string, unknown>>(requestFromBody(body), [...baseKeys, "questionText", "helpText"]);
    if (parsed.response || !requireString(body.questionText) || !requireNullableString(body.helpText)) return parsed.response ?? NextResponse.json({ error: "Invalid question translation." }, { status: 400 });
    const error = await invokeBuilderRpc("upsert_draft_question_translation", { p_form_version_id: versionId, p_question_id: resourceId, p_locale: locale, p_question_text: body.questionText, p_help_text: body.helpText });
    return error ?? NextResponse.json({ ok: true });
  } else if (resourceType === "option") {
    const parsed = await parseStrictObject<Record<string, unknown>>(requestFromBody(body), [...baseKeys, "label"]);
    if (parsed.response || !requireString(body.label)) return parsed.response ?? NextResponse.json({ error: "Invalid option translation." }, { status: 400 });
    const error = await invokeBuilderRpc("upsert_draft_option_translation", { p_form_version_id: versionId, p_option_id: resourceId, p_locale: locale, p_label: body.label });
    return error ?? NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: "Unsupported translation resource." }, { status: 400 });
  }
}

function requestFromBody(body: TranslationBody) {
  return new Request("http://builder.local", { method: "PATCH", body: JSON.stringify(body) });
}
