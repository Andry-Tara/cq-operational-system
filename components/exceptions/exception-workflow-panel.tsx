"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type ProfileOption = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  active: boolean;
};


type WorkflowData = {
  id: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  sla_hours: number | null;
  escalated_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
};


type WorkflowEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string;
  createdAt: string;
};


function dateLabel(
  value:
    string | null
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
      timeZone:
        "Asia/Jakarta",
    }
  ).format(
    new Date(
      value
    )
  );
}


function statusLabel(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}


function statusClass(
  value: string
) {
  if (
    value ===
    "closed"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    value ===
    "verified"
  ) {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (
    value ===
    "resolved"
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (
    value ===
    "in_progress"
  ) {
    return "border-[#D8D355] bg-[#F8F7DF] text-[#66620A]";
  }

  if (
    value ===
    "assigned"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}


export function ExceptionWorkflowPanel({
  sourceType,
  sourceId,
  workflow,
  profiles,
  events,
  canManage,
  canExecute,
  assignedName,
  isOverdue,
}: {
  sourceType:
    "operations_issue" |
    "audit_finding";

  sourceId:
    string;

  workflow:
    WorkflowData | null;

  profiles:
    ProfileOption[];

  events:
    WorkflowEvent[];

  canManage:
    boolean;

  canExecute:
    boolean;

  assignedName:
    string | null;

  isOverdue:
    boolean;
}) {
  const router =
    useRouter();


  const status =
    workflow?.status ||
    "open";


  const [
    assignedTo,
    setAssignedTo,
  ] =
    useState(
      workflow
        ?.assigned_to ||
      ""
    );


  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      workflow?.due_at
        ? workflow
            .due_at
            .slice(
              0,
              10
            )
        : ""
    );


  const [
    slaHours,
    setSlaHours,
  ] =
    useState(
      String(
        workflow
          ?.sla_hours ||
        24
      )
    );


  const [
    resolutionNote,
    setResolutionNote,
  ] =
    useState(
      ""
    );


  const [
    actionNote,
    setActionNote,
  ] =
    useState(
      ""
    );


  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null
    );


  const activeProfiles =
    useMemo(
      () =>
        profiles.filter(
          profile =>
            profile.active
        ),
      [
        profiles,
      ]
    );


  async function runAction(
    action: string,
    extra:
      Record<
        string,
        unknown
      > = {}
  ) {
    if (busy) {
      return;
    }

    setBusy(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );


    try {
      const response =
        await fetch(
          "/api/exceptions/workflow",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                sourceType,
                sourceId,
                action,
                ...extra,
              }),
          }
        );


      const payload =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
          "Unable to update workflow."
        );
      }


      setMessage(
        "Workflow updated."
      );


      router.refresh();

    } catch (
      exception: any
    ) {
      setError(
        exception?.message ||
        "Unable to update workflow."
      );

    } finally {
      setBusy(
        false
      );
    }
  }


  async function saveAssignment() {
    if (
      !assignedTo
    ) {
      setError(
        "Select PIC first."
      );

      return;
    }


    let dueAt:
      string | null =
      null;


    if (
      dueDate
    ) {
      dueAt =
        new Date(
          `${dueDate}T23:59:59+07:00`
        )
          .toISOString();
    }


    await runAction(
      "assign",
      {
        assignedTo,
        dueAt,
        slaHours:
          Number(
            slaHours
          ),
      }
    );
  }


  async function resolve() {
    const note =
      resolutionNote
        .trim();


    if (!note) {
      setError(
        "Resolution note is required."
      );

      return;
    }


    await runAction(
      "resolve",
      {
        note,
      }
    );
  }


  const isActive =
    [
      "open",
      "assigned",
      "in_progress",
    ].includes(
      status
    );


  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">

      <section className="overflow-hidden rounded-[28px] border border-[#E6E1DA] bg-white">

        <div className="border-b border-[#EEEAE4] p-5 sm:p-6">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#918B82]">
                Workflow
              </p>

              <h2 className="mt-1 text-xl font-black text-[#292824]">
                {
                  canManage
                    ? "Follow-up Management"
                    : "Exception Follow-up"
                }
              </h2>
            </div>


            <div className="flex items-center gap-2">

              {
                isOverdue &&
                isActive && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-700">
                    Overdue
                  </span>
                )
              }


              {
                workflow
                  ?.escalated_at && (
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-orange-700">
                      Escalated
                    </span>
                  )
              }


              <span
                className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${statusClass(
                  status
                )}`}
              >
                {
                  statusLabel(
                    status
                  )
                }
              </span>

            </div>

          </div>


          <div className="mt-5 grid gap-3 sm:grid-cols-3">

            <div className="rounded-2xl bg-[#F8F6F2] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
                PIC
              </p>

              <p className="mt-2 text-sm font-black text-[#292824]">
                {
                  assignedName ||
                  "Not assigned"
                }
              </p>
            </div>


            <div className="rounded-2xl bg-[#F8F6F2] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
                Due Date
              </p>

              <p className="mt-2 text-sm font-black text-[#292824]">
                {
                  dateLabel(
                    workflow
                      ?.due_at ||
                    null
                  )
                }
              </p>
            </div>


            <div className="rounded-2xl bg-[#F8F6F2] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A09A91]">
                SLA
              </p>

              <p className="mt-2 text-sm font-black text-[#292824]">
                {
                  workflow
                    ?.sla_hours
                    ? `${workflow.sla_hours} hours`
                    : "-"
                }
              </p>
            </div>

          </div>

        </div>


        {
          (
            canManage ||
            canExecute
          ) ? (
            <div className="space-y-6 p-5 sm:p-6">

              {
                error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                    {
                      error
                    }
                  </div>
                )
              }


              {
                message && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                    {
                      message
                    }
                  </div>
                )
              }


              {
                canManage &&
                isActive && (
                  <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#918B82]">
                      Assignment & SLA
                    </p>


                    <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_1fr_0.7fr_auto]">

                      <select
                        value={
                          assignedTo
                        }
                        onChange={
                          event =>
                            setAssignedTo(
                              event
                                .target
                                .value
                            )
                        }
                        disabled={
                          busy
                        }
                        className="h-11 rounded-xl border border-[#E2DDD5] bg-white px-3 text-xs font-bold text-[#292824]"
                      >
                        <option value="">
                          Select PIC
                        </option>

                        {
                          activeProfiles.map(
                            profile => (
                              <option
                                key={
                                  profile.id
                                }
                                value={
                                  profile.id
                                }
                              >
                                {
                                  profile.fullName
                                }
                                {
                                  profile.jobTitle
                                    ? ` · ${profile.jobTitle}`
                                    : ""
                                }
                              </option>
                            )
                          )
                        }
                      </select>


                      <input
                        type="date"
                        value={
                          dueDate
                        }
                        onChange={
                          event =>
                            setDueDate(
                              event
                                .target
                                .value
                            )
                        }
                        disabled={
                          busy
                        }
                        className="h-11 rounded-xl border border-[#E2DDD5] bg-white px-3 text-xs font-bold text-[#292824]"
                      />


                      <input
                        type="number"
                        min="1"
                        max="8760"
                        value={
                          slaHours
                        }
                        onChange={
                          event =>
                            setSlaHours(
                              event
                                .target
                                .value
                            )
                        }
                        disabled={
                          busy
                        }
                        placeholder="SLA Hours"
                        className="h-11 rounded-xl border border-[#E2DDD5] bg-white px-3 text-xs font-bold text-[#292824]"
                      />


                      <button
                        type="button"
                        onClick={
                          saveAssignment
                        }
                        disabled={
                          busy
                        }
                        className="h-11 rounded-xl bg-[#D8D355] px-5 text-xs font-black text-[#39380C] transition hover:brightness-95 disabled:opacity-50"
                      >
                        Save
                      </button>

                    </div>

                  </div>
                )
              }


              {
                isActive && (
                  <div className="flex flex-wrap gap-2">

                    {
                      [
                        "open",
                        "assigned",
                      ].includes(
                        status
                      ) && (
                        <button
                          type="button"
                          onClick={
                            () =>
                              runAction(
                                "start"
                              )
                          }
                          disabled={
                            busy ||
                            !workflow
                              ?.assigned_to
                          }
                          className="rounded-xl bg-[#292824] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
                        >
                          Start Progress
                        </button>
                      )
                    }


                    <button
                      type="button"
                      onClick={
                        () =>
                          runAction(
                            "escalate",
                            {
                              note:
                                actionNote
                                  .trim() ||
                                null,
                            }
                          )
                      }
                      disabled={
                        busy
                      }
                      className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs font-black text-orange-700 disabled:opacity-40"
                    >
                      Escalate
                    </button>


                    <input
                      value={
                        actionNote
                      }
                      onChange={
                        event =>
                          setActionNote(
                            event
                              .target
                              .value
                          )
                      }
                      placeholder="Optional escalation note"
                      className="min-w-[240px] flex-1 rounded-xl border border-[#E2DDD5] bg-white px-3 text-xs text-[#292824]"
                    />

                  </div>
                )
              }


              {
                isActive && (
                  <div className="rounded-2xl border border-[#EEEAE4] bg-[#FAF9F6] p-4">

                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#918B82]">
                      Resolution
                    </p>


                    <textarea
                      value={
                        resolutionNote
                      }
                      onChange={
                        event =>
                          setResolutionNote(
                            event
                              .target
                              .value
                          )
                      }
                      rows={
                        4
                      }
                      disabled={
                        busy
                      }
                      placeholder="Describe the action taken and final condition..."
                      className="mt-3 w-full resize-none rounded-xl border border-[#E2DDD5] bg-white p-3 text-sm text-[#292824]"
                    />


                    <button
                      type="button"
                      onClick={
                        resolve
                      }
                      disabled={
                        busy
                      }
                      className="mt-3 rounded-xl bg-emerald-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      Resolve Exception
                    </button>

                  </div>
                )
              }


              {
                canManage &&
                status ===
                  "resolved" && (
                    <button
                      type="button"
                      onClick={
                        () =>
                          runAction(
                            "verify"
                          )
                      }
                      disabled={
                        busy
                      }
                      className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      Verify Resolution
                    </button>
                  )
              }


              {
                canManage &&
                status ===
                  "verified" && (
                    <button
                      type="button"
                      onClick={
                        () =>
                          runAction(
                            "close"
                          )
                      }
                      disabled={
                        busy
                      }
                      className="rounded-xl bg-[#292824] px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      Close Exception
                    </button>
                  )
              }


              {
                workflow
                  ?.resolution_note && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">

                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                        Resolution Note
                      </p>

                      <p className="mt-2 text-sm leading-6 text-[#292824]">
                        {
                          workflow
                            .resolution_note
                        }
                      </p>

                    </div>
                  )
              }

            </div>
          ) : (
            <div className="p-5 sm:p-6">

              <div className="rounded-2xl border border-[#E4E0D8] bg-[#F8F6F2] p-4">

                <p className="text-xs font-black text-[#292824]">
                  Read-only access
                </p>

                <p className="mt-1 text-xs leading-5 text-[#918B82]">
                  Workflow changes are managed by authorized Management users.
                </p>

              </div>

              {
                workflow
                  ?.resolution_note && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">

                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                        Resolution Note
                      </p>

                      <p className="mt-2 text-sm leading-6 text-[#292824]">
                        {
                          workflow
                            .resolution_note
                        }
                      </p>

                    </div>
                  )
              }

            </div>
          )
        }

      </section>


      <aside className="rounded-[28px] border border-[#E6E1DA] bg-white p-5 sm:p-6">

        <div className="flex items-center justify-between gap-3">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#918B82]">
              Activity
            </p>

            <h2 className="mt-1 text-lg font-black text-[#292824]">
              Workflow History
            </h2>
          </div>


          <span className="text-[10px] font-black text-[#A09A91]">
            {
              events.length
            }
          </span>

        </div>


        <div className="mt-5 space-y-3">

          {
            events.length ? (
              events.map(
                event => (
                  <div
                    key={
                      event.id
                    }
                    className="rounded-2xl bg-[#F8F6F2] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">

                      <p className="text-xs font-black text-[#292824]">
                        {
                          statusLabel(
                            event.eventType
                          )
                        }
                      </p>

                      <span className="text-[9px] font-bold text-[#A09A91]">
                        {
                          dateLabel(
                            event.createdAt
                          )
                        }
                      </span>

                    </div>


                    <p className="mt-1 text-[10px] font-bold text-[#918B82]">
                      {
                        event.actorName
                      }
                    </p>


                    {
                      event.fromStatus &&
                        event.toStatus &&
                        event.fromStatus !==
                          event.toStatus && (
                          <p className="mt-2 text-[10px] font-bold text-[#66620A]">
                            {
                              statusLabel(
                                event.fromStatus
                              )
                            }
                            {" → "}
                            {
                              statusLabel(
                                event.toStatus
                              )
                            }
                          </p>
                        )
                    }


                    {
                      event.note && (
                        <p className="mt-2 text-xs leading-5 text-[#6F6961]">
                          {
                            event.note
                          }
                        </p>
                      )
                    }

                  </div>
                )
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-[#DDD8D0] p-5 text-center">

                <p className="text-xs font-bold text-[#918B82]">
                  No workflow activity yet.
                </p>

              </div>
            )
          }

        </div>

      </aside>

    </div>
  );
}
