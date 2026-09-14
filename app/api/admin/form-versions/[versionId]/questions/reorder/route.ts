import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBuilderPermission,
} from "@/lib/admin/draft-builder-api";

const keys = ["questionIds"] as const;

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
    questionIds: unknown;
  }>(request, keys);

  if (parsed.response) {
    return parsed.response;
  }

  const questionIds = parsed.value.questionIds;

  if (
    !Array.isArray(questionIds) ||
    questionIds.length === 0 ||
    questionIds.some(
      (value) => typeof value !== "string" || !isUuid(value),
    ) ||
    new Set(questionIds).size !== questionIds.length
  ) {
    return NextResponse.json(
      { error: "Invalid question order." },
      { status: 400 },
    );
  }

  const error = await invokeBuilderRpc(
    "reorder_draft_questions",
    {
      p_form_version_id: versionId,
      p_question_ids: questionIds,
    },
  );

  return error ?? NextResponse.json({ ok: true });
}
