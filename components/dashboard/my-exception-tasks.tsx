"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";


type ExceptionTask = {
  id: string;
  source:
    | "operations"
    | "audit";

  sourceId: string;

  title: string;
  description: string | null;

  outletName: string;
  area: string;
  reference: string;

  severity: string;
  status: string;

  dueAt: string | null;
  slaHours: number | null;

  escalated: boolean;
  overdue: boolean;

  href: string;
};

const EXCEPTION_TASK_CACHE_MS = 15_000;

let exceptionTaskCache:
  | {
      tasks: ExceptionTask[];
      fetchedAt: number;
    }
  | null = null;

let exceptionTaskRequest: Promise<ExceptionTask[]> | null = null;

async function loadExceptionTasksCached() {
  const now = Date.now();

  if (
    exceptionTaskCache &&
    now - exceptionTaskCache.fetchedAt < EXCEPTION_TASK_CACHE_MS
  ) {
    return exceptionTaskCache.tasks;
  }

  if (exceptionTaskRequest) {
    return exceptionTaskRequest;
  }

  exceptionTaskRequest = fetch("/api/exceptions/my-tasks", {
    cache: "no-store",
  })
    .then(async response => {
      if (!response.ok) {
        return [];
      }

      const payload = await response.json();

      const tasks: ExceptionTask[] = Array.isArray(payload?.tasks)
        ? payload.tasks
        : [];

      exceptionTaskCache = {
        tasks,
        fetchedAt: Date.now(),
      };

      return tasks;
    })
    .finally(() => {
      exceptionTaskRequest = null;
    });

  return exceptionTaskRequest;
}



function cleanStatus(
  value: string
) {
  return String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .toUpperCase();
}


function formatDue(
  value: string | null
) {
  if (!value) {
    return "No due date";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        "Asia/Jakarta",
    }
  ).format(
    new Date(
      value
    )
  );
}


function statusClass(
  status: string
) {
  if (
    status ===
    "in_progress"
  ) {
    return "border-[#C9C33B] bg-[#D8D355]/20 text-[#66620A]";
  }


  return "border-violet-200 bg-violet-50 text-violet-700";
}


function severityClass(
  severity: string
) {
  if (
    severity ===
    "critical"
  ) {
    return "text-red-700";
  }


  if (
    severity ===
    "major"
  ) {
    return "text-orange-700";
  }


  return "text-neutral-500";
}


export function MyExceptionTasks() {
  const [
    tasks,
    setTasks,
  ] =
    useState<
      ExceptionTask[]
    >(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        const nextTasks = await loadExceptionTasksCached();

        if (mounted) {
          setTasks(nextTasks);
        }
      } catch {
        // Keep Operational Hub usable if exception tasks fail.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      mounted = false;
    };
  }, []);

  if (
    loading ||
    tasks.length === 0
  ) {
    return null;
  }


  return (
    <section className="mt-6 border-t border-neutral-100 pt-6">

      <div className="flex items-end justify-between gap-3">

        <div>

          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-700">
            Follow-up
          </p>

          <h3 className="mt-1 text-[15px] font-black text-neutral-950">
            My Exception Tasks
          </h3>

        </div>


        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
          {
            tasks.length
          } active
        </span>

      </div>


      <div className="mt-3 space-y-2.5">

        {
          tasks.map(
            task => (
              <Link
                key={
                  task.id
                }
                href={
                  task.href
                }
                className="group block rounded-[20px] border border-[#E5E0D9] bg-[#F6F4F1]/65 p-4 transition hover:-translate-y-px hover:border-neutral-300 hover:bg-white hover:shadow-sm"
              >

                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-red-700">
                        {
                          task.source ===
                          "audit"
                            ? "Audit"
                            : "Operations"
                        }
                      </span>


                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                        {
                          task.area
                        }
                      </span>


                      <span
                        className={`text-[9px] font-black uppercase tracking-[0.12em] ${severityClass(
                          task.severity
                        )}`}
                      >
                        {
                          task.severity
                        }
                      </span>

                    </div>


                    <p className="mt-2 text-[13px] font-black leading-5 text-neutral-950">
                      {
                        task.title
                      }
                    </p>


                    <p className="mt-2 text-[10px] font-semibold text-neutral-400">
                      {
                        task.outletName
                      }
                      {" · "}
                      {
                        task.reference
                      }
                    </p>


                    <div className="mt-3 flex flex-wrap items-center gap-2">

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${statusClass(
                          task.status
                        )}`}
                      >
                        {
                          cleanStatus(
                            task.status
                          )
                        }
                      </span>


                      {
                        task.overdue && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-red-700">
                            Overdue
                          </span>
                        )
                      }


                      {
                        task.escalated && (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-orange-700">
                            Escalated
                          </span>
                        )
                      }


                      <span className="text-[9px] font-bold text-neutral-400">
                        Due{" "}
                        {
                          formatDue(
                            task.dueAt
                          )
                        }
                      </span>


                      {
                        task.slaHours && (
                          <span className="text-[9px] font-bold text-neutral-400">
                            SLA{" "}
                            {
                              task.slaHours
                            }h
                          </span>
                        )
                      }

                    </div>

                  </div>


                  <div className="flex shrink-0 flex-col items-end gap-3">

                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-400 transition group-hover:bg-[#D8D355] group-hover:text-[#39380C]">
                      →
                    </span>


                    <span className="hidden whitespace-nowrap text-[9px] font-black text-neutral-500 sm:block">
                      {
                        task.status ===
                        "in_progress"
                          ? "Continue"
                          : "Start follow-up"
                      }
                    </span>

                  </div>

                </div>

              </Link>
            )
          )
        }

      </div>

    </section>
  );
}
