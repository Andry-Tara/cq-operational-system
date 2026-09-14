import { NextResponse } from "next/server";

import {
  invokeBuilderRpc,
  isUuid,
  requireBuilderPermission,
} from "@/lib/admin/draft-builder-api";

export async function POST(
  _request: Request,
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

  const error = await invokeBuilderRpc(
    "duplicate_draft_question",
    {
      p_form_version_id: versionId,
      p_question_id: questionId,
    },
  );

  return error ?? NextResponse.json({ ok: true });
}
