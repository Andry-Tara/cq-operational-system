import { NextResponse } from "next/server";
import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { versionId, versionSectionId } = await params;

  if (!UUID.test(versionId) || !UUID.test(versionSectionId)) {
    return NextResponse.json(
      { error: "Invalid identifier." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid question input." },
      { status: 400 },
    );
  }

  const data = body as Record<string, unknown>;

  const allowedKeys = [
    "code",
    "questionText",
    "questionType",
    "isRequired",
    "questionGroupId",
    "helpText",
    "unit",
    "minValue",
    "maxValue",
  ];

  if (Object.keys(data).some((key) => !allowedKeys.includes(key))) {
    return NextResponse.json(
      { error: "Invalid question input." },
      { status: 400 },
    );
  }

  const code = data.code;
  const questionText = data.questionText;
  const questionType = data.questionType;
  const isRequired = data.isRequired;

  const questionGroupId = data.questionGroupId ?? null;
  const helpText = data.helpText ?? null;
  const unit = data.unit ?? null;
  const minValue = data.minValue ?? null;
  const maxValue = data.maxValue ?? null;

  if (
    typeof code !== "string" ||
    code.trim() === "" ||
    typeof questionText !== "string" ||
    questionText.trim() === "" ||
    typeof questionType !== "string" ||
    !["yes_no", "temperature"].includes(questionType) ||
    typeof isRequired !== "boolean" ||
    (questionGroupId !== null &&
      (typeof questionGroupId !== "string" ||
        !UUID.test(questionGroupId))) ||
    (helpText !== null && typeof helpText !== "string") ||
    (unit !== null && typeof unit !== "string") ||
    (minValue !== null && typeof minValue !== "number") ||
    (maxValue !== null && typeof maxValue !== "number")
  ) {
    return NextResponse.json(
      { error: "Invalid question input." },
      { status: 400 },
    );
  }

  if (
    typeof minValue === "number" &&
    typeof maxValue === "number" &&
    minValue > maxValue
  ) {
    return NextResponse.json(
      { error: "Question minimum cannot exceed maximum." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: question, error } = await supabase.rpc(
    "add_draft_question",
    {
      p_form_version_id: versionId,
      p_version_section_id: versionSectionId,
      p_question_group_id: questionGroupId,
      p_code: code.trim(),
      p_question_text: questionText.trim(),
      p_question_type: questionType,
      p_is_required: isRequired,
      p_help_text: helpText,
      p_unit: unit,
      p_min_value: minValue,
      p_max_value: maxValue,
    },
  );

  if (error) {
    const status =
      error.code === "23505"
        ? 409
        : error.code === "42501"
          ? 403
          : error.code === "55000"
            ? 409
            : error.code === "22023"
              ? 400
              : 500;

    const message =
      error.code === "23505"
        ? "Question code already exists."
        : error.code === "55000"
          ? "This draft is no longer editable."
          : error.code === "42501"
            ? "Permission denied."
            : error.code === "22023"
              ? error.message || "Invalid question input."
              : "Unable to add question.";

    return NextResponse.json(
      { error: message },
      { status },
    );
  }

  const created = Array.isArray(question)
    ? question[0]
    : question;

  return NextResponse.json({
    ok: true,
    question: created,
  });
}
