import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";


import RetestPanel from "./retest-panel";


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


function shiftLabel(
  value: string
) {
  return value ===
    "PAGI"
    ? "MORNING"
    : value ===
        "SORE"
      ? "AFTERNOON"
      : value;
}


function formatDate(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] =
    value.split("-");

  return [
    day,
    month,
    year,
  ].join("/");
}


function statusClass(
  value: string
) {
  return value ===
    "PASS"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-800 border-amber-200";
}


export default async function TestFoodReportPage() {
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


  const outlet =
    await getActiveOutlet();


  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const admin =
    createAdminClient();


  const [
    outletResult,
    assignmentResult,
  ] =
    await Promise.all([
      admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name,
          timezone,
          is_active
        `)
        .eq(
          "id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),

      admin
        .from(
          "user_outlets"
        )
        .select(`
          outlet_id
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),
    ]);


  const outletRow =
    outletResult.data;


  if (
    !outletRow ||
    !assignmentResult.data ||
    String(
      outletRow.code
    ).toUpperCase() ===
      "CNT"
  ) {
    redirect(
      "/protected"
    );
  }


  const date =
    businessDate(
      outletRow.timezone ||
      "Asia/Jakarta"
    );


  const {
    data:
      sessions,
    error:
      sessionsError,
  } =
    await admin
      .from(
        "test_food_sessions"
      )
      .select(`
        id,
        business_date,
        shift,
        result_status,
        pic_name_snapshot,
        submitted_at
      `)
      .eq(
        "outlet_id",
        outletRow.id
      )
      .eq(
        "business_date",
        date
      )
      .eq(
        "status",
        "SUBMITTED"
      );


  if (
    sessionsError
  ) {
    throw sessionsError;
  }


  const orderedSessions =
    [...(
      sessions ??
      []
    )].sort(
      (
        a: any,
        b: any
      ) =>
        (
          a.shift ===
          "PAGI"
            ? 0
            : 1
        ) -
        (
          b.shift ===
          "PAGI"
            ? 0
            : 1
        )
    );


  const sessionIds =
    orderedSessions.map(
      (
        item: any
      ) =>
        item.id
    );


  let checks:
    any[] =
    [];


  if (
    sessionIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "test_food_checks"
        )
        .select(`
          id,
          session_id,
          menu_id,
          expiry_date,
          color_status,
          taste_status,
          texture_status,
          notes,
          result_status
        `)
        .in(
          "session_id",
          sessionIds
        );


    if (error) {
      throw error;
    }


    checks =
      data ??
      [];
  }


  const issueCheckIds =
    checks
      .filter(
        (
          row: any
        ) =>
          row.result_status ===
          "NEEDS_CORRECTION"
      )
      .map(
        (
          row: any
        ) =>
          row.id
      );


  let retests:
    any[] =
    [];


  if (
    issueCheckIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "test_food_retests"
        )
        .select(`
          id,
          check_id,
          attempt_no,
          correction_note,
          color_status,
          taste_status,
          texture_status,
          notes,
          result_status,
          tested_at
        `)
        .in(
          "check_id",
          issueCheckIds
        )
        .order(
          "attempt_no",
          {
            ascending:
              true,
          }
        );


    if (error) {
      throw error;
    }


    retests =
      data ??
      [];
  }


  const menuIds =
    [
      ...new Set(
        checks
          .map(
            (
              row: any
            ) =>
              row.menu_id
          )
          .filter(
            Boolean
          )
      ),
    ];


  let menus:
    any[] =
    [];


  if (
    menuIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "test_food_menus"
        )
        .select(`
          id,
          name,
          sort_order
        `)
        .in(
          "id",
          menuIds
        );


    if (error) {
      throw error;
    }


    menus =
      data ??
      [];
  }


  const menuById =
    new Map(
      menus.map(
        (
          menu: any
        ) => [
          menu.id,
          menu,
        ]
      )
    );


  const latestRetestByCheck =
    new Map<
      string,
      any
    >();


  for (
    const retest of
    retests
  ) {
    const current =
      latestRetestByCheck.get(
        retest.check_id
      );

    if (
      !current ||
      Number(
        retest.attempt_no
      ) >
      Number(
        current.attempt_no
      )
    ) {
      latestRetestByCheck.set(
        retest.check_id,
        retest
      );
    }
  }


  const unresolvedCheckIds =
    new Set(
      checks
        .filter(
          (
            check: any
          ) => {
            if (
              check.result_status !==
              "NEEDS_CORRECTION"
            ) {
              return false;
            }

            return (
              latestRetestByCheck.get(
                check.id
              )?.result_status !==
              "PASS"
            );
          }
        )
        .map(
          (
            check: any
          ) =>
            check.id
        )
    );


  const checksBySession =
    new Map<
      string,
      any[]
    >();


  for (
    const check of
    checks
  ) {
    const current =
      checksBySession.get(
        check.session_id
      ) ??
      [];

    current.push(
      check
    );

    checksBySession.set(
      check.session_id,
      current
    );
  }


  const completedShifts =
    new Set(
      orderedSessions.map(
        (
          item: any
        ) =>
          item.shift
      )
    ).size;


  const dailyNeedsCorrection =
    unresolvedCheckIds.size >
    0;


  const dailyResult =
    completedShifts <
      2
      ? "IN PROGRESS"
      : dailyNeedsCorrection
        ? "NEEDS CORRECTION"
        : "PASS";


  const totalChecks =
    checks.length;


  const totalIssues =
    unresolvedCheckIds.size;


  return (
    <main className="min-h-screen bg-[#F6F4F1] px-4 py-7 sm:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">

        <section className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
            Food Quality
          </p>

          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#292824]">
                Test Food Report
              </h1>

              <p className="mt-2 text-sm text-neutral-500">
                {outletRow.name}
                {" · "}
                {formatDate(
                  date
                )}
              </p>
            </div>


            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-neutral-200 bg-[#F6F4F1] px-4 py-2 text-xs font-black text-neutral-600">
                {completedShifts}/2 Shifts
              </span>

              <span
                className={[
                  "rounded-full border px-4 py-2 text-xs font-black",
                  dailyResult ===
                  "PASS"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : dailyResult ===
                      "IN PROGRESS"
                      ? "border-neutral-200 bg-neutral-50 text-neutral-600"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                ].join(
                  " "
                )}
              >
                {dailyResult}
              </span>
            </div>

          </div>


          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Summary
              label="Shifts"
              value={`${completedShifts}/2`}
            />

            <Summary
              label="Menus Checked"
              value={
                String(
                  totalChecks
                )
              }
            />

            <Summary
              label="Needs Correction"
              value={
                String(
                  totalIssues
                )
              }
            />
          </div>
        </section>


        <div className="mt-5 space-y-5">

          {orderedSessions.length ===
          0 ? (
            <section className="rounded-[28px] border border-neutral-200 bg-white p-7 text-center shadow-sm">
              <p className="text-sm font-bold text-neutral-500">
                No Test Food submission for today.
              </p>
            </section>
          ) : (
            orderedSessions.map(
              (
                session: any
              ) => {
                const sessionChecks =
                  (
                    checksBySession.get(
                      session.id
                    ) ??
                    []
                  )
                    .sort(
                      (
                        a: any,
                        b: any
                      ) =>
                        (
                          menuById.get(
                            a.menu_id
                          )
                            ?.sort_order ??
                          999
                        ) -
                        (
                          menuById.get(
                            b.menu_id
                          )
                            ?.sort_order ??
                          999
                        )
                    );

                const issueCount =
                  sessionChecks.filter(
                    (
                      item: any
                    ) =>
                      unresolvedCheckIds.has(
                        item.id
                      )
                  ).length;

                return (
                  <section
                    key={
                      session.id
                    }
                    className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                          {shiftLabel(
                            session.shift
                          )}
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[#292824]">
                          {
                            sessionChecks.length
                          }{" "}
                          menus checked
                        </h2>

                        <p className="mt-1 text-xs text-neutral-500">
                          PIC{" "}
                          {
                            session.pic_name_snapshot
                          }
                        </p>
                      </div>


                      <div className="flex items-center gap-2">
                        {issueCount >
                          0 && (
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-800">
                            {
                              issueCount
                            }{" "}
                            issue
                          </span>
                        )}

                        <span
                          className={[
                            "rounded-full border px-3 py-1.5 text-[10px] font-black",
                            statusClass(
                              session.result_status
                            ),
                          ].join(
                            " "
                          )}
                        >
                          {
                            session.result_status ===
                            "NEEDS_CORRECTION"
                              ? "NEEDS CORRECTION"
                              : "PASS"
                          }
                        </span>
                      </div>

                    </div>


                    <div className="divide-y divide-neutral-100">

                      {sessionChecks.map(
                        (
                          check: any
                        ) => {
                          const menu =
                            menuById.get(
                              check.menu_id
                            );

                          const initialIssue =
                            check.result_status ===
                            "NEEDS_CORRECTION";

                          const latestRetest =
                            latestRetestByCheck.get(
                              check.id
                            );

                          const issue =
                            unresolvedCheckIds.has(
                              check.id
                            );

                          const corrected =
                            initialIssue &&
                            latestRetest
                              ?.result_status ===
                              "PASS";

                          return (
                            <article
                              key={
                                check.id
                              }
                              className={[
                                "p-5 sm:p-6",
                                issue
                                  ? "bg-amber-50/35"
                                  : "bg-white",
                              ].join(
                                " "
                              )}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                                <div>
                                  <h3 className="font-black text-[#292824]">
                                    {
                                      menu?.name ||
                                      "Test Food Menu"
                                    }
                                  </h3>

                                  <p className="mt-1 text-xs text-neutral-500">
                                    Expiry{" "}
                                    {
                                      formatDate(
                                        check.expiry_date
                                      )
                                    }
                                  </p>
                                </div>

                                <span
                                  className={[
                                    "w-fit rounded-full px-3 py-1.5 text-[9px] font-black",
                                    issue
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-50 text-emerald-700",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {issue
                                    ? "NEEDS CORRECTION"
                                    : corrected
                                      ? "CORRECTED"
                                      : "PASS"}
                                </span>

                              </div>


                              <div className="mt-4 grid grid-cols-3 gap-2">

                                <Quality
                                  label="Warna"
                                  value={
                                    check.color_status
                                  }
                                />

                                <Quality
                                  label="Rasa"
                                  value={
                                    check.taste_status
                                  }
                                />

                                <Quality
                                  label="Tekstur"
                                  value={
                                    check.texture_status
                                  }
                                />

                              </div>


                              {check.notes && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
                                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                                    Notes
                                  </p>

                                  <p className="mt-1 text-sm font-medium leading-6 text-neutral-700">
                                    {
                                      check.notes
                                    }
                                  </p>
                                </div>
                              )}


                              {latestRetest && (
                                <div className={[
                                  "mt-4 rounded-2xl border p-4",
                                  latestRetest.result_status ===
                                  "PASS"
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : "border-amber-200 bg-amber-50/40",
                                ].join(
                                  " "
                                )}>
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                                    <div>
                                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                                        Latest Re-Test · Attempt {
                                          latestRetest.attempt_no
                                        }
                                      </p>

                                      <p className="mt-1 text-sm font-bold text-neutral-700">
                                        {
                                          latestRetest.correction_note
                                        }
                                      </p>
                                    </div>

                                    <span className={[
                                      "w-fit rounded-full px-3 py-1.5 text-[9px] font-black",
                                      latestRetest.result_status ===
                                      "PASS"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-800",
                                    ].join(
                                      " "
                                    )}>
                                      {
                                        latestRetest.result_status ===
                                        "PASS"
                                          ? "PASS"
                                          : "STILL NEEDS CORRECTION"
                                      }
                                    </span>

                                  </div>


                                  <div className="mt-3 grid grid-cols-3 gap-2">

                                    <Quality
                                      label="Warna"
                                      value={
                                        latestRetest.color_status
                                      }
                                    />

                                    <Quality
                                      label="Rasa"
                                      value={
                                        latestRetest.taste_status
                                      }
                                    />

                                    <Quality
                                      label="Tekstur"
                                      value={
                                        latestRetest.texture_status
                                      }
                                    />

                                  </div>


                                  {latestRetest.notes && (
                                    <p className="mt-3 text-sm font-medium leading-6 text-neutral-600">
                                      Notes: {
                                        latestRetest.notes
                                      }
                                    </p>
                                  )}

                                </div>
                              )}


                              {issue && (
                                <RetestPanel
                                  checkId={
                                    check.id
                                  }
                                  menuName={
                                    menu?.name ||
                                    "Test Food Menu"
                                  }
                                />
                              )}

                            </article>
                          );
                        }
                      )}

                    </div>
                  </section>
                );
              }
            )
          )}

        </div>


        <div className="mt-6 flex gap-2">
          <a
            href="/protected/test-food"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-black text-[#292824]"
          >
            Test Food
          </a>

          <a
            href="/protected"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#292824] px-5 text-sm font-black text-white"
          >
            Dashboard
          </a>
        </div>

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
    <div className="rounded-2xl border border-neutral-200 bg-[#F6F4F1]/70 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black text-[#292824]">
        {value}
      </p>
    </div>
  );
}


function Quality({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const ok =
    value ===
    "STANDARD";

  return (
    <div className={[
      "rounded-xl border p-3",
      ok
        ? "border-neutral-200 bg-white"
        : "border-red-200 bg-red-50",
    ].join(
      " "
    )}>
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>

      <p className={[
        "mt-1 text-[11px] font-black",
        ok
          ? "text-neutral-700"
          : "text-red-700",
      ].join(
        " "
      )}>
        {ok
          ? "Standard"
          : "Not Standard"}
      </p>
    </div>
  );
}
