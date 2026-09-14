import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBuilderPermission,
} from "@/lib/admin/draft-builder-api";

const keys = ["sectionIds"] as const;

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      versionId: string;
    }>;
  },
) {
  const access = await requireBuilderPermission();

  if (access.response) {
    return access.response;
  }

  const { versionId } = await params;

  if (!isUuid(versionId)) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const parsed = await parseStrictObject<{
    sectionIds: unknown;
  }>(request, keys);

  if (parsed.response) {
    return parsed.response;
  }

  const sectionIds = parsed.value.sectionIds;

  if (
    !Array.isArray(sectionIds) ||
    sectionIds.length === 0 ||
    sectionIds.some(
      (value) => typeof value !== "string" || !isUuid(value),
    ) ||
    new Set(sectionIds).size !== sectionIds.length
  ) {
    return NextResponse.json(
      { error: "Invalid section order." },
      { status: 400 },
    );
  }

  const error = await invokeBuilderRpc(
    "reorder_draft_sections",
    {
      p_form_version_id: versionId,
      p_version_section_ids: sectionIds,
    },
  );

  return error ?? NextResponse.json({ ok: true });
}
