import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  loadQaFoodReportData,
  QA_CRITERIA,
} from "@/lib/qa-food/report-data";


function duration(
  seconds:
    | number
    | null
    | undefined,
) {
  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          seconds ?? 0,
        ),
      ),
    );

  return `${String(
    Math.floor(
      value / 60,
    ),
  ).padStart(
    2,
    "0",
  )}:${String(
    value % 60,
  ).padStart(
    2,
    "0",
  )}`;
}


function dateLabel(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}


function dateTimeLabel(
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
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    },
  ).format(
    new Date(value),
  );
}


export default async function QaFoodReportPage({
  params,
}: {
  params: Promise<{
    sessionId: string;
  }>;
}) {
  const {
    sessionId,
  } =
    await params;


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


  const report =
    await loadQaFoodReportData(
      admin,
      sessionId,
      profile.organization_id,
    );


  if (!report) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-5 py-12">

        <div className="mx-auto max-w-xl rounded-[24px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

          <h1 className="text-2xl font-black">
            QA Report Not Found
          </h1>

          <Link
            href="/protected/audit/food-standard/history"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white"
          >
            Back to History
          </Link>

        </div>

      </main>
    );
  }


  const isOwner =
    report.session.created_by ===
    user.id;


  let assignedOutlet =
    false;


  if (
    !isAdmin &&
    !isOwner &&
    canSubmit
  ) {
    const {
      data,
    } =
      await admin
        .from("user_outlets")
        .select("outlet_id")
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "outlet_id",
          report.session.outlet_id,
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

    assignedOutlet =
      Boolean(data);
  }


  const canRead =
    isAdmin ||
    isOwner ||
    canViewManagement ||
    (
      canSubmit &&
      assignedOutlet &&
      report.session.status ===
        "FINALIZED"
    );


  if (!canRead) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-5 py-12">

        <div className="mx-auto max-w-xl rounded-[24px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

          <h1 className="text-2xl font-black">
            Access Denied
          </h1>

          <p className="mt-3 text-sm text-neutral-500">
            Anda tidak memiliki akses ke QA Food report ini.
          </p>

        </div>

      </main>
    );
  }


  if (
    report.session.status !==
    "FINALIZED"
  ) {
    redirect(
      "/protected/audit/food-standard",
    );
  }


  const scoring =
    report.scoring ?? {};


  const signedUrls =
    new Map<
      string,
      string
    >();


  for (
    const item
    of report.items
  ) {
    for (
      const evidence
      of item.evidence
    ) {
      const {
        data,
      } =
        await admin.storage
          .from(
            evidence.storage_bucket,
          )
          .createSignedUrl(
            evidence.storage_path,
            900,
          );

      if (
        data?.signedUrl
      ) {
        signedUrls.set(
          evidence.id,
          data.signedUrl,
        );
      }
    }
  }


  return (
    <main className="min-h-screen bg-[#eeeeec] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-[1120px]">

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

          <Link
            href="/protected/audit/food-standard/history"
            className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold"
          >
            ← QA History
          </Link>


          <div className="flex flex-wrap gap-2">

            <a
              href={`/api/audit/food-standard/${report.session.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white"
            >
              Open PDF
            </a>

            <a
              href={`/api/audit/food-standard/${report.session.id}/pdf?download=1`}
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-bold"
            >
              Download PDF
            </a>

          </div>

        </div>


        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">

          <header className="border-b border-neutral-200 p-6 sm:p-8">

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              QA Food Standard
            </p>


            <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

              <div>

                <h1 className="text-3xl font-black tracking-tight">
                  Kitchen Speed & Menu Quality
                </h1>

                <p className="mt-2 text-sm text-neutral-500">
                  {report.outlet.name}
                  {" · "}
                  {dateLabel(
                    report.session.business_date,
                  )}
                  {" · "}
                  {report.session.auditor_name_snapshot}
                </p>

                <p className="mt-2 font-mono text-xs font-bold text-neutral-400">
                  {report.session.qa_number}
                </p>

              </div>


              <div className="rounded-[24px] bg-[#292824] px-7 py-5 text-center text-white">

                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/60">
                  QA Score
                </p>

                <p className="mt-1 text-4xl font-black">
                  {report.session.score}
                  <span className="text-lg text-white/60">
                    /100
                  </span>
                </p>

              </div>

            </div>


            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5">

              <Summary
                label="Points Lost"
                value={`-${Number(
                  scoring.points_lost ?? 0,
                )}`}
              />

              <Summary
                label="Standard Menu"
                value={`${Number(
                  scoring.standard_menu_count ?? 0,
                )}/10`}
              />

              <Summary
                label="Needs Correction"
                value={`${Number(
                  scoring.needs_correction_count ?? 0,
                )}/10`}
              />

              <Summary
                label="On Time"
                value={`${Number(
                  scoring.on_time_count ?? 0,
                )}/10`}
              />

              <Summary
                label="Late"
                value={`${Number(
                  scoring.late_count ?? 0,
                )}/10`}
              />

            </div>

          </header>


          <div className="space-y-5 p-5 sm:p-8">

            {report.items.map(
              (item: any) => (
                <article
                  key={
                    item.id
                  }
                  className="overflow-hidden rounded-[24px] border border-neutral-200"
                >

                  <header className="flex flex-col gap-4 border-b border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">
                        Menu {String(
                          item.sequence_no,
                        ).padStart(
                          2,
                          "0",
                        )}
                        {" · "}
                        {item.category_snapshot || "Menu"}
                      </p>

                      <h2 className="mt-1 text-xl font-black">
                        {item.menu_name_snapshot}
                      </h2>

                    </div>


                    <div className="rounded-2xl bg-white px-5 py-3 text-center shadow-sm">

                      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                        Menu Score
                      </p>

                      <p className="mt-1 text-2xl font-black">
                        {item.score}/10
                      </p>

                    </div>

                  </header>


                  <div className="p-5">

                    <div className="grid gap-3 md:grid-cols-3">

                      <Metric
                        label="Service Time"
                        value={duration(
                          item.service_seconds,
                        )}
                      />

                      <Metric
                        label="SLA"
                        value={`≤ ${duration(
                          item.service_standard_seconds,
                        )}`}
                      />

                      <Metric
                        label="Service Result"
                        value={item.service_status || "-"}
                        bad={
                          item.service_status === "LATE"
                        }
                      />

                    </div>


                    <div className="mt-5 grid gap-3 md:grid-cols-2">

                      {QA_CRITERIA.map(
                        (criterion) => {
                          const status =
                            item.assessment?.[
                              criterion.status
                            ] ?? "-";

                          const note =
                            item.assessment?.[
                              criterion.note
                            ] ?? "";

                          const earned =
                            status === "STANDARD"
                              ? 1
                              : 0;

                          return (
                            <div
                              key={
                                criterion.key
                              }
                              className={[
                                "rounded-2xl border p-4",
                                status === "NOT_STANDARD"
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-neutral-200 bg-white",
                              ].join(" ")}
                            >

                              <div className="flex items-start justify-between gap-3">

                                <div>

                                  <p className="text-sm font-black">
                                    {criterion.label}
                                  </p>

                                  <p className="mt-1 text-xs font-bold text-neutral-400">
                                    {earned}/1 point
                                  </p>

                                </div>


                                <span
                                  className={[
                                    "rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wide",
                                    status === "NOT_STANDARD"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-50 text-emerald-700",
                                  ].join(" ")}
                                >
                                  {status}
                                </span>

                              </div>


                              {status === "NOT_STANDARD" &&
                              note ? (

                                <div className="mt-3 border-t border-amber-200 pt-3">

                                  <p className="text-[9px] font-black uppercase tracking-wide text-amber-700">
                                    Note
                                  </p>

                                  <p className="mt-1 text-sm leading-6 text-neutral-700">
                                    {note}
                                  </p>

                                </div>

                              ) : null}

                            </div>
                          );
                        },
                      )}

                    </div>


                    <div className="mt-6">

                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                        Photo Evidence
                      </p>


                      {item.evidence.length ? (

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                          {item.evidence.map(
                            (evidence: any) => (

                              <div
                                key={
                                  evidence.id
                                }
                                className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
                              >

                                {signedUrls.get(
                                  evidence.id,
                                ) ? (

                                  <img
                                    src={
                                      signedUrls.get(
                                        evidence.id,
                                      )
                                    }
                                    alt={
                                      evidence.original_filename ||
                                      "QA Evidence"
                                    }
                                    className="aspect-[4/3] w-full bg-black/5 object-contain"
                                  />

                                ) : (

                                  <div className="flex aspect-[4/3] items-center justify-center text-xs font-bold text-neutral-400">
                                    Evidence unavailable
                                  </div>

                                )}


                                <div className="p-3">

                                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">
                                    {
                                      evidence.capture_source
                                    }
                                    {
                                      evidence.location_status &&
                                      evidence.location_status !==
                                        evidence.capture_source
                                        ? ` · ${evidence.location_status}`
                                        : ""
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-neutral-500">
                                    {
                                      evidence.captured_at
                                        ? `Captured ${dateTimeLabel(
                                            evidence.captured_at,
                                          )}`
                                        : `Uploaded ${dateTimeLabel(
                                            evidence.uploaded_at,
                                          )}`
                                    }
                                  </p>

                                </div>

                              </div>
                            ),
                          )}

                        </div>

                      ) : (

                        <div className="mt-3 rounded-2xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-400">
                          No photo evidence.
                        </div>

                      )}

                    </div>

                  </div>

                </article>
              ),
            )}


            <section className="rounded-[24px] border border-neutral-200 p-5 sm:p-6">

              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Acknowledgement
              </p>

              <h2 className="mt-1 text-xl font-black">
                QA assessment result acknowledgement and signature
              </h2>


              <div className="mt-5 grid gap-3 md:grid-cols-4">

                <Signature
                  title="AUDITOR / ASSESSOR"
                  name={
                    report.signatures.auditor
                  }
                />

                <Signature
                  title="LEADER FOH"
                  name=""
                />

                <Signature
                  title="LEADER BOH"
                  name=""
                />

                <Signature
                  title="MANAGER / ASST. MANAGER"
                  name=""
                />

              </div>

            </section>

          </div>

        </section>

      </div>

    </main>
  );
}


function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">

      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black">
        {value}
      </p>

    </div>
  );
}


function Metric({
  label,
  value,
  bad = false,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        bad
          ? "border-amber-200 bg-amber-50"
          : "border-neutral-200 bg-neutral-50",
      ].join(" ")}
    >

      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-black">
        {value}
      </p>

    </div>
  );
}


function Signature({
  title,
  name,
}: {
  title: string;
  name: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">

      <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black">
        {title}
      </div>

      <div className="flex h-[150px] flex-col justify-end p-4">

        <div className="border-t border-neutral-400 pt-2 text-xs font-black">
          {name}
        </div>

      </div>

    </div>
  );
}
