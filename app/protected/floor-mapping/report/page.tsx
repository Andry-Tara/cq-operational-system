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

import {
  createClient,
} from "@/lib/supabase/server";


const SESSION_ORDER = [
  "MORNING",
  "AFTERNOON",
  "CLOSING",
];


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


function submittedTime(
  value: string | null,
  timezone: string
) {
  if (!value) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    new Date(
      value
    )
  );
}


function staffPinClass(
  roleType: string
) {
  if (
    roleType ===
      "LEADER" ||
    roleType ===
      "MOD"
  ) {
    return "bg-teal-600";
  }


  if (
    roleType ===
      "CASHIER" ||
    roleType ===
      "HOST"
  ) {
    return "bg-orange-500";
  }


  if (
    roleType ===
    "GRO"
  ) {
    return "bg-violet-600";
  }


  if (
    roleType ===
    "TA_HK"
  ) {
    return "bg-pink-600";
  }


  if (
    roleType ===
      "RUNNER" ||
    roleType ===
      "CHECKER"
  ) {
    return "bg-emerald-600";
  }


  return "bg-blue-600";
}


export default async function FloorMappingReportPage() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    redirect(
      "/login"
    );
  }


  const activeOutlet =
    await getActiveOutlet();


  if (!activeOutlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const supabase =
    await createClient();


  if (
    !context.isAdmin
  ) {
    const {
      data:
        hasOutletAccess,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            activeOutlet.id,
        }
      );


    if (
      hasOutletAccess !==
      true
    ) {
      return (
        <StateCard
          title="Outlet Access Required"
          message="You do not have access to this Floor Mapping report."
        />
      );
    }
  }


  const admin =
    createAdminClient();


  const {
    data:
      outlet,
    error:
      outletError,
  } =
    await admin
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name,
        timezone,
        organization_id,
        is_active
      `)
      .eq(
        "id",
        activeOutlet.id
      )
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (
    outletError ||
    !outlet
  ) {
    throw (
      outletError ||
      new Error(
        "Active outlet not found."
      )
    );
  }


  const timezone =
    outlet.timezone ||
    "Asia/Jakarta";


  const today =
    businessDate(
      timezone
    );


  const {
    data:
      sessionsData,
    error:
      sessionsError,
  } =
    await admin
      .from(
        "floor_mapping_sessions"
      )
      .select(`
        id,
        template_id,
        session_type,
        status,
        general_notes,
        pic_name_snapshot,
        submitted_at
      `)
      .eq(
        "outlet_id",
        outlet.id
      )
      .eq(
        "business_date",
        today
      )
      .eq(
        "status",
        "SUBMITTED"
      );


  if (sessionsError) {
    throw sessionsError;
  }


  const sessions =
    (
      sessionsData ??
      []
    )
      .slice()
      .sort(
        (
          a: any,
          b: any
        ) =>
          SESSION_ORDER.indexOf(
            a.session_type
          ) -
          SESSION_ORDER.indexOf(
            b.session_type
          )
      );


  if (
    sessions.length ===
    0
  ) {
    return (
      <StateCard
        title="No Submitted Floor Mapping"
        message="Submit at least one session before opening the daily report."
      />
    );
  }


  const sessionIds =
    sessions.map(
      (
        item: any
      ) =>
        item.id
    );


  const templateIds =
    Array.from(
      new Set(
        sessions.map(
          (
            item: any
          ) =>
            item.template_id
        )
      )
    );


  const [
    templatesResult,
    zonesResult,
    pinsResult,
    bohPositionsResult,
    bohAssignmentsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "floor_mapping_templates"
        )
        .select(`
          id,
          name,
          version_number,
          image_storage_path
        `)
        .in(
          "id",
          templateIds
        ),

      admin
        .from(
          "floor_mapping_zones"
        )
        .select(`
          id,
          template_id,
          zone_code,
          zone_type,
          x_pct,
          y_pct,
          display_label,
          capacity,
          sort_order
        `)
        .in(
          "template_id",
          templateIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "floor_mapping_staff_pins"
        )
        .select(`
          id,
          session_id,
          position_label,
          role_type,
          assigned_names,
          x_pct,
          y_pct,
          notes,
          sort_order
        `)
        .in(
          "session_id",
          sessionIds
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "floor_mapping_boh_positions"
        )
        .select(`
          id,
          template_id,
          position_name,
          position_code,
          default_station,
          sort_order
        `)
        .in(
          "template_id",
          templateIds
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "floor_mapping_boh_assignments"
        )
        .select(`
          id,
          session_id,
          position_id,
          assigned_names,
          station_note,
          sort_order
        `)
        .in(
          "session_id",
          sessionIds
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),
    ]);


  for (
    const result
    of [
      templatesResult,
      zonesResult,
      pinsResult,
      bohPositionsResult,
      bohAssignmentsResult,
    ]
  ) {
    if (result.error) {
      throw result.error;
    }
  }


  const templates =
    templatesResult.data ??
    [];


  const signedEntries =
    await Promise.all(
      templates.map(
        async (
          template: any
        ) => {
          const {
            data,
          } =
            await admin.storage
              .from(
                "operational-photos"
              )
              .createSignedUrl(
                template
                  .image_storage_path,
                3600
              );


          return [
            template.id,
            data
              ?.signedUrl ||
              "",
          ] as const;
        }
      )
    );


  const imageUrlByTemplate =
    new Map(
      signedEntries
    );


  const templateById =
    new Map(
      templates.map(
        (
          item: any
        ) => [
          item.id,
          item,
        ]
      )
    );


  const positionById =
    new Map(
      (
        bohPositionsResult.data ??
        []
      ).map(
        (
          item: any
        ) => [
          item.id,
          item,
        ]
      )
    );


  return (
    <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:py-8">

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
              Daily Outlet Operations
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#292824]">
              Floor Mapping Report
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {outlet.name}
              {" · "}
              {today}
            </p>
          </div>


          <div className="flex flex-wrap gap-2">

            <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
              {
                sessions.length
              }/3 submitted
            </span>

            <Link
              href="/protected/floor-mapping"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-[#292824]"
            >
              Floor Mapping
            </Link>

            <Link
              href="/protected"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-4 text-xs font-black text-white"
            >
              Dashboard
            </Link>

          </div>

        </div>

      </section>


      <div className="mt-4 space-y-4">

        {sessions.map(
          (
            session: any
          ) => {
            const template:
              any =
              templateById.get(
                session.template_id
              );


            const imageUrl =
              imageUrlByTemplate.get(
                session.template_id
              ) ||
              "";


            const zones =
              (
                zonesResult.data ??
                []
              ).filter(
                (
                  item: any
                ) =>
                  item.template_id ===
                  session.template_id
              );


            const pins =
              (
                pinsResult.data ??
                []
              ).filter(
                (
                  item: any
                ) =>
                  item.session_id ===
                  session.id
              );


            const bohAssignments =
              (
                bohAssignmentsResult.data ??
                []
              ).filter(
                (
                  item: any
                ) =>
                  item.session_id ===
                  session.id
              );


            return (
              <section
                key={
                  session.id
                }
                className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm"
              >

                <div className="border-b border-neutral-100 p-5 sm:p-6">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="text-2xl font-black text-[#292824]">
                          {
                            session.session_type
                          }
                        </h2>

                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">
                          SUBMITTED
                        </span>

                      </div>

                      <p className="mt-2 text-xs font-bold text-neutral-500">
                        PIC{" "}
                        {
                          session.pic_name_snapshot
                        }
                        {" · "}
                        {
                          submittedTime(
                            session.submitted_at,
                            timezone
                          )
                        }
                      </p>
                    </div>


                    <div className="flex gap-2">

                      <div className="rounded-2xl bg-[#F6F4F1] px-4 py-3 text-center">
                        <p className="text-lg font-black text-[#292824]">
                          {
                            pins.length
                          }
                        </p>

                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
                          FOH
                        </p>
                      </div>


                      <div className="rounded-2xl bg-[#F6F4F1] px-4 py-3 text-center">
                        <p className="text-lg font-black text-[#292824]">
                          {
                            bohAssignments.length
                          }
                        </p>

                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
                          BOH
                        </p>
                      </div>

                    </div>

                  </div>

                </div>


                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">

                  <div className="p-4 sm:p-6">

                    <div className="mb-3">

                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                        FOH Floor Map
                      </p>

                      <p className="mt-1 text-sm font-black text-[#292824]">
                        {
                          template?.name ||
                          "Floor Plan"
                        }
                        {
                          template?.version_number
                            ? ` · v${template.version_number}`
                            : ""
                        }
                      </p>

                    </div>


                    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">

                      {imageUrl ? (
                        <img
                          src={
                            imageUrl
                          }
                          alt={`${outlet.name} floor plan`}
                          className="block h-auto w-full"
                        />
                      ) : (
                        <div className="flex min-h-[320px] items-center justify-center text-sm font-bold text-neutral-400">
                          Floor plan image unavailable.
                        </div>
                      )}


                      {zones.map(
                        (
                          zone: any
                        ) => {
                          const vip =
                            zone.zone_type ===
                            "VIP";


                          return (
                            <div
                              key={
                                zone.id
                              }
                              style={{
                                left:
                                  `${Number(
                                    zone.x_pct
                                  )}%`,

                                top:
                                  `${Number(
                                    zone.y_pct
                                  )}%`,
                              }}
                              className={[
                                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-2 border-white px-2 py-1 text-[8px] font-black text-white shadow-md sm:text-[10px]",
                                vip
                                  ? "rounded-lg bg-sky-500"
                                  : "rounded-full bg-emerald-600",
                              ].join(
                                " "
                              )}
                            >
                              {
                                zone.display_label ||
                                zone.zone_code
                              }
                            </div>
                          );
                        }
                      )}


                      {pins.map(
                        (
                          pin: any
                        ) => (
                          <div
                            key={
                              pin.id
                            }
                            style={{
                              left:
                                `${Number(
                                  pin.x_pct
                                )}%`,

                              top:
                                `${Number(
                                  pin.y_pct
                                )}%`,
                            }}
                            className={[
                              "absolute z-20 min-w-[82px] max-w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white px-2.5 py-1.5 text-center text-white shadow-lg",
                              staffPinClass(
                                pin.role_type
                              ),
                            ].join(
                              " "
                            )}
                          >

                            <span className="block truncate text-[8px] font-black uppercase tracking-[0.04em] opacity-85">
                              {
                                pin.position_label
                              }
                            </span>

                            <span className="mt-0.5 block truncate text-[10px] font-black sm:text-[11px]">
                              {
                                Array.isArray(
                                  pin.assigned_names
                                )
                                  ? pin.assigned_names.join(
                                      " & "
                                    )
                                  : ""
                              }
                            </span>

                            {pin.notes && (
                              <span className="mt-1 block truncate border-t border-white/25 pt-1 text-[7px] font-bold normal-case opacity-90 sm:text-[8px]">
                                {
                                  pin.notes
                                }
                              </span>
                            )}

                          </div>
                        )
                      )}

                    </div>

                  </div>


                  <aside className="border-t border-neutral-100 p-5 xl:border-l xl:border-t-0">

                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                      FOH Assignments
                    </p>


                    <div className="mt-3 space-y-2">

                      {pins.map(
                        (
                          pin: any
                        ) => (
                          <div
                            key={
                              pin.id
                            }
                            className="rounded-xl border border-neutral-200 p-3"
                          >

                            <p className="text-xs font-black text-[#292824]">
                              {
                                pin.position_label
                              }
                              {" · "}
                              {
                                Array.isArray(
                                  pin.assigned_names
                                )
                                  ? pin.assigned_names.join(
                                      " & "
                                    )
                                  : ""
                              }
                            </p>

                            <p className="mt-1 text-[10px] font-bold text-neutral-400">
                              Category · {
                                pin.role_type
                              }
                              {" · "}
                              {Number(
                                pin.x_pct
                              ).toFixed(
                                1
                              )}
                              %
                              {" / "}
                              {Number(
                                pin.y_pct
                              ).toFixed(
                                1
                              )}
                              %
                            </p>

                            {pin.notes && (
                              <p className="mt-2 text-xs leading-5 text-neutral-500">
                                {
                                  pin.notes
                                }
                              </p>
                            )}

                          </div>
                        )
                      )}


                      {pins.length ===
                        0 && (
                        <p className="rounded-xl bg-neutral-50 p-4 text-xs font-bold text-neutral-400">
                          No FOH assignments.
                        </p>
                      )}

                    </div>

                  </aside>

                </div>


                <div className="border-t border-neutral-100 p-5 sm:p-6">

                  <div className="flex items-center justify-between gap-3">

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                        BOH / Kitchen
                      </p>

                      <h3 className="mt-1 text-lg font-black text-[#292824]">
                        Kitchen Assignment
                      </h3>
                    </div>


                    <span className="rounded-full bg-[#F6F4F1] px-3 py-2 text-[10px] font-black text-neutral-600">
                      {
                        bohAssignments.length
                      } assigned
                    </span>

                  </div>


                  <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">

                    {bohAssignments.map(
                      (
                        assignment: any
                      ) => {
                        const position:
                          any =
                          positionById.get(
                            assignment.position_id
                          );


                        return (
                          <div
                            key={
                              assignment.id
                            }
                            className="grid gap-1 border-b border-neutral-100 px-4 py-3 last:border-0 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
                          >

                            <p className="text-xs font-black text-[#292824]">
                              {
                                position?.position_name ||
                                "Kitchen Position"
                              }
                            </p>


                            <p className="text-xs font-bold text-neutral-700">
                              {
                                Array.isArray(
                                  assignment.assigned_names
                                )
                                  ? assignment.assigned_names.join(
                                      " & "
                                    )
                                  : "—"
                              }
                            </p>


                            <p className="text-xs font-bold text-neutral-500">
                              {
                                assignment.station_note ||
                                position?.default_station ||
                                "—"
                              }
                            </p>

                          </div>
                        );
                      }
                    )}


                    {bohAssignments.length ===
                      0 && (
                      <p className="p-5 text-xs font-bold text-neutral-400">
                        No BOH assignments.
                      </p>
                    )}

                  </div>


                  {session.general_notes && (
                    <div className="mt-4 rounded-2xl bg-[#F6F4F1] p-4">

                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-neutral-400">
                        General Notes
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#292824]">
                        {
                          session.general_notes
                        }
                      </p>

                    </div>
                  )}

                </div>

              </section>
            );
          }
        )}

      </div>

    </main>
  );
}


function StateCard({
  title,
  message,
}: {
  title:
    string;

  message:
    string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5">

      <div className="w-full rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Floor Mapping Report
        </p>

        <h1 className="mt-3 text-2xl font-black text-[#292824]">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          {message}
        </p>

        <Link
          href="/protected/floor-mapping"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-5 text-xs font-black text-white"
        >
          Back to Floor Mapping
        </Link>

      </div>

    </main>
  );
}
