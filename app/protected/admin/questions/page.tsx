
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function QuestionsAdminPage() {
  const {
    profile,
  } =
    await requirePermission("questions.manage");

  const admin =
    createAdminClient();

  const {
    data: forms,
  } =
    await admin
      .from("forms")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .order("name");

  const formIds =
    (forms ?? []).map(
      (form) => form.id
    );

  const {
    data: versions,
  } =
    formIds.length
      ? await admin
          .from(
            "form_versions"
          )
          .select(`
            id,
            form_id,
            version_number,
            status
          `)
          .in(
            "form_id",
            formIds
          )
      : { data: [] as any[] };

  const versionIds =
    (versions ?? []).map(
      (version) =>
        version.id
    );

  const {
    data:
      versionSections,
  } =
    versionIds.length
      ? await admin
          .from(
            "form_version_sections"
          )
          .select(`
            id,
            form_version_id,
            display_name,
            sort_order,
            is_active
          `)
          .in(
            "form_version_id",
            versionIds
          )
      : { data: [] as any[] };

  const sectionIds =
    (
      versionSections ?? []
    ).map(
      (section) =>
        section.id
    );

  const {
    data: questions,
  } =
    sectionIds.length
      ? await admin
          .from("questions")
          .select(`
            id,
            version_section_id,
            code,
            question_text,
            question_type,
            unit,
            min_value,
            max_value,
            is_required,
            sort_order,
            is_active
          `)
          .in(
            "version_section_id",
            sectionIds
          )
          .order(
            "sort_order"
          )
      : { data: [] as any[] };

  const formMap =
    new Map(
      (forms ?? []).map(
        (form) => [
          form.id,
          form,
        ]
      )
    );

  const versionMap =
    new Map(
      (versions ?? []).map(
        (version) => [
          version.id,
          version,
        ]
      )
    );

  const sectionMap =
    new Map(
      (
        versionSections ?? []
      ).map(
        (section) => [
          section.id,
          section,
        ]
      )
    );

  const rows =
    (questions ?? []).map(
      (question: any) => {
        const section =
          sectionMap.get(
            question
              .version_section_id
          );

        const version =
          section
            ? versionMap.get(
                section
                  .form_version_id
              )
            : null;

        const form =
          version
            ? formMap.get(
                version.form_id
              )
            : null;

        return {
          ...question,
          sectionName:
            section?.display_name ??
            "-",
          versionNumber:
            version?.version_number ??
            "-",
          versionStatus:
            version?.status ??
            "-",
          formName:
            form?.name ?? "-",
          formCode:
            form?.code ?? "-",
        };
      }
    );

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 md:py-12">
<div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold text-neutral-950">
          Questions
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Current checklist master and validation configuration.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-neutral-400">
            No questions found.
          </div>
        )}

        {rows.map(
          (question: any) => (
            <div
              key={question.id}
              className="grid gap-4 border-b border-neutral-100 px-5 py-5 last:border-b-0 md:grid-cols-[1fr_2.2fr_1fr]"
            >
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-red-700">
                  {question.formCode}
                  {" · "}
                  v{question.versionNumber}
                </p>

                <p className="mt-1 text-xs font-semibold text-neutral-500">
                  {
                    question.sectionName
                  }
                </p>
              </div>

              <div>
                <p className="text-sm font-bold leading-6 text-neutral-900">
                  {
                    question.question_text
                  }
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  {question.code}
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-2 md:justify-end">
                <Tag>
                  {
                    question.question_type
                  }
                </Tag>

                {question.unit && (
                  <Tag>
                    {question.unit}
                  </Tag>
                )}

                {question.min_value !=
                  null && (
                  <Tag>
                    MIN{" "}
                    {
                      question.min_value
                    }
                  </Tag>
                )}

                {question.max_value !=
                  null && (
                  <Tag>
                    MAX{" "}
                    {
                      question.max_value
                    }
                  </Tag>
                )}

                {!question.is_active && (
                  <Tag>
                    DISABLED
                  </Tag>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
        Question editing will be enabled through draft versions so changes never modify an already-used checklist version.
      </div>
    </main>
  );
}

function Tag({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-500">
      {children}
    </span>
  );
}
