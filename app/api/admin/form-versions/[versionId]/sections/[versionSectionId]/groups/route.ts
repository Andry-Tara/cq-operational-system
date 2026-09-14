import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBuilderPermission,
} from "@/lib/admin/draft-builder-api";

const keys = ["code", "name", "isActive"] as const;

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      versionId: string;
      versionSectionId: string;
    }>;
  },
) {
  const access = await requireBuilderPermission();

  if (access.response) {
    return access.response;
  }

  const { versionId, versionSectionId } = await params;

  if (!isUuid(versionId) || !isUuid(versionSectionId)) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const parsed = await parseStrictObject<{
    code: unknown;
    name: unknown;
    isActive: unknown;
  }>(request, keys);

  if (parsed.response) {
    return parsed.response;
  }

  const code =
    typeof parsed.value.code === "string"
      ? parsed.value.code.trim()
      : "";

  const name =
    typeof parsed.value.name === "string"
      ? parsed.value.name.trim()
      : "";

  const isActive = parsed.value.isActive;

  if (!code) {
    return NextResponse.json(
      { error: "Group code is required." },
      { status: 400 },
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "Group name is required." },
      { status: 400 },
    );
  }

  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "Active status must be true or false." },
      { status: 400 },
    );
  }

  const error = await invokeBuilderRpc(
    "add_draft_question_group",
    {
      p_form_version_id: versionId,
      p_version_section_id: versionSectionId,
      p_code: code,
      p_name: name,
      p_is_active: isActive,
    },
  );

  return error ?? NextResponse.json({ ok: true });
}
