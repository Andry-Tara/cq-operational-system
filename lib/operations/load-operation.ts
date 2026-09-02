import {
  normalizeOperationCode,
} from "./config";

type LoadOperationArgs = {
  supabase: any;
  organizationId: string;
  outletId: string;
  formCode: string;
  sectionCode: string;
};

export async function loadOperationDefinition({
  supabase,
  organizationId,
  outletId,
  formCode,
  sectionCode,
}: LoadOperationArgs) {
  const normalizedFormCode =
    normalizeOperationCode(formCode);

  const normalizedSectionCode =
    normalizeOperationCode(sectionCode);

  // ==========================================================
  // FORM
  // ==========================================================

  const {
    data: form,
    error: formError,
  } = await supabase
    .from("forms")
    .select(`
      id,
      code,
      name,
      description,
      organization_id
    `)
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "code",
      normalizedFormCode
    )
    .eq("is_active", true)
    .maybeSingle();

  if (formError) {
    throw formError;
  }

  if (!form) {
    throw new Error(
      `Form ${normalizedFormCode} belum tersedia.`
    );
  }

  // ==========================================================
  // OUTLET ASSIGNMENT
  // ==========================================================

  const {
    data: assignment,
    error: assignmentError,
  } = await supabase
    .from("outlet_form_assignments")
    .select(`
      id,
      outlet_id,
      form_id,
      form_version_id,
      is_active,
      effective_from,
      effective_until
    `)
    .eq("outlet_id", outletId)
    .eq("form_id", form.id)
    .eq("is_active", true)
    .order("effective_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignment) {
    throw new Error(
      `${form.name} belum diaktifkan untuk outlet ini.`
    );
  }

  // ==========================================================
  // FORM VERSION
  // ==========================================================

  const {
    data: formVersion,
    error: formVersionError,
  } = await supabase
    .from("form_versions")
    .select(`
      id,
      form_id,
      version_number,
      status
    `)
    .eq(
      "id",
      assignment.form_version_id
    )
    .maybeSingle();

  if (formVersionError) {
    throw formVersionError;
  }

  if (!formVersion) {
    throw new Error(
      `${form.name} form version tidak ditemukan.`
    );
  }

  // ==========================================================
  // SECTION
  // ==========================================================

  const {
    data: section,
    error: sectionError,
  } = await supabase
    .from("sections")
    .select(`
      id,
      form_id,
      code,
      name,
      description
    `)
    .eq("form_id", form.id)
    .eq(
      "code",
      normalizedSectionCode
    )
    .eq("is_active", true)
    .maybeSingle();

  if (sectionError) {
    throw sectionError;
  }

  if (!section) {
    throw new Error(
      `Section ${normalizedSectionCode} belum tersedia pada ${form.name}.`
    );
  }

  // ==========================================================
  // VERSION SECTION
  // ==========================================================

  const {
    data: versionSection,
    error: versionSectionError,
  } = await supabase
    .from("form_version_sections")
    .select(`
      id,
      form_version_id,
      section_id,
      display_name,
      description,
      sort_order,
      is_required,
      is_active
    `)
    .eq(
      "form_version_id",
      formVersion.id
    )
    .eq(
      "section_id",
      section.id
    )
    .eq("is_active", true)
    .maybeSingle();

  if (versionSectionError) {
    throw versionSectionError;
  }

  if (!versionSection) {
    throw new Error(
      `${section.name} belum tersedia pada version ${formVersion.version_number}.`
    );
  }

  // ==========================================================
  // GROUPS
  // ==========================================================

  const {
    data: groupsData,
    error: groupsError,
  } = await supabase
    .from("question_groups")
    .select(`
      id,
      code,
      name,
      description,
      sort_order
    `)
    .eq(
      "version_section_id",
      versionSection.id
    )
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (groupsError) {
    throw groupsError;
  }

  const groups =
    groupsData ?? [];

  // ==========================================================
  // QUESTIONS
  // ==========================================================

  const {
    data: questionsData,
    error: questionsError,
  } = await supabase
    .from("questions")
    .select(`
      id,
      question_group_id,
      code,
      question_text,
      help_text,
      question_type,
      is_required,
      unit,
      min_value,
      max_value,
      placeholder,
      config,
      sort_order
    `)
    .eq(
      "version_section_id",
      versionSection.id
    )
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (questionsError) {
    throw questionsError;
  }

  const questions =
    questionsData ?? [];

  // ==========================================================
  // QUESTION RULES
  // ==========================================================

  const questionIds =
    questions.map(
      (question: any) =>
        question.id
    );

  let rulesData: any[] = [];

  if (questionIds.length) {
    const {
      data,
      error,
    } = await supabase
      .from("question_rules")
      .select(`
        id,
        question_id,
        rule_type,
        condition,
        action_config,
        sort_order
      `)
      .in(
        "question_id",
        questionIds
      )
      .eq("is_active", true)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    rulesData =
      data ?? [];
  }

  const rulesByQuestion =
    new Map<string, any[]>();

  for (
    const rule of rulesData
  ) {
    const current =
      rulesByQuestion.get(
        rule.question_id
      ) ?? [];

    current.push(rule);

    rulesByQuestion.set(
      rule.question_id,
      current
    );
  }

  const questionsWithRules =
    questions.map(
      (question: any) => ({
        ...question,
        rules:
          rulesByQuestion.get(
            question.id
          ) ?? [],
      })
    );

  return {
    form,
    assignment,
    formVersion,
    section,
    versionSection,
    groups,
    questions:
      questionsWithRules,
  };
}
