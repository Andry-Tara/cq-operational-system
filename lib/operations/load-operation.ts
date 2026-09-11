import {
  normalizeOperationCode,
} from "./config";
import type {
  AppLocale,
} from "@/lib/localization/locale";

type LoadOperationArgs = {
  supabase: any;
  organizationId: string;
  outletId: string;
  formCode: string;
  sectionCode: string;
  historicalReportId?: string | null;
};

export async function loadOperationDefinition({
  supabase,
  organizationId,
  outletId,
  formCode,
  sectionCode,
  historicalReportId,
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

  let assignment: any = null;
  let pinnedHistoricalVersionId:
    string | null = null;

  if (historicalReportId) {
    const {
      data: historicalReport,
      error: historicalReportError,
    } = await supabase
      .from("reports")
      .select("form_version_id")
      .eq("id", historicalReportId)
      .eq("outlet_id", outletId)
      .eq("form_id", form.id)
      .maybeSingle();

    if (historicalReportError) {
      throw historicalReportError;
    }

    pinnedHistoricalVersionId =
      historicalReport?.form_version_id ?? null;

    if (!pinnedHistoricalVersionId) {
      throw new Error(
        `${form.name} historical report version tidak ditemukan.`
      );
    }
  } else {
    const {
      data: currentAssignment,
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

    if (!currentAssignment) {
      throw new Error(
        `${form.name} belum diaktifkan untuk outlet ini.`
      );
    }

    assignment = currentAssignment;
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
      pinnedHistoricalVersionId ||
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

  if (
    !pinnedHistoricalVersionId &&
    formVersion.status !== "published"
  ) {
    throw new Error(
      `${form.name} belum memiliki versi operasional yang tersedia.`
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
      description,
      area_code
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

  const groupIds =
    groups.map(
      (group: any) =>
        group.id
    );

  let groupTranslations: any[] = [];

  if (groupIds.length) {
    const {
      data,
      error,
    } = await supabase
      .from("question_group_translations")
      .select(`
        question_group_id,
        locale,
        display_name,
        description
      `)
      .in(
        "question_group_id",
        groupIds
      )
      .in("locale", ["en", "id-ID"]);

    if (error) {
      throw error;
    }

    groupTranslations =
      data ?? [];
  }

  const groupTranslationsById =
    new Map<string, Partial<Record<AppLocale, any>>>();

  for (
    const translation of
    groupTranslations
  ) {
    const translations =
      groupTranslationsById.get(
        translation.question_group_id
      ) ?? {};

    translations[
      translation.locale as AppLocale
    ] = translation;

    groupTranslationsById.set(
      translation.question_group_id,
        translations
    );
  }

  const groupsWithTranslations =
    groups.map(
      (group: any) => ({
        ...group,
        translation:
          groupTranslationsById.get(
            group.id
          ) ?? {},
      })
    );

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

  const questionIds =
    questions.map(
      (question: any) =>
        question.id
    );

  const {
    data: sectionTranslations,
    error: sectionTranslationError,
  } = await supabase
    .from("form_version_section_translations")
    .select(`
      locale,
      display_name,
      description
    `)
    .eq(
      "version_section_id",
      versionSection.id
    )
    .in("locale", ["en", "id-ID"])
    ;

  if (sectionTranslationError) {
    throw sectionTranslationError;
  }

  let questionTranslations: any[] = [];

  if (questionIds.length) {
    const {
      data,
      error,
    } = await supabase
      .from("question_translations")
      .select(`
        question_id,
        locale,
        question_text,
        help_text
      `)
      .in(
        "question_id",
        questionIds
      )
      .in("locale", ["en", "id-ID"]);

    if (error) {
      throw error;
    }

    questionTranslations =
      data ?? [];
  }

  const questionTranslationsById =
    new Map<string, Partial<Record<AppLocale, any>>>();

  for (
    const translation of
    questionTranslations
  ) {
    const translations =
      questionTranslationsById.get(
        translation.question_id
      ) ?? {};

    translations[
      translation.locale as AppLocale
    ] = translation;

    questionTranslationsById.set(
      translation.question_id,
      translations
    );
  }

  // ==========================================================
  // QUESTION RULES
  // ==========================================================

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
        translations:
          questionTranslationsById.get(
            question.id
          ) ?? {},
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
    versionSection: {
      ...versionSection,
      translation:
        (sectionTranslations ?? []).reduce(
          (
            result: Partial<Record<AppLocale, any>>,
            translation: any
          ) => {
            result[
              translation.locale as AppLocale
            ] = translation;
            return result;
          },
          {}
        ),
    },
    groups:
      groupsWithTranslations,
    questions:
      questionsWithRules,
  };
}
