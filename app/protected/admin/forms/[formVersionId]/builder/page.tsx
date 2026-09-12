import { notFound, redirect } from "next/navigation";

import { FormVersionBuilder, type BuilderData } from "@/components/admin/forms/form-version-builder";
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function BuilderPage({ params }: { params: Promise<{ formVersionId: string }> }) {
  await requirePermission("forms.manage");
  const { formVersionId } = await params;
  if (!UUID_PATTERN.test(formVersionId)) notFound();
  const admin = createAdminClient();
  const { data: version, error: versionError } = await admin.from("form_versions").select("id, form_id, version_number, status, notes, forms!inner(id, code, name)").eq("id", formVersionId).maybeSingle();
  if (versionError || !version) notFound();
  if (version.status !== "draft") redirect("/protected/admin/forms");
  const { data: sections, error: sectionsError } = await admin.from("form_version_sections").select("id, section_id, display_name, description, sort_order, is_required, is_active").eq("form_version_id", formVersionId).order("sort_order", { ascending: true });
  if (sectionsError) notFound();
  const sectionIds = (sections ?? []).map((item) => item.id);
  const { data: groups } = sectionIds.length ? await admin.from("question_groups").select("id, version_section_id, code, name, sort_order, is_active").in("version_section_id", sectionIds).order("sort_order", { ascending: true }) : { data: [] };
  const { data: questions } = sectionIds.length ? await admin.from("questions").select("id, version_section_id, question_group_id, code, question_text, help_text, question_type, is_required, unit, min_value, max_value, placeholder, sort_order, is_active").in("version_section_id", sectionIds).order("sort_order", { ascending: true }) : { data: [] };
  const questionIds = (questions ?? []).map((item) => item.id);
  const { data: options } = questionIds.length ? await admin.from("question_options").select("id, question_id, value, label, sort_order, is_failure").in("question_id", questionIds).order("sort_order", { ascending: true }) : { data: [] };
  const groupIds = (groups ?? []).map((item) => item.id);
  const [sectionTranslations, groupTranslations, questionTranslations, optionTranslations] = await Promise.all([
    sectionIds.length ? admin.from("form_version_section_translations").select("version_section_id, locale, display_name, description").in("version_section_id", sectionIds) : Promise.resolve({ data: [] }),
    groupIds.length ? admin.from("question_group_translations").select("question_group_id, locale, display_name, description").in("question_group_id", groupIds) : Promise.resolve({ data: [] }),
    questionIds.length ? admin.from("question_translations").select("question_id, locale, question_text, help_text").in("question_id", questionIds) : Promise.resolve({ data: [] }),
    (options ?? []).length ? admin.from("question_option_translations").select("option_id, locale, label").in("option_id", (options ?? []).map((item) => item.id)) : Promise.resolve({ data: [] }),
  ]);
  const form = Array.isArray(version.forms) ? version.forms[0] : version.forms;
  if (!form) notFound();
  const data: BuilderData = {
    version: { id: version.id, version_number: version.version_number, status: version.status, notes: version.notes },
    form,
    sections: (sections ?? []).map((section) => ({
      ...section,
      translations: (sectionTranslations.data ?? []).filter((item) => item.version_section_id === section.id),
      groups: (groups ?? []).filter((group) => group.version_section_id === section.id).map((group) => ({
        ...group,
        translations: (groupTranslations.data ?? []).filter((item) => item.question_group_id === group.id),
        questions: (questions ?? []).filter((question) => question.question_group_id === group.id).map((question) => ({
          ...question,
          translations: (questionTranslations.data ?? []).filter((item) => item.question_id === question.id),
          options: (options ?? []).filter((option) => option.question_id === question.id).map((option) => ({ ...option, translations: (optionTranslations.data ?? []).filter((item) => item.option_id === option.id) })),
        })),
      })),
      questions: (questions ?? []).filter((question) => question.version_section_id === section.id && !question.question_group_id).map((question) => ({
        ...question,
        translations: (questionTranslations.data ?? []).filter((item) => item.question_id === question.id),
        options: (options ?? []).filter((option) => option.question_id === question.id).map((option) => ({ ...option, translations: (optionTranslations.data ?? []).filter((item) => item.option_id === option.id) })),
      })),
    })),
  };
  return <FormVersionBuilder data={data} />;
}
