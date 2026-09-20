"use client";

import Link from "next/link";

import {
  useMemo,
  useRef,
  useState,
} from "react";


type SessionType =
  | "MORNING"
  | "AFTERNOON"
  | "CLOSING";


type FohStaffOption = {
  staffId:
    string;

  fullName:
    string;

  positionId:
    string;

  positionName:
    string;

  category:
    string;

  area:
    string;
};


type BohStaffOption =
  FohStaffOption;


type StaffPin = {
  id:
    string;

  positionLabel:
    string;

  roleType:
    string;

  assignedNames:
    string[];

  xPct:
    number;

  yPct:
    number;

  notes:
    string;
};


type BohDraft = {
  assignedNamesText:
    string;

  stationNote:
    string;
};


type SessionDraft = {
  id:
    string |
    null;

  status:
    string |
    null;

  submittedAt:
    string |
    null;

  generalNotes:
    string;

  staffPins:
    StaffPin[];

  bohByPosition:
    Record<
      string,
      BohDraft
    >;
};


const SESSIONS:
  SessionType[] = [
    "MORNING",
    "AFTERNOON",
    "CLOSING",
  ];


function splitNames(
  value: string
) {
  return value
    .split(
      /\s*&\s*|,\s*/
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function pinClass(
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


export default function FloorMappingClient({
  outlet,
  businessDate,
  picName,
  template,
  zones,
  bohPositions,
  fohStaff,
  bohStaff,
  initialSessions,
}: {
  outlet:
    any;

  businessDate:
    string;

  picName:
    string;

  template:
    any;

  zones:
    any[];

  bohPositions:
    any[];

  fohStaff:
    FohStaffOption[];

  bohStaff:
    BohStaffOption[];

  initialSessions:
    Record<
      string,
      any
    >;
}) {
  function buildDraft(
    sessionType:
      SessionType
  ): SessionDraft {
    const existing =
      initialSessions[
        sessionType
      ] ||
      {};


    const existingBoh =
      new Map(
        (
          existing
            .bohAssignments ||
          []
        ).map(
          (
            item: any
          ) => [
            item.position_id,
            item,
          ]
        )
      );


    const bohByPosition:
      Record<
        string,
        BohDraft
      > =
      {};


    for (
      const position
      of bohPositions
    ) {
      const row:
        any =
        existingBoh.get(
          position.id
        );


      bohByPosition[
        position.id
      ] = {
        assignedNamesText:
          Array.isArray(
            row
              ?.assigned_names
          )
            ? row.assigned_names.join(
                " & "
              )
            : "",

        stationNote:
          row
            ?.station_note ||
          position
            .default_station ||
          "",
      };
    }


    return {
      id:
        existing.id ||
        null,

      status:
        existing.status ||
        null,

      submittedAt:
        existing
          .submittedAt ||
        null,

      generalNotes:
        existing
          .generalNotes ||
        "",

      staffPins:
        (
          existing
            .staffPins ||
          []
        ).map(
          (
            item: any
          ) => ({
            id:
              item.id,

            positionLabel:
              item.position_label,

            roleType:
              item.role_type,

            assignedNames:
              Array.isArray(
                item.assigned_names
              )
                ? item.assigned_names
                : [],

            xPct:
              Number(
                item.x_pct
              ),

            yPct:
              Number(
                item.y_pct
              ),

            notes:
              item.notes ||
              "",
          })
        ),

      bohByPosition,
    };
  }


  const [
    drafts,
    setDrafts,
  ] =
    useState<
      Record<
        SessionType,
        SessionDraft
      >
    >(
      () => ({
        MORNING:
          buildDraft(
            "MORNING"
          ),

        AFTERNOON:
          buildDraft(
            "AFTERNOON"
          ),

        CLOSING:
          buildDraft(
            "CLOSING"
          ),
      })
    );


  const [
    sessionType,
    setSessionType,
  ] =
    useState<
      SessionType
    >(
      () =>
        SESSIONS.find(
          (
            item
          ) =>
            initialSessions[
              item
            ]?.status !==
            "SUBMITTED"
        ) ||
        "CLOSING"
    );


  const mapRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null
    );


  const [
    selectedStaffId,
    setSelectedStaffId,
  ] =
    useState(
      ""
    );


  const [
    staffNotes,
    setStaffNotes,
  ] =
    useState(
      ""
    );


  const [
    placing,
    setPlacing,
  ] =
    useState(
      false
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const current =
    drafts[
      sessionType
    ];


  const locked =
    current.status ===
    "SUBMITTED";


  const selectedStaff =
    fohStaff.find(
      (
        item
      ) =>
        item.staffId ===
        selectedStaffId
    ) ||
    null;


  const assignedStaffNames =
    new Set(
      [
        ...current
          .staffPins
          .flatMap(
            (
              pin
            ) =>
              pin.assignedNames
          ),

        ...Object.values(
          current
            .bohByPosition
        ).flatMap(
          (
            row
          ) =>
            splitNames(
              row
                ?.assignedNamesText ||
              ""
            )
        ),
      ]
        .map(
          (
            name
          ) =>
            name
              .trim()
              .toLowerCase()
        )
        .filter(
          Boolean
        )
    );


  const completedCount =
    SESSIONS.filter(
      (
        item
      ) =>
        drafts[
          item
        ].status ===
        "SUBMITTED"
    ).length;


  const bohAssignedCount =
    useMemo(
      () =>
        bohPositions.filter(
          (
            position
          ) =>
            splitNames(
              current
                .bohByPosition[
                  position.id
                ]
                ?.assignedNamesText ||
              ""
            ).length >
            0
        ).length,
      [
        bohPositions,
        current,
      ]
    );


  function updateCurrent(
    updater:
      (
        draft:
          SessionDraft
      ) =>
        SessionDraft
  ) {
    setDrafts(
      (
        previous
      ) => ({
        ...previous,

        [sessionType]:
          updater(
            previous[
              sessionType
            ]
          ),
      })
    );
  }


  function placeStaff(
    event:
      React.MouseEvent<
        HTMLDivElement
      >
  ) {
    if (
      locked ||
      !placing
    ) {
      return;
    }


    if (
      !selectedStaff
    ) {
      setError(
        "Select a staff member first."
      );

      return;
    }


    const alreadyAssigned =
      current
        .staffPins
        .some(
          (
            pin
          ) =>
            pin.assignedNames
              .some(
                (
                  name
                ) =>
                  name
                    .trim()
                    .toLowerCase() ===
                  selectedStaff
                    .fullName
                    .trim()
                    .toLowerCase()
              )
        );


    if (
      alreadyAssigned
    ) {
      setError(
        `${selectedStaff.fullName} is already placed on this session. Drag the existing staff chip to move the position.`
      );

      setPlacing(
        false
      );

      return;
    }


    const rect =
      event.currentTarget
        .getBoundingClientRect();


    const x =
      (
        (
          event.clientX -
          rect.left
        ) /
        rect.width
      ) *
      100;


    const y =
      (
        (
          event.clientY -
          rect.top
        ) /
        rect.height
      ) *
      100;


    const pin:
      StaffPin = {
        id:
          `temp-${
            crypto.randomUUID()
          }`,

        positionLabel:
          selectedStaff
            .positionName,

        roleType:
          selectedStaff
            .category,

        assignedNames: [
          selectedStaff
            .fullName,
        ],

        xPct:
          Number(
            x.toFixed(
              3
            )
          ),

        yPct:
          Number(
            y.toFixed(
              3
            )
          ),

        notes:
          staffNotes
            .trim(),
      };


    updateCurrent(
      (
        draft
      ) => ({
        ...draft,

        staffPins: [
          ...draft.staffPins,
          pin,
        ],
      })
    );


    setSelectedStaffId(
      ""
    );

    setStaffNotes(
      ""
    );

    setPlacing(
      false
    );

    setError(
      null
    );
  }


  function movePinToPoint(
    pinId: string,
    clientX: number,
    clientY: number
  ) {
    if (
      locked ||
      placing
    ) {
      return;
    }


    const element =
      mapRef.current;


    if (!element) {
      return;
    }


    const rect =
      element
        .getBoundingClientRect();


    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }


    const x =
      Math.max(
        0,
        Math.min(
          100,
          (
            (
              clientX -
              rect.left
            ) /
            rect.width
          ) *
            100
        )
      );


    const y =
      Math.max(
        0,
        Math.min(
          100,
          (
            (
              clientY -
              rect.top
            ) /
            rect.height
          ) *
            100
        )
      );


    updateCurrent(
      (
        draft
      ) => ({
        ...draft,

        staffPins:
          draft.staffPins.map(
            (
              item
            ) =>
              item.id ===
              pinId
                ? {
                    ...item,

                    xPct:
                      Number(
                        x.toFixed(
                          3
                        )
                      ),

                    yPct:
                      Number(
                        y.toFixed(
                          3
                        )
                      ),
                  }
                : item
          ),
      })
    );
  }


  function startPinDrag(
    event:
      React.PointerEvent<
        HTMLButtonElement
      >,
    pinId: string
  ) {
    if (
      locked ||
      placing
    ) {
      return;
    }


    event.preventDefault();
    event.stopPropagation();


    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );


    movePinToPoint(
      pinId,
      event.clientX,
      event.clientY
    );
  }


  function movePinDrag(
    event:
      React.PointerEvent<
        HTMLButtonElement
      >,
    pinId: string
  ) {
    if (
      locked ||
      placing ||
      !event.currentTarget
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      return;
    }


    event.preventDefault();
    event.stopPropagation();


    movePinToPoint(
      pinId,
      event.clientX,
      event.clientY
    );
  }


  function endPinDrag(
    event:
      React.PointerEvent<
        HTMLButtonElement
      >,
    pinId: string
  ) {
    if (
      locked ||
      placing
    ) {
      return;
    }


    event.preventDefault();
    event.stopPropagation();


    movePinToPoint(
      pinId,
      event.clientX,
      event.clientY
    );


    if (
      event.currentTarget
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    }
  }


  function removePin(
    id: string
  ) {
    if (locked) {
      return;
    }


    updateCurrent(
      (
        draft
      ) => ({
        ...draft,

        staffPins:
          draft.staffPins.filter(
            (
              item
            ) =>
              item.id !==
              id
          ),
      })
    );
  }


  function updateBoh(
    positionId:
      string,
    patch:
      Partial<
        BohDraft
      >
  ) {
    if (locked) {
      return;
    }


    updateCurrent(
      (
        draft
      ) => ({
        ...draft,

        bohByPosition: {
          ...draft
            .bohByPosition,

          [positionId]: {
            ...draft
              .bohByPosition[
                positionId
              ],

            ...patch,
          },
        },
      })
    );
  }


  async function save(
    action:
      "SAVE_DRAFT" |
      "SUBMIT"
  ) {
    if (
      locked ||
      saving
    ) {
      return;
    }


    setSaving(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );


    try {
      const bohAssignments =
        bohPositions
          .map(
            (
              position
            ) => {
              const row =
                current
                  .bohByPosition[
                    position.id
                  ];


              return {
                positionId:
                  position.id,

                assignedNames:
                  splitNames(
                    row
                      ?.assignedNamesText ||
                    ""
                  ),

                stationNote:
                  row
                    ?.stationNote ||
                  "",
              };
            }
          )
          .filter(
            (
              item
            ) =>
              item
                .assignedNames
                .length >
              0
          );


      if (
        action ===
          "SUBMIT" &&
        current
          .staffPins
          .length ===
          0
      ) {
        throw new Error(
          "Add at least one FOH staff assignment before submit."
        );
      }


      if (
        action ===
          "SUBMIT" &&
        bohAssignments.length ===
          0
      ) {
        throw new Error(
          "Add at least one BOH assignment before submit."
        );
      }


      const response =
        await fetch(
          "/api/floor-mapping/save",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                sessionType,

                action,

                generalNotes:
                  current
                    .generalNotes,

                staffPins:
                  current
                    .staffPins
                    .map(
                      (
                        item
                      ) => ({
                        positionLabel:
                          item
                            .positionLabel,

                        roleType:
                          item
                            .roleType,

                        assignedNames:
                          item
                            .assignedNames,

                        xPct:
                          item
                            .xPct,

                        yPct:
                          item
                            .yPct,

                        notes:
                          item
                            .notes,
                      })
                    ),

                bohAssignments,
              }),
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to save Floor Mapping."
        );
      }


      const newStatus =
        payload.session
          .status;


      setDrafts(
        (
          previous
        ) => {
          const next = {
            ...previous,

            [sessionType]: {
              ...previous[
                sessionType
              ],

              id:
                payload.session
                  .id,

              status:
                newStatus,

              submittedAt:
                payload.session
                  .submittedAt,
            },
          };


          return next;
        }
      );


      setMessage(
        action ===
          "SUBMIT"
          ? `${sessionType} Floor Mapping submitted.`
          : `${sessionType} draft saved.`
      );


      if (
        action ===
        "SUBMIT"
      ) {
        const currentIndex =
          SESSIONS.indexOf(
            sessionType
          );


        const remaining =
          SESSIONS.find(
            (
              item,
              index
            ) =>
              index >
                currentIndex &&
              drafts[
                item
              ].status !==
                "SUBMITTED"
          ) ||
          SESSIONS.find(
            (
              item
            ) =>
              item !==
                sessionType &&
              drafts[
                item
              ].status !==
                "SUBMITTED"
          );


        if (remaining) {
          setSessionType(
            remaining
          );
        }
      }

    } catch (
      saveError: any
    ) {
      setError(
        saveError
          ?.message ||
        "Unable to save Floor Mapping."
      );

    } finally {
      setSaving(
        false
      );
    }
  }


  return (
    <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:py-8">

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
              Daily Outlet Operations
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#292824]">
              Floor Mapping
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              {outlet.name}
              {" · "}
              {businessDate}
              {" · "}
              {picName}
            </p>
          </div>


          <div className="flex flex-wrap items-center gap-2">

            <span className="w-fit rounded-full bg-[#F6F4F1] px-4 py-2 text-xs font-black text-[#292824]">
              {completedCount}/3 completed
            </span>


            {completedCount > 0 && (
              <Link
                href="/protected/floor-mapping/report"
                className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-[10px] font-black text-[#292824]"
              >
                View Report
              </Link>
            )}

          </div>

        </div>


        <div className="mt-5 grid grid-cols-3 gap-2">

          {SESSIONS.map(
            (
              item
            ) => {
              const submitted =
                drafts[
                  item
                ].status ===
                "SUBMITTED";


              const active =
                item ===
                sessionType;


              return (
                <button
                  key={
                    item
                  }
                  type="button"
                  onClick={() => {
                    setSessionType(
                      item
                    );

                    setPlacing(
                      false
                    );

                    setSelectedStaffId(
                      ""
                    );

                    setStaffNotes(
                      ""
                    );

                    setError(
                      null
                    );

                    setMessage(
                      null
                    );
                  }}
                  className={[
                    "min-h-11 rounded-2xl border px-2 text-[10px] font-black sm:text-xs",
                    active
                      ? "border-[#292824] bg-[#292824] text-white"
                      : "border-neutral-200 bg-white text-neutral-600",
                  ].join(
                    " "
                  )}
                >
                  {item}
                  {submitted
                    ? " ✓"
                    : ""}
                </button>
              );
            }
          )}

        </div>

      </section>


      {message && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}


      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}


      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">

        <section className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">

          <div className="flex items-start justify-between gap-3">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                FOH Floor Map
              </p>

              <h2 className="mt-1 text-xl font-black text-[#292824]">
                {template.name}
              </h2>

              <p className="mt-1 text-xs text-neutral-500">
                Tables and VIP zones are static. Staff positions are daily assignments.
                {!locked &&
                  " Drag a staff chip anytime to reposition it."}
              </p>
            </div>


            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">
              {
                current
                  .staffPins
                  .length
              } FOH
            </span>

          </div>


          <div
            ref={
              mapRef
            }
            onClick={
              placeStaff
            }
            className={[
              "relative mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100",
              placing &&
              !locked
                ? "cursor-crosshair ring-2 ring-[#D8D355]"
                : "",
            ].join(
              " "
            )}
          >

            <img
              src={
                template.imageUrl
              }
              alt="Outlet floor plan"
              draggable={
                false
              }
              className="block h-auto w-full select-none"
            />


            {zones.map(
              (
                zone
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


            {current
              .staffPins
              .map(
                (
                  pin
                ) => (
                  <button
                    key={
                      pin.id
                    }
                    type="button"
                    title={
                      locked
                        ? `${pin.positionLabel} · ${pin.assignedNames.join(
                            " & "
                          )}`
                        : `Drag to move · ${pin.positionLabel} · ${pin.assignedNames.join(
                            " & "
                          )}`
                    }
                    onClick={
                      (
                        event
                      ) => {
                        event.stopPropagation();
                      }
                    }
                    onPointerDown={
                      (
                        event
                      ) =>
                        startPinDrag(
                          event,
                          pin.id
                        )
                    }
                    onPointerMove={
                      (
                        event
                      ) =>
                        movePinDrag(
                          event,
                          pin.id
                        )
                    }
                    onPointerUp={
                      (
                        event
                      ) =>
                        endPinDrag(
                          event,
                          pin.id
                        )
                    }
                    onPointerCancel={
                      (
                        event
                      ) => {
                        event.stopPropagation();

                        if (
                          event.currentTarget
                            .hasPointerCapture(
                              event.pointerId
                            )
                        ) {
                          event.currentTarget
                            .releasePointerCapture(
                              event.pointerId
                            );
                        }
                      }
                    }
                    style={{
                      left:
                        `${pin.xPct}%`,

                      top:
                        `${pin.yPct}%`,
                    }}
                    className={[
                      "absolute z-20 min-w-[82px] max-w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white px-2.5 py-1.5 text-center text-white shadow-lg select-none",
                      locked
                        ? "cursor-default"
                        : "touch-none cursor-grab active:cursor-grabbing",

                      pinClass(
                        pin.roleType
                      ),
                    ].join(
                      " "
                    )}
                  >
                    <span className="block truncate text-[8px] font-black uppercase tracking-[0.04em] opacity-85">
                      {
                        pin.positionLabel
                      }
                    </span>

                    <span className="mt-0.5 block truncate text-[10px] font-black sm:text-[11px]">
                      {
                        pin.assignedNames.join(
                          " & "
                        )
                      }
                    </span>

                    {pin.notes && (
                      <span className="mt-1 block truncate border-t border-white/25 pt-1 text-[7px] font-bold normal-case opacity-90 sm:text-[8px]">
                        {
                          pin.notes
                        }
                      </span>
                    )}
                  </button>
                )
              )}

          </div>


          {placing &&
           !locked && (
            <div className="mt-3 rounded-2xl bg-[#F7F5D8] px-4 py-3 text-xs font-bold text-[#5B5818]">
              Placement mode active — tap the exact standby position on the floor plan.
            </div>
          )}

        </section>


        <aside className="space-y-4">

          <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">

            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              Add FOH Staff
            </p>


            {locked ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                {sessionType} has been submitted and is locked.
              </div>
            ) : (
              <div className="mt-4 space-y-3">

                <label className="block">

                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                    Name
                  </span>

                  <select
                    value={
                      selectedStaffId
                    }
                    onChange={
                      (
                        event
                      ) => {
                        setSelectedStaffId(
                          event.target.value
                        );

                        setPlacing(
                          false
                        );

                        setError(
                          null
                        );
                      }
                    }
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-[#292824]"
                  >
                    <option value="">
                      Select staff
                    </option>

                    {fohStaff.map(
                      (
                        staff
                      ) => {
                        const alreadyAssigned =
                          assignedStaffNames.has(
                            staff.fullName
                              .trim()
                              .toLowerCase()
                          );


                        return (
                          <option
                            key={
                              staff.staffId
                            }
                            value={
                              staff.staffId
                            }
                            disabled={
                              alreadyAssigned
                            }
                          >
                            {staff.fullName}
                            {" · "}
                            {staff.positionName}
                            {alreadyAssigned
                              ? " · PLACED"
                              : ""}
                          </option>
                        );
                      }
                    )}

                  </select>

                </label>


                <div className="rounded-xl border border-neutral-200 bg-[#F6F4F1] px-3 py-2.5">

                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
                    Position
                  </p>

                  <p className={[
                    "mt-1 text-sm font-black",
                    selectedStaff
                      ? "text-[#292824]"
                      : "text-neutral-400",
                  ].join(
                    " "
                  )}>
                    {selectedStaff
                      ?.positionName ||
                      "Select staff first"}
                  </p>

                </div>


                <label className="block">

                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                    Coverage / Notes · Optional
                  </span>

                  <input
                    value={
                      staffNotes
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setStaffNotes(
                          event.target.value
                        )
                    }
                    placeholder="VIP1 & VIP2 / T1–T5 / Floor area"
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-[#292824] placeholder:text-neutral-400"
                  />

                </label>


                <button
                  type="button"
                  disabled={
                    !selectedStaff
                  }
                  onClick={() => {
                    setPlacing(
                      true
                    );

                    setError(
                      null
                    );
                  }}
                  className="h-12 w-full rounded-xl bg-[#292824] text-xs font-black text-white disabled:bg-neutral-300 disabled:text-white"
                >
                  {placing
                    ? "Tap Position on Map"
                    : "Place on Floor Map"}
                </button>


                {fohStaff.length ===
                  0 && (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">

                    No FOH staff is available in Team Structure for this outlet.

                    <Link
                      href="/protected/team-structure"
                      className="ml-1 font-black underline"
                    >
                      Manage Team Structure
                    </Link>

                  </div>
                )}

              </div>
            )}


          </section>


          <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                FOH Assignments
              </p>

              <span className="text-xs font-black">
                {
                  current
                    .staffPins
                    .length
                }
              </span>

            </div>


            <div className="mt-4 max-h-[350px] space-y-2 overflow-y-auto">

              {current
                .staffPins
                .map(
                  (
                    pin
                  ) => (
                    <div
                      key={
                        pin.id
                      }
                      className="rounded-xl border border-neutral-200 p-3"
                    >

                      <div className="flex items-start justify-between gap-2">

                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-[#292824]">
                            {
                              pin.positionLabel
                            }
                            {" · "}
                            {
                              pin.assignedNames.join(
                                " & "
                              )
                            }
                          </p>

                          <p className="mt-1 text-[10px] font-bold text-neutral-400">
                            Category · {
                              pin.roleType
                            }
                            {" · "}
                            {
                              pin.xPct.toFixed(
                                1
                              )
                            }
                            %
                            {" / "}
                            {
                              pin.yPct.toFixed(
                                1
                              )
                            }
                            %
                          </p>

                          {pin.notes && (
                            <p className="mt-2 text-[11px] font-bold leading-4 text-neutral-600">
                              {
                                pin.notes
                              }
                            </p>
                          )}
                        </div>


                        {!locked && (
                          <button
                            type="button"
                            onClick={() =>
                              removePin(
                                pin.id
                              )
                            }
                            className="shrink-0 text-[10px] font-black text-red-700"
                          >
                            Remove
                          </button>
                        )}

                      </div>

                    </div>
                  )
                )}


              {current
                .staffPins
                .length ===
                0 && (
                <div className="rounded-xl bg-neutral-50 p-4 text-xs font-bold text-neutral-400">
                  No FOH staff assigned yet.
                </div>
              )}

            </div>

          </section>

        </aside>

      </div>


      <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex items-center justify-between gap-3">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              BOH / Kitchen Listing
            </p>

            <h2 className="mt-1 text-xl font-black text-[#292824]">
              Kitchen Assignment
            </h2>
          </div>


          <span className="rounded-full bg-[#F6F4F1] px-3 py-2 text-[10px] font-black">
            {bohAssignedCount}/{bohPositions.length} assigned
          </span>

        </div>


        <div className="mt-5 space-y-2">

          {bohPositions.map(
            (
              position
            ) => {
              const row =
                current
                  .bohByPosition[
                    position.id
                  ];


              return (
                <div
                  key={
                    position.id
                  }
                  className="grid gap-2 rounded-2xl border border-neutral-200 p-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] md:items-center"
                >

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400 md:hidden">
                      Position
                    </p>

                    <p className="mt-1 text-sm font-black text-[#292824] md:mt-0">
                      {
                        position.position_name
                      }
                    </p>
                  </div>


                  <div className="space-y-2">

                    {splitNames(
                      row
                        ?.assignedNamesText ||
                      ""
                    ).length >
                      0 && (
                      <div className="flex flex-wrap gap-1.5">

                        {splitNames(
                          row
                            ?.assignedNamesText ||
                          ""
                        ).map(
                          (
                            assignedName
                          ) => (
                            <span
                              key={
                                assignedName
                              }
                              className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#F6F4F1] px-3 text-[11px] font-black text-[#292824]"
                            >
                              {
                                assignedName
                              }


                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextNames =
                                      splitNames(
                                        row
                                          ?.assignedNamesText ||
                                        ""
                                      ).filter(
                                        (
                                          name
                                        ) =>
                                          name !==
                                          assignedName
                                      );


                                    updateBoh(
                                      position.id,
                                      {
                                        assignedNamesText:
                                          nextNames.join(
                                            " & "
                                          ),
                                      }
                                    );
                                  }}
                                  className="text-red-600"
                                  aria-label={`Remove ${assignedName}`}
                                >
                                  ×
                                </button>
                              )}

                            </span>
                          )
                        )}

                      </div>
                    )}


                    {!locked && (
                      <select
                        value=""
                        onChange={
                          (
                            event
                          ) => {
                            const staffId =
                              event.target.value;


                            if (!staffId) {
                              return;
                            }


                            const selected =
                              bohStaff.find(
                                (
                                  item
                                ) =>
                                  item.staffId ===
                                  staffId
                              );


                            if (!selected) {
                              return;
                            }


                            const existingNames =
                              splitNames(
                                row
                                  ?.assignedNamesText ||
                                ""
                              );


                            if (
                              existingNames.some(
                                (
                                  name
                                ) =>
                                  name
                                    .trim()
                                    .toLowerCase() ===
                                  selected
                                    .fullName
                                    .trim()
                                    .toLowerCase()
                              )
                            ) {
                              return;
                            }


                            updateBoh(
                              position.id,
                              {
                                assignedNamesText: [
                                  ...existingNames,
                                  selected.fullName,
                                ].join(
                                  " & "
                                ),
                              }
                            );
                          }
                        }
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-[#292824]"
                      >
                        <option value="">
                          + Add staff from Team Structure
                        </option>


                        {bohStaff.map(
                          (
                            staff
                          ) => {
                            const normalizedName =
                              staff.fullName
                                .trim()
                                .toLowerCase();


                            const alreadyAssigned =
                              assignedStaffNames.has(
                                normalizedName
                              );


                            return (
                              <option
                                key={
                                  staff.staffId
                                }
                                value={
                                  staff.staffId
                                }
                                disabled={
                                  alreadyAssigned
                                }
                              >
                                {
                                  staff.fullName
                                }
                                {" · "}
                                {
                                  staff.positionName
                                }
                                {alreadyAssigned
                                  ? " · ASSIGNED"
                                  : ""}
                              </option>
                            );
                          }
                        )}

                      </select>
                    )}


                    {!locked &&
                     bohStaff.length ===
                      0 && (
                      <p className="text-[10px] font-bold leading-4 text-amber-700">
                        No BOH/BOTH staff in Team Structure.{" "}

                        <Link
                          href="/protected/team-structure"
                          className="font-black underline"
                        >
                          Manage Team Structure
                        </Link>
                      </p>
                    )}

                  </div>


                  <input
                    disabled={
                      locked
                    }
                    value={
                      row
                        ?.stationNote ||
                      ""
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateBoh(
                          position.id,
                          {
                            stationNote:
                              event.target.value,
                          }
                        )
                    }
                    placeholder="Station / notes"
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-[#292824] placeholder:text-neutral-400 disabled:border-neutral-200 disabled:bg-[#F6F4F1] disabled:text-[#292824] disabled:opacity-100 disabled:[-webkit-text-fill-color:#292824]"
                  />

                </div>
              );
            }
          )}

        </div>

      </section>


      <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <label>
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
            General Notes · Optional
          </span>

          <textarea
            disabled={
              locked
            }
            value={
              current
                .generalNotes
            }
            onChange={
              (
                event
              ) =>
                updateCurrent(
                  (
                    draft
                  ) => ({
                    ...draft,

                    generalNotes:
                      event.target.value,
                  })
                )
            }
            rows={
              3
            }
            className="mt-2 w-full resize-none rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-medium text-[#292824] disabled:bg-[#F6F4F1] disabled:text-[#292824] disabled:opacity-100 disabled:[-webkit-text-fill-color:#292824]"
          />
        </label>


        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">

          {!locked && (
            <>
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  save(
                    "SAVE_DRAFT"
                  )
                }
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-[#292824] disabled:opacity-40"
              >
                {saving
                  ? "Saving..."
                  : "Save Draft"}
              </button>


              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  save(
                    "SUBMIT"
                  )
                }
                className="h-12 rounded-2xl bg-[#D8D355] px-6 text-sm font-black text-[#292824] disabled:opacity-40"
              >
                Submit Floor Mapping
              </button>
            </>
          )}


          {locked && (
            <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
              {sessionType} submitted ✓
            </div>
          )}

        </div>

      </section>

    </main>
  );
}
