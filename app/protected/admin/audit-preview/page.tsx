import { notFound } from "next/navigation";

import {
  OutletAuditPreview,
  type AuditPreviewData,
} from "@/components/admin/audit/outlet-audit-preview";
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OutletAuditPreviewPage() {
  const { profile } =
    await requirePermission("forms.manage");

  const admin =
    createAdminClient();

  const {
    data: form,
    error: formError,
  } = await admin
    .from("forms")
    .select(`
      id,
      code,
      name,
      description
    `)
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "code",
      "OUTLET_AUDIT"
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (
    formError ||
    !form
  ) {
    notFound();
  }

  const {
    data: version,
    error: versionError,
  } = await admin
    .from("form_versions")
    .select(`
      id,
      version_number,
      status,
      notes
    `)
    .eq(
      "form_id",
      form.id
    )
    .eq(
      "version_number",
      1
    )
    .maybeSingle();

  if (
    versionError ||
    !version
  ) {
    notFound();
  }

  const {
    data: sections,
    error: sectionsError,
  } = await admin
    .from("form_version_sections")
    .select(`
      id,
      display_name,
      description,
      sort_order,
      is_active
    `)
    .eq(
      "form_version_id",
      version.id
    )
    .eq(
      "is_active",
      true
    )
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (
    sectionsError ||
    !sections?.length
  ) {
    notFound();
  }

  const sectionIds =
    sections.map(
      (section) =>
        section.id
    );

  const [
    groupsResult,
    questionsResult,
    categoriesResult,
  ] =
    await Promise.all([
      admin
        .from("question_groups")
        .select(`
          id,
          version_section_id,
          code,
          name,
          sort_order,
          is_active
        `)
        .in(
          "version_section_id",
          sectionIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),

      admin
        .from("questions")
        .select(`
          id,
          version_section_id,
          question_group_id,
          code,
          question_text,
          sort_order,
          is_active,
          config
        `)
        .in(
          "version_section_id",
          sectionIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),

      admin
        .from(
          "audit_finding_categories"
        )
        .select(`
          id,
          code,
          name,
          sort_order,
          is_active
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),
    ]);

  if (
    groupsResult.error ||
    questionsResult.error ||
    categoriesResult.error
  ) {
    throw (
      groupsResult.error ||
      questionsResult.error ||
      categoriesResult.error
    );
  }

  const groups =
    groupsResult.data ??
    [];

  const questions =
    questionsResult.data ??
    [];

  const data: AuditPreviewData = {
    form: {
      id: form.id,
      code: form.code,
      name: form.name,
      description:
        form.description,
    },
    version: {
      id: version.id,
      versionNumber:
        version.version_number,
      status:
        version.status,
    },
    groups:
      groups.map(
        (group) => ({
          id:
            group.id,
          code:
            group.code,
          name:
            group.name,
          sortOrder:
            group.sort_order,
          questions:
            questions
              .filter(
                (question) =>
                  question.question_group_id ===
                  group.id
              )
              .map(
                (question) => ({
                  id:
                    question.id,
                  code:
                    question.code,
                  text:
                    question.question_text,
                  sortOrder:
                    question.sort_order,
                })
              ),
        })
      ),
    categories:
      (
        categoriesResult.data ??
        []
      ).map(
        (category) => ({
          id:
            category.id,
          code:
            category.code,
          name:
            category.name,
        })
      ),
  };

  return (
    <OutletAuditPreview
      data={data}
    />
  );
}
