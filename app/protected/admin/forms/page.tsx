
import { requirePermission } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function FormsAdminPage() {
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
        is_active
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
            outlet_id
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
        {(forms ?? []).map(
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
