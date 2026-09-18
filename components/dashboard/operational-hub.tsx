import Link from "next/link";


export type OperationalHubOperation = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  href: string;
  action: string;
  disabled?: boolean;
};


export type OperationalHubActivity = {
  key: string;
  title: string;
  meta: string;
  status: string;
  href: string;
};


export type OperationalHubQuickLink = {
  key: string;
  label: string;
  description: string;
  href: string;
};


function cleanStatus(
  value: string
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /_/g,
      " "
    )
    .toUpperCase();
}


function isCompleted(
  status: string
) {
  return [
    "COMPLETED",
    "SUBMITTED",
    "REVIEWED",
  ].includes(
    cleanStatus(
      status
    )
  );
}


function isInProgress(
  status: string
) {
  return [
    "IN PROGRESS",
    "REOPENED",
    "NEEDS CORRECTION",
  ].includes(
    cleanStatus(
      status
    )
  );
}


function statusClass(
  status: string
) {
  if (
    isCompleted(
      status
    )
  ) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (
    isInProgress(
      status
    )
  ) {
    return "border-[#CFC943] bg-[#D8D355]/35 text-[#59570C]";
  }

  return "border-[#E4DFD8] bg-[#F6F4F1]/90 text-[#65615B]";
}


function priority(
  operation:
    OperationalHubOperation
) {
  if (
    isInProgress(
      operation.status
    )
  ) {
    return 0;
  }

  if (
    !isCompleted(
      operation.status
    )
  ) {
    return 1;
  }

  return 2;
}


function isPdfHref(
  href: string
) {
  return (
    href.startsWith(
      "/api/reports/"
    ) &&
    href.endsWith(
      "/pdf"
    )
  );
}


function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M5 12h14M14 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}


function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 8v4l2.7 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${statusClass(
        status
      )}`}
    >
      {
        cleanStatus(
          status
        )
      }
    </span>
  );
}


function OperationCard({
  operation,
}: {
  operation:
    OperationalHubOperation;
}) {
  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
            {
              operation.eyebrow
            }
          </p>

          <h4 className="mt-1 truncate text-[15px] font-black tracking-tight text-neutral-950">
            {
              operation.title
            }
          </h4>
        </div>

        <StatusBadge
          status={
            operation.status
          }
        />
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] leading-[1.7] text-neutral-500">
        {
          operation.description
        }
      </p>

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3">
        <span className="text-[11px] font-black text-neutral-900">
          {
            operation.disabled
              ? "View only"
              : operation.action
          }
        </span>

        {!operation.disabled &&
          operation.href && (
            <span className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-red-600">
              <ArrowIcon />
            </span>
          )}
      </div>
    </div>
  );

  if (
    operation.disabled ||
    !operation.href
  ) {
    return (
      <article className="min-h-[150px] rounded-[20px] border border-neutral-200 bg-neutral-50/70 p-4 opacity-75">
        {content}
      </article>
    );
  }

  const pdf =
    isPdfHref(
      operation.href
    );

  return (
    <Link
      href={
        operation.href
      }
      target={
        pdf
          ? "_blank"
          : undefined
      }
      rel={
        pdf
          ? "noreferrer"
          : undefined
      }
      className="group min-h-[150px] rounded-[20px] border border-[#E5E0D9] bg-[#F6F4F1]/55 p-4 shadow-[0_1px_2px_rgba(79,73,64,0.02)] transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)]"
    >
      {content}
    </Link>
  );
}


export function OperationalHub({
  outletName,
  dateLabel,
  operations,
  activities,
  quickLinks,
}: {
  outletName: string;
  dateLabel: string;
  operations:
    OperationalHubOperation[];
  activities:
    OperationalHubActivity[];
  quickLinks:
    OperationalHubQuickLink[];
}) {
  const sortedOperations =
    [...operations].sort(
      (
        a,
        b
      ) =>
        priority(a) -
        priority(b)
    );

  const actionable =
    sortedOperations.filter(
      operation =>
        !operation.disabled &&
        Boolean(
          operation.href
        )
    );

  const primary =
    actionable[0] ??
    null;

  const completedCount =
    operations.filter(
      operation =>
        isCompleted(
          operation.status
        )
    ).length;

  const progressCount =
    operations.filter(
      operation =>
        isInProgress(
          operation.status
        )
    ).length;

  const remainingCount =
    Math.max(
      operations.length -
        completedCount,
      0
    );

  const showOperationGrid =
    operations.length >
    1;

  const primaryPdf =
    primary
      ? isPdfHref(
          primary.href
        )
      : false;

  return (
    <section className="mt-5 md:mt-7">
      <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-gradient-to-br from-white via-white to-neutral-50/80 shadow-[0_12px_40px_rgba(0,0,0,0.04)] md:rounded-[30px]">

        {/* HEADER */}

        <div className="flex flex-col gap-4 border-b border-neutral-100 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:px-7 md:py-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-red-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50">
                <SparkIcon />
              </span>

              <p className="text-[9px] font-black uppercase tracking-[0.18em]">
                Operational Hub
              </p>
            </div>

            <h2 className="mt-2 text-[24px] font-black tracking-[-0.03em] text-neutral-950 sm:text-[28px]">
              Today&apos;s Operations
            </h2>

            <p className="mt-1 text-xs text-neutral-500 sm:text-[13px]">
              <span className="font-bold text-neutral-700">
                {outletName}
              </span>
              <span className="mx-1.5 text-neutral-300">
                •
              </span>
              {dateLabel}
            </p>
          </div>


          {/* MINI SUMMARY */}

          <div className="flex w-full gap-2 overflow-x-auto pb-1 md:w-auto md:overflow-visible md:pb-0">
            <div className="min-w-[94px] rounded-2xl border border-neutral-200 bg-white px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                Assigned
              </p>

              <p className="mt-0.5 text-lg font-black text-neutral-950">
                {
                  operations.length
                }
              </p>
            </div>

            <div className="min-w-[94px] rounded-2xl border border-neutral-200 bg-white px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                Remaining
              </p>

              <p className="mt-0.5 text-lg font-black text-neutral-950">
                {
                  remainingCount
                }
              </p>
            </div>

            <div className="min-w-[94px] rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                Done
              </p>

              <p className="mt-0.5 text-lg font-black text-emerald-700">
                {
                  completedCount
                }
              </p>
            </div>

            {progressCount > 0 && (
              <div className="min-w-[94px] rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600">
                  Active
                </p>

                <p className="mt-0.5 text-lg font-black text-amber-700">
                  {
                    progressCount
                  }
                </p>
              </div>
            )}
          </div>
        </div>


        {/* MAIN GRID */}

        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">

          {/* LEFT */}

          <div className="p-4 sm:p-5 md:p-6 lg:border-r lg:border-neutral-100">
            <div className="flex items-center gap-2 text-neutral-400">
              <ClockIcon />

              <p className="text-[9px] font-black uppercase tracking-[0.16em]">
                Next Action
              </p>
            </div>


            {primary ? (
              <Link
                href={
                  primary.href
                }
                target={
                  primaryPdf
                    ? "_blank"
                    : undefined
                }
                rel={
                  primaryPdf
                    ? "noreferrer"
                    : undefined
                }
                className="group relative mt-3 block overflow-hidden rounded-[24px] border border-[#E4DFD8] bg-[#F6F4F1]/75 p-5 text-[#292824] shadow-[0_12px_32px_rgba(79,73,64,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D9D3CA] hover:shadow-[0_18px_40px_rgba(79,73,64,0.10)] sm:p-6"
              >
                <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#D8D355]/35 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#858078]">
                        {
                          primary.eyebrow
                        }
                      </p>

                      <h3 className="mt-2 text-[21px] font-black tracking-[-0.025em] sm:text-[24px]">
                        {
                          primary.title
                        }
                      </h3>
                    </div>

                    <span className="rounded-full border border-[#C9C33B] bg-[#D8D355] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#41400E]">
                      {
                        cleanStatus(
                          primary.status
                        )
                      }
                    </span>
                  </div>

                  <p className="mt-2.5 max-w-2xl text-xs leading-5 text-[#706C65] sm:text-[13px]">
                    {
                      primary.description
                    }
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-[#DED8D0] pt-4">
                    <span className="text-[13px] font-black">
                      {
                        primary.action
                      }
                    </span>

                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D8D355] text-[#35340D] transition group-hover:translate-x-0.5">
                      <ArrowIcon />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="mt-3 rounded-[22px] border border-dashed border-neutral-200 bg-white px-5 py-8 text-center">
                <p className="text-sm font-black text-neutral-700">
                  All caught up
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  No operation currently requires action.
                </p>
              </div>
            )}


            {/* ALL OPERATIONS — only useful if >1 */}

            {showOperationGrid && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <GridIcon />

                    <p className="text-[9px] font-black uppercase tracking-[0.16em]">
                      Your Operations
                    </p>
                  </div>

                  <span className="text-[10px] font-bold text-neutral-400">
                    {
                      operations.length
                    } assigned
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {
                    sortedOperations.map(
                      operation => (
                        <OperationCard
                          key={
                            operation.key
                          }
                          operation={
                            operation
                          }
                        />
                      )
                    )
                  }
                </div>
              </div>
            )}
          </div>


          {/* RIGHT SIDEBAR */}

          <aside className="border-t border-neutral-100 bg-neutral-50/45 p-4 sm:p-5 md:p-6 lg:border-t-0">

            {/* QUICK ACCESS */}

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Quick Access
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {
                  quickLinks.map(
                    item => (
                      <Link
                        key={
                          item.key
                        }
                        href={
                          item.href
                        }
                        className="group flex min-h-[68px] items-center justify-between gap-3 rounded-[18px] border border-[#E5E0D9] bg-[#F6F4F1]/65 px-4 py-3 transition hover:-translate-y-px hover:border-neutral-300 hover:shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-black text-neutral-950">
                            {
                              item.label
                            }
                          </p>

                          <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                            {
                              item.description
                            }
                          </p>
                        </div>

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 transition group-hover:bg-neutral-950 group-hover:text-white">
                          <ArrowIcon />
                        </span>
                      </Link>
                    )
                  )
                }
              </div>
            </div>


            {/* RECENT */}

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                    History
                  </p>

                  <h3 className="mt-1 text-[15px] font-black text-neutral-950">
                    Recent Activity
                  </h3>
                </div>

                {
                  activities.length > 0 && (
                    <span className="text-[10px] font-bold text-neutral-400">
                      Latest {
                        activities.length
                      }
                    </span>
                  )
                }
              </div>

              {activities.length === 0 ? (
                <div className="mt-3 rounded-[18px] border border-dashed border-neutral-200 bg-white px-4 py-5 text-center">
                  <p className="text-[11px] font-bold text-neutral-400">
                    No recent activity yet.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {
                    activities.map(
                      item => {
                        const pdf =
                          isPdfHref(
                            item.href
                          );

                        return (
                          <Link
                            key={
                              item.key
                            }
                            href={
                              item.href
                            }
                            target={
                              pdf
                                ? "_blank"
                                : undefined
                            }
                            rel={
                              pdf
                                ? "noreferrer"
                                : undefined
                            }
                            className="group flex items-center gap-3 rounded-[18px] border border-[#E5E0D9] bg-white/90 p-3.5 transition hover:border-neutral-300 hover:shadow-sm"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F6F4F1] text-[#77726A]">
                              <ClockIcon />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-black text-neutral-900">
                                {
                                  item.title
                                }
                              </p>

                              <p className="mt-0.5 truncate text-[9px] text-neutral-400">
                                {
                                  item.meta
                                }
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <span className="hidden sm:block">
                                <StatusBadge
                                  status={
                                    item.status
                                  }
                                />
                              </span>

                              <span className="text-neutral-300 transition group-hover:text-red-600">
                                <ArrowIcon />
                              </span>
                            </div>
                          </Link>
                        );
                      }
                    )
                  }
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
