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


  // ==========================================================
  // VALID OPERATION
  // ==========================================================

  if (!config) {
    return (
      <ErrorState
        title="Operation Not Found"
        message="Operation yang dipilih tidak tersedia."
      />
    );
  }


  // ==========================================================
  // FRONTEND PHASE 1
  //
  // Generic backend supports multiple operations,
  // but new UI is activated for OPENING first.
  //
  // Existing Closing production remains untouched.
  // ==========================================================

  if (
    normalizedFormCode !==
    "OPENING"
  ) {
    return (
      <ErrorState
        title="Operation UI Not Enabled"
        message={`${config.displayName} masih menggunakan production route yang lama.`}
      />
    );
  }


  if (
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


  // ==========================================================
  // PERMISSION
  // ==========================================================

  await requirePermission(
    config.permissionCode
  );


  const supabase =
    await createClient();


  // ==========================================================
  // AUTH
  // ==========================================================

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


  // ==========================================================
  // PROFILE
  // ==========================================================

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
        title="Unable to Load Opening"
        message="Profile user tidak ditemukan."
      />
    );
  }


  if (
    !profile.organization_id
  ) {
    return (
      <ErrorState
        title="Unable to Load Opening"
        message="Organization user tidak ditemukan."
      />
    );
  }


  // ==========================================================
  // ACTIVE OUTLET
  // ==========================================================

  const outlet =
    await getActiveOutlet();


  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  // ==========================================================
  // OUTLET ACCESS
  // ==========================================================

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
        title="Unable to Load Opening"
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


  // ==========================================================
  // LOAD OPENING DEFINITION
  // ==========================================================

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


    if (
      !operation.questions
        .length
    ) {
      return (
        <ErrorState
          title="Unable to Load Opening"
          message="Belum ada pertanyaan Opening Kitchen."
        />
      );
    }


    return (
      <main className="min-h-screen bg-[#f4f4f4] text-[#202020]">

        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-5 md:px-8 md:py-10">

          {/* ==================================================
              OPENING HEADER
          ================================================== */}

          <section className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm md:rounded-[28px]">

            <div className="p-5 sm:p-6 md:p-8">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-start gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl">

                    ☀️

                  </div>

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">

                      Daily Operational

                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">

                      Opening Outlet

                    </h1>

                    <p className="mt-2 text-sm font-medium text-neutral-500">

                      {outlet.name} · Kitchen / BOH

                    </p>

                  </div>

                </div>


                <div className="flex flex-wrap gap-2">

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

                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:px-4">

                  <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                    Groups

                  </p>

                  <p className="mt-1 text-lg font-black text-neutral-950">

                    {
                      operation
                        .groups
                        .length
                    }

                  </p>

                </div>


                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:px-4">

                  <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                    Questions

                  </p>

                  <p className="mt-1 text-lg font-black text-neutral-950">

                    {
                      operation
                        .questions
                        .length
                    }

                  </p>

                </div>


                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:px-4">

                  <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                    Version

                  </p>

                  <p className="mt-1 text-lg font-black text-neutral-950">

                    v{
                      operation
                        .formVersion
                        .version_number
                    }

                  </p>

                </div>

              </div>

            </div>

          </section>


          {/* ==================================================
              CHECKLIST
          ================================================== */}

          <OperationClient
            outlet={{
              id:
                outlet.id,

              code:
                outlet.code,

              name:
                outlet.name,
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
        title="Unable to Load Opening"
        message={
          error?.message ||
          "Opening belum tersedia."
        }
        showChangeOutlet
      />
    );

  }
}


// ============================================================
// ERROR
// ============================================================

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
