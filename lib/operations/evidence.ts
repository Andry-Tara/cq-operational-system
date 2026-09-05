export type OperationalEvidenceMode =
  | "always"
  | "on_issue"
  | "none";

type OperationalRule = {
  rule_type?: string | null;
  condition?: Record<string, any> | null;
  action_config?: Record<string, any> | null;
  is_active?: boolean | null;
};

export type OperationalEvidenceQuestion = {
  question_type?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  config?: Record<string, any> | null;
  rules?: OperationalRule[] | null;
};

export type OperationalEvidenceAnswer = {
  value?: boolean | number | string | null;
  photo?: unknown;
  existingStoragePath?: string | null;
  existingPhotoFile?: unknown;
};

function validMode(
  value: unknown
): value is OperationalEvidenceMode {
  return (
    value === "always" ||
    value === "on_issue" ||
    value === "none"
  );
}

export function getOperationalEvidenceMode(
  question: OperationalEvidenceQuestion
): OperationalEvidenceMode {
  const configured =
    question.config?.evidence_mode;

  if (validMode(configured)) {
    return configured;
  }

  const photoRules =
    Array.isArray(question.rules)
      ? question.rules.filter(
          (rule) =>
            rule?.rule_type ===
              "require_photo" &&
            rule?.is_active !== false
        )
      : [];

  for (const rule of photoRules) {
    const operator =
      rule.condition?.operator;

    if (operator === "always") {
      return "always";
    }

    if (
      operator === "equals" &&
      rule.condition?.value === false
    ) {
      return "on_issue";
    }
  }

  // Legacy-safe default:
  // Existing Opening / Closing production questions
  // were designed with photo required for every item.
  return "always";
}

export function isOperationalException(
  question: OperationalEvidenceQuestion,
  answer?: OperationalEvidenceAnswer | null
) {
  if (!answer) {
    return false;
  }

  if (
    question.question_type ===
    "yes_no"
  ) {
    return answer.value === false;
  }

  if (
    question.question_type ===
    "temperature" &&
    typeof answer.value === "number" &&
    Number.isFinite(answer.value)
  ) {
    if (
      question.min_value !== null &&
      question.min_value !== undefined &&
      answer.value <
        Number(question.min_value)
    ) {
      return true;
    }

    if (
      question.max_value !== null &&
      question.max_value !== undefined &&
      answer.value >
        Number(question.max_value)
    ) {
      return true;
    }
  }

  return false;
}

export function isOperationalPhotoRequired(
  question: OperationalEvidenceQuestion,
  answer?: OperationalEvidenceAnswer | null
) {
  const mode =
    getOperationalEvidenceMode(
      question
    );

  if (mode === "always") {
    return true;
  }

  if (mode === "none") {
    return false;
  }

  return isOperationalException(
    question,
    answer
  );
}

export function hasOperationalPhotoEvidence(
  answer?: OperationalEvidenceAnswer | null
) {
  return Boolean(
    answer?.photo ||
      answer?.existingStoragePath ||
      answer?.existingPhotoFile
  );
}
