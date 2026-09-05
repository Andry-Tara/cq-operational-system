import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  requirePermission,
} from "@/lib/admin/require-admin";

import {
  getOperationConfig,
  normalizeOperationCode,
} from "@/lib/operations/config";

import {
  loadOperationDefinition,
} from "@/lib/operations/load-operation";

import OperationClient from "./operation-client";


type PageProps = {
  params: Promise<{
    formCode: string;
    sectionCode: string;
  }>;
};


export default async function OperationPage({
  params,
}: PageProps) {
  const {
    formCode,
    sectionCode,
  } = await params;

  const normalizedFormCode =
    normalizeOperationCode(
      formCode
    );

  const normalizedSectionCode =
    normalizeOperationCode(
      sectionCode
    );

  const config =
    getOperationConfig(
      normalizedFormCode
    );


  if (!config) {
    return (
      <ErrorState
        title="Operation Not Found"
        message="Operation yang dipilih tidak tersedia."
      />
    );
  }


  // Existing Closing Outlet remains on its dedicated
  // production route. Generic UI is enabled for the
  // stable Opening route and section-scoped CK forms.
  const genericUiEnabled =
    normalizedFormCode ===
      "OPENING" ||
    Boolean(
      config.sectionScoped
    );

  if (!genericUiEnabled) {
    return (
      <ErrorState
        title="Operation UI Not Enabled"
        message={`${config.displayName} masih menggunakan production route yang lama.`}
      />
    );
  }


  if (
    normalizedFormCode ===
      "OPENING" &&
    normalizedSectionCode !==
      "KITCHEN"
  ) {
    return (
      <ErrorState
        title="Section Not Available"
        message="Opening saat ini tersedia untuk Kitchen / BOH."
      />
    );
  }


  // Legacy Opening keeps the existing app permission gate.
  // CK is authorized by exact section permission below.
  if (!config.sectionScoped) {
    await requirePermission(
      config.permissionCode
    );
  }


  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/auth/login"
    );
  }


  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      job_title,
      organization_id
    `)
    .eq(
      "id",
      user.id
    )
    .maybeSingle();


  if (!profile) {
    return (
      <ErrorState
        title={`Unable to Load ${config.displayName}`}
        message="Profile user tidak ditemukan."
      />
    );
  }


  if (
    !profile.organization_id
  ) {
    return (
      <ErrorState
        title={`Unable to Load ${config.displayName}`}
        message="Organization user tidak ditemukan."
      />
    );
  }


  const outlet =
    await getActiveOutlet();


  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const {
    data:
      hasOutletAccess,
    error:
      outletAccessError,
  } =
    await supabase.rpc(
      "has_outlet_access",
      {
        p_outlet_id:
          outlet.id,
      }
    );


  if (
    outletAccessError
  ) {
    return (
      <ErrorState
        title={`Unable to Load ${config.displayName}`}
        message={
          outletAccessError.message
        }
      />
    );
  }


  if (
    hasOutletAccess !==
    true
  ) {
    return (
      <ErrorState
        title="Access Denied"
        message="Anda tidak memiliki akses ke outlet ini."
        showChangeOutlet
      />
    );
  }


  try {
    const operation =
      await loadOperationDefinition({
        supabase,

        organizationId:
          profile.organization_id,

        outletId:
          outlet.id,

        formCode:
          normalizedFormCode,

        sectionCode:
          normalizedSectionCode,
      });


    if (config.sectionScoped) {
      const {
        data: canFill,
        error: fillError,
      } = await supabase.rpc(
        "has_section_permission",
        {
          p_outlet_id:
            outlet.id,
          p_form_id:
            operation.form.id,
          p_section_id:
            operation.section.id,
          p_permission:
            "fill",
        }
      );

      if (fillError) {
        throw fillError;
      }

      const {
        data: canSubmit,
        error: submitError,
      } = await supabase.rpc(
        "has_section_permission",
        {
          p_outlet_id:
            outlet.id,
          p_form_id:
            operation.form.id,
          p_section_id:
            operation.section.id,
          p_permission:
            "submit",
        }
      );

      if (submitError) {
        throw submitError;
      }

      if (
        canFill !== true &&
        canSubmit !== true
      ) {
        return (
          <ErrorState
            title="Section Access Denied"
            message="Section ini hanya dapat diisi oleh PIC yang ditugaskan."
          />
        );
      }
    }


    if (
      !operation.questions
        .length
    ) {
      return (
        <ErrorState
          title={`Unable to Load ${config.displayName}`}
          message={`Belum ada pertanyaan untuk ${operation.section.name}.`}
        />
      );
    }


    const sectionDisplayName =
      config.sectionScoped
        ? (
            operation.versionSection
              .display_name ||
            operation.section.name
          )
        : "Kitchen / BOH";

    const isCentralKitchen =
      Boolean(
        config.sectionScoped
      );


    return (
      <main className="min-h-screen bg-[#f4f4f4] text-[#202020]">
        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-5 md:px-8 md:py-10">

          <section className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm md:rounded-[28px]">
            <div className="p-5 sm:p-6 md:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
                      isCentralKitchen
                        ? "bg-red-50"
                        : "bg-amber-50"
                    }`}
                  >
                    {isCentralKitchen
                      ? "🏭"
                      : "☀️"}
                  </div>

                  <div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                        isCentralKitchen
                          ? "text-red-700"
                          : "text-amber-700"
                      }`}
                    >
                      {isCentralKitchen
                        ? "Central Kitchen"
                        : "Daily Operational"}
                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">
                      {config.displayName}
                    </h1>

                    <p className="mt-2 text-sm font-medium text-neutral-500">
                      {outlet.name} · {sectionDisplayName}
                    </p>
                  </div>
                </div>


                <div className="flex flex-wrap gap-2">
                  {isCentralKitchen && (
                    <Link
                      href="/protected/central-kitchen"
                      className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                    >
                      CK Sections
                    </Link>
                  )}

                  <Link
                    href="/protected"
                    className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/protected/select-outlet"
                    className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black"
                  >
                    Change Outlet
                  </Link>
                </div>
              </div>


              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                <InfoBox
                  label="Groups"
                  value={
                    operation
                      .groups
                      .length
                  }
                />

                <InfoBox
                  label="Questions"
                  value={
                    operation
                      .questions
                      .length
                  }
                />

                <InfoBox
                  label="Version"
                  value={`v${operation.formVersion.version_number}`}
                />
              </div>
            </div>
          </section>


          <OperationClient
            outlet={{
              id:
                outlet.id,

              code:
                outlet.code,

              name:
                outlet.name,
            }}
            operation={{
              formCode:
                normalizedFormCode,

              sectionCode:
                normalizedSectionCode,

              displayName:
                config.displayName,

              sectionName:
                sectionDisplayName,

              sectionScoped:
                Boolean(
                  config.sectionScoped
                ),
            }}
            groups={
              operation.groups
            }
            questions={
              operation.questions
            }
          />

        </div>
      </main>
    );

  } catch (
    error: any
  ) {
    return (
      <ErrorState
        title={`Unable to Load ${config.displayName}`}
        message={
          error?.message ||
          `${config.displayName} belum tersedia.`
        }
        showChangeOutlet
      />
    );
  }
}


function InfoBox({
  label,
  value,
}: {
  label: string;
  value:
    string |
    number;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:px-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-neutral-950">
        {value}
      </p>
    </div>
  );
}


function ErrorState({
  title,
  message,
  showChangeOutlet = false,
}: {
  title: string;
  message: string;
  showChangeOutlet?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-5 py-10 text-[#222]">
      <div className="w-full max-w-[680px] rounded-[28px] border border-black/5 bg-white px-7 py-12 text-center shadow-sm md:px-12">
        <div className="text-5xl">
          ⚠️
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">
          {title}
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-neutral-500 md:text-base">
          {message}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {showChangeOutlet && (
            <Link
              href="/protected/select-outlet"
              className="rounded-xl bg-red-700 px-6 py-3.5 text-sm font-bold text-white"
            >
              Change Outlet
            </Link>
          )}

          <Link
            href="/protected"
            className="rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
