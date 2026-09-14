import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  parseStrictObject,
  requireBuilderPermission,
} from "@/lib/admin/draft-builder-api";

const keys = ["direction"] as const;

export async function POST(
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

  const { versionId, questionId } = await params;

  if (!isUuid(versionId) || !isUuid(questionId)) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const parsed = await parseStrictObject<{
    direction: unknown;
  }>(request, keys);

  if (parsed.response) {
    return parsed.response;
  }

  const direction = parsed.value.direction;

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json(
      { error: "Invalid move direction." },
      { status: 400 },
    );
  }

  const error = await invokeBuilderRpc(
    "move_draft_question",
    {
      p_form_version_id: versionId,
      p_question_id: questionId,
      p_direction: direction,
    },
  );

  return error ?? NextResponse.json({ ok: true });
}
