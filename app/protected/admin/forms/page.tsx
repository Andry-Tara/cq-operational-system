
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import CreateDraftButton from "@/components/admin/forms/create-draft-button";
import PublishVersionButton from "@/components/admin/forms/publish-version-button";
import ActivateVersionButton from "@/components/admin/forms/activate-version-button";
import Link from "next/link";

export default async function FormsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const {
    profile,
  } =
    await requirePermission("forms.manage");

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
        name,
        description,
        operational_scope,
        is_active
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .order("name");

  const formSearch = (await searchParams)?.q?.trim().toLowerCase() ?? "";
  const visibleForms = (forms ?? []).filter((form: any) => {
    if (!formSearch) return true;
    return [form.name, form.code, form.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(formSearch));
  });

  const formIds =
    visibleForms.map(
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
            status,
            published_at
          `)
          .in(
            "form_id",
            formIds
          )
          .order(
            "version_number",
            {
              ascending: false,
            }
          )
      : { data: [] as any[] };

  const {
    data: assignments,
  } =
    formIds.length
      ? await admin
          .from(
            "outlet_form_assignments"
          )
          .select(`
            form_id,
            outlet_id,
            form_version_id
          `)
          .in(
            "form_id",
            formIds
          )
          .eq(
            "is_active",
            true
          )
      : { data: [] as any[] };

  const {
    data: outlets,
  } =
    await admin
      .from("outlets")
      .select("id, code, name, operational_scope")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name");

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 md:px-8 md:py-12">
<div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold text-neutral-950">
          Forms
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Current operational form configuration.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <form method="get" className="md:col-span-2">
          <label className="sr-only" htmlFor="form-search">
            Search forms
          </label>
          <input
            id="form-search"
            name="q"
            defaultValue={formSearch}
            placeholder="Search forms..."
            className="min-h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
          />
        </form>
        {visibleForms.map(
          (form: any) => {
            const formVersions =
              (versions ?? [])
                .filter(
                  (version: any) =>
                    version.form_id ===
                    form.id
                );

            const latest =
              formVersions[0];

            const outletCount =
              new Set(
                (assignments ?? [])
                  .filter(
                    (row: any) =>
                      row.form_id ===
                      form.id
                  )
                  .map(
                    (row: any) =>
                      row.outlet_id
                  )
              ).size;

            return (
              <div
                key={form.id}
                className="rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                      {form.code}
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-neutral-900">
                      {form.name}
                    </h2>
                  </div>

                  <span
                    className={
                      form.is_active
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black text-emerald-700"
                        : "rounded-full bg-neutral-100 px-3 py-1 text-[9px] font-black text-neutral-500"
                    }
                  >
                    {form.is_active
                      ? "ACTIVE"
                      : "INACTIVE"}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  {form.description ||
                    "Operational form."}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Stat
                    label="Latest Version"
                    value={
                      latest
                        ? `v${latest.version_number}`
                        : "-"
                    }
                  />

                  <Stat
                    label="Assigned Outlets"
                    value={String(
                      outletCount
                    )}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {formVersions.map(
                    (version: any) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-800">
                            v{version.version_number}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                            {version.status}
                          </span>
                        </div>

                        {version.status ===
                          "published" && (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-semibold text-neutral-500">
                              Active {(
                                (assignments ?? []).filter(
                                  (row: any) =>
                                    row.form_id === form.id &&
                                    row.form_version_id === version.id,
                                ).length
                              )} / {(outlets ?? []).filter(
                                (outlet: any) =>
                                  outlet.operational_scope ===
                                  form.operational_scope,
                              ).length} outlets
                            </span>
                            <CreateDraftButton
                              formVersionId={version.id}
                            />
                            <ActivateVersionButton
                              formName={form.name}
                              formVersionId={version.id}
                              versionNumber={version.version_number}
                              outlets={(outlets ?? [])
                                .filter(
                                  (outlet: any) =>
                                    outlet.operational_scope ===
                                    form.operational_scope,
                                )
                                .map((outlet: any) => {
                                const assignment = (assignments ?? []).find(
                                  (row: any) =>
                                    row.outlet_id === outlet.id &&
                                    row.form_id === form.id,
                                );

                                const activeVersion = (versions ?? []).find(
                                  (candidate: any) =>
                                    candidate.id === assignment?.form_version_id,
                                );

                                return {
                                  id: outlet.id,
                                  code: outlet.code,
                                  name: outlet.name,
                                  currentVersionNumber:
                                    activeVersion?.version_number ?? null,
                                  isSelectedVersionActive:
                                    assignment?.form_version_id === version.id,
                                };
                                })}
                              activeOutletCount={
                                (assignments ?? []).filter(
                                  (row: any) =>
                                    row.form_id === form.id &&
                                    row.form_version_id === version.id,
                                ).length
                              }
                            />
                          </div>
                        )}

                        {version.status ===
                          "draft" && (
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/protected/admin/forms/${version.id}/builder`}
                              className="text-xs font-semibold text-red-700 underline"
                            >
                              Open Builder
                            </Link>
                            <PublishVersionButton
                              formVersionId={version.id}
                            />
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  Form editing will use version control to protect live operational reports.
                </div>
              </div>
            );
          }
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-neutral-800">
        {value}
      </p>
    </div>
  );
}
