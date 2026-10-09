import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


function dateLabel(
  value:
    | string
    | null,
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}


export default async function QaFoodDashboardPage() {
  const {
    user,
    profile,
    isAdmin,
    permissionCodes,
  } =
    await getAccessContext();


  const canSubmit =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit",
    );

  const canViewManagement =
    isAdmin ||
    permissionCodes.includes(
      "audit.view_management",
    );


  if (
    !canSubmit &&
    !canViewManagement
  ) {
    redirect(
      "/protected",
    );
  }


  const admin =
    createAdminClient();


  const activeOutlet =
    await getActiveOutlet();


  if (!activeOutlet) {
    redirect(
      "/protected/select-outlet",
    );
  }


  let openSession:
    any =
    null;

  let latestFinalized:
    any =
    null;

  let finalizedCount =
    0;


  if (activeOutlet?.id) {
    const [
      openResult,
      latestResult,
      countResult,
    ] =
      await Promise.all([
        admin
          .from(
            "qa_food_sessions",
          )
          .select(`
            id,
            business_date,
            status,
            target_menu_count,
            started_at,
            auditor_name_snapshot
          `)
          .eq(
            "organization_id",
            profile.organization_id,
          )
          .eq(
            "outlet_id",
            activeOutlet.id,
          )
          .eq(
            "created_by",
            user.id,
          )
          .eq(
            "status",
            "OPEN",
          )
          .order(
            "started_at",
            {
              ascending:
                false,
            },
          )
          .limit(1)
          .maybeSingle(),

        admin
          .from(
            "qa_food_sessions",
          )
          .select(`
            id,
            qa_number,
            business_date,
            score,
            max_score,
            result_status,
            scoring_snapshot,
            finalized_at,
            auditor_name_snapshot
          `)
          .eq(
            "organization_id",
            profile.organization_id,
          )
          .eq(
            "outlet_id",
            activeOutlet.id,
          )
          .eq(
            "status",
            "FINALIZED",
          )
          .order(
            "finalized_at",
            {
              ascending:
                false,
            },
          )
          .limit(1)
          .maybeSingle(),

        admin
          .from(
            "qa_food_sessions",
          )
          .select(
            "id",
            {
              count:
                "exact",

              head:
                true,
            },
          )
          .eq(
            "organization_id",
            profile.organization_id,
          )
          .eq(
            "outlet_id",
            activeOutlet.id,
          )
          .eq(
            "status",
            "FINALIZED",
          ),
      ]);


    if (openResult.error) {
      throw openResult.error;
    }

    if (latestResult.error) {
      throw latestResult.error;
    }

    if (countResult.error) {
      throw countResult.error;
    }


    openSession =
      openResult.data;

    latestFinalized =
      latestResult.data;

    finalizedCount =
      countResult.count ??
      0;
  }


  const scoring =
    latestFinalized
      ?.scoring_snapshot &&
    typeof latestFinalized
      .scoring_snapshot ===
      "object"
      ? latestFinalized
          .scoring_snapshot
      : {};


  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-[1180px]">

        <header className="flex flex-col gap-5 border-b border-neutral-200 pb-6 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              Operational Quality
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              QA Food Standard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              Kitchen Speed & Menu Quality
            </p>

          </div>


          <Link
            href="/protected/audit"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-black"
          >
            ← Audit
          </Link>

        </header>


        <section className="mt-6 rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">

          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
            Current Outlet
          </p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-2xl font-black">
                {
                  activeOutlet?.name ??
                  "No active outlet"
                }
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Target 10 menu · Service standard ≤13 minutes
              </p>

            </div>


            <div
              className={[
                "inline-flex w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]",
                openSession
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700",
              ].join(
                " ",
              )}
            >
              {openSession
                ? "Assessment In Progress"
                : "Ready"}
            </div>

          </div>

        </section>


        <section className="mt-5 grid gap-4 lg:grid-cols-3">

          <Link
            href="/protected/audit/food-standard/assessment"
            className="group rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-sm font-black text-white">
              QA
            </div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
              Assessment
            </p>

            <h2 className="mt-1 text-xl font-black">
              {openSession
                ? "Resume Assessment"
                : "Start Assessment"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Order, timer, food quality assessment, evidence photo and final scoring.
            </p>

            {openSession ? (
              <p className="mt-5 text-xs font-bold text-amber-700">
                Open since{" "}
                {dateLabel(
                  openSession.business_date,
                )}
              </p>
            ) : (
              <p className="mt-5 text-xs font-bold text-neutral-400">
                No open session
              </p>
            )}

          </Link>


          <Link
            href="/protected/audit/food-standard/history"
            className="group rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-700">
              H
            </div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
              History
            </p>

            <h2 className="mt-1 text-xl font-black">
              Assessment History
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              View finalized QA assessments, scores, correction status and reports.
            </p>

            <p className="mt-5 text-xs font-bold text-neutral-400">
              {finalizedCount} finalized assessment
              {finalizedCount === 1
                ? ""
                : "s"}
            </p>

          </Link>


          <div className="rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm">

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
              R
            </div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
              Latest Result
            </p>


            {latestFinalized ? (
              <>

                <div className="mt-2 flex items-end gap-2">

                  <p className="text-3xl font-black">
                    {
                      latestFinalized.score ??
                      0
                    }
                  </p>

                  <p className="pb-1 text-sm font-black text-neutral-400">
                    /100
                  </p>

                </div>


                <p className="mt-1 text-xs text-neutral-500">
                  {dateLabel(
                    latestFinalized.business_date,
                  )}
                </p>


                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold">

                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700">
                    {
                      Number(
                        scoring.standard_menu_count ??
                        0,
                      )
                    } Standard
                  </span>

                  <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-700">
                    {
                      Number(
                        scoring.needs_correction_count ??
                        0,
                      )
                    } Correction
                  </span>

                </div>


                <div className="mt-6 flex flex-wrap gap-2">

                  <Link
                    href={`/protected/audit/food-standard/report/${latestFinalized.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-xs font-black text-white"
                  >
                    View Report
                  </Link>

                  <a
                    href={`/api/audit/food-standard/${latestFinalized.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 px-4 text-xs font-black"
                  >
                    PDF
                  </a>

                </div>

              </>
            ) : (
              <p className="mt-3 text-sm text-neutral-400">
                No finalized assessment yet.
              </p>
            )}

          </div>

        </section>


        {latestFinalized ? (

          <section className="mt-5 rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Most Recent QA
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {
                    latestFinalized.qa_number
                  }
                </h2>

                <p className="mt-2 text-sm text-neutral-500">
                  {
                    latestFinalized.auditor_name_snapshot
                  }
                  {" · "}
                  {
                    dateLabel(
                      latestFinalized.business_date,
                    )
                  }
                </p>

              </div>


              <div className="flex gap-3">

                <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-center text-white">

                  <p className="text-[9px] font-black uppercase tracking-wide text-white/60">
                    Score
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {
                      latestFinalized.score
                    }
                    /100
                  </p>

                </div>

              </div>

            </div>

          </section>

        ) : null}

      </div>

    </main>
  );
}
