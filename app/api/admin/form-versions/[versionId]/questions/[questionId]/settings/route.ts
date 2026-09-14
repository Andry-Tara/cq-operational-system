import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBoolean,
  requireBuilderPermission,
  requireNullableString,
} from "@/lib/admin/draft-builder-api";

const keys = [
  "isRequired",
  "isActive",
  "evidenceMode",
  "applicabilityType",
  "facilityKey",
] as const;

const EVIDENCE_MODES = [
  "always",
  "on_issue",
  "none",
] as const;

const APPLICABILITY_TYPES = [
  "global",
  "facility",
] as const;

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      versionId: string;
      questionId: string;
    }>;
  },
) {
  const access = await requireBuilderPermission();

  if (access.response) {
    return access.response;
  }

  const {
    versionId,
    questionId,
  } = await params;

  if (
    !isUuid(versionId) ||
    !isUuid(questionId)
  ) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const parsed =
    await parseStrictObject<
      Record<(typeof keys)[number], unknown>
    >(request, keys);

  if (parsed.response) {
    return parsed.response;
  }

  const body = parsed.value;

  if (
    !requireBoolean(body.isRequired) ||
    !requireBoolean(body.isActive) ||
    typeof body.evidenceMode !== "string" ||
    !EVIDENCE_MODES.includes(
      body.evidenceMode as
        (typeof EVIDENCE_MODES)[number],
    ) ||
    typeof body.applicabilityType !== "string" ||
    !APPLICABILITY_TYPES.includes(
      body.applicabilityType as
        (typeof APPLICABILITY_TYPES)[number],
    ) ||
    !requireNullableString(body.facilityKey)
  ) {
    return NextResponse.json(
      { error: "Invalid question settings." },
      { status: 400 },
    );
  }

  const facilityKey =
    typeof body.facilityKey === "string" &&
    body.facilityKey.trim()
      ? body.facilityKey.trim()
      : null;

  if (
    body.applicabilityType === "facility" &&
    !facilityKey
  ) {
    return NextResponse.json(
      {
        error:
          "A facility must be selected for facility-based applicability.",
      },
      { status: 400 },
    );
  }

  const error = await invokeBuilderRpc(
    "update_draft_question_settings",
    {
      p_form_version_id: versionId,
      p_question_id: questionId,
      p_is_required: body.isRequired,
      p_is_active: body.isActive,
      p_evidence_mode: body.evidenceMode,
      p_applicability_type:
        body.applicabilityType,
      p_facility_key:
        body.applicabilityType ===
        "facility"
          ? facilityKey
          : null,
    },
  );

  return (
    error ??
    NextResponse.json({ ok: true })
  );
}
