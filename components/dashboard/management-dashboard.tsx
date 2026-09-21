import Link from "next/link";


type ManagementQuickLink = {
  key:
    string;

  label:
    string;

  description:
    string;

  href:
    string;
};


type ManagementActivity = {
  key:
    string;

  title:
    string;

  meta:
    string;

  status:
    string;

  href:
    string;
};


function toneFor(
  value: string
) {
  const normalized =
    value
      .trim()
      .toLowerCase();


  if (
    normalized.includes(
      "audit"
    )
  ) {
    return {
      shell:
        "border-red-100 bg-red-50/55",

      icon:
        "bg-red-100 text-red-700",

      eyebrow:
        "text-red-700",

      symbol:
        "A",
    };
  }


  if (
    normalized.includes(
      "exception"
    )
  ) {
    return {
      shell:
        "border-amber-100 bg-amber-50/65",

      icon:
        "bg-amber-100 text-amber-700",

      eyebrow:
        "text-amber-700",

      symbol:
        "!",
    };
  }


  if (
    normalized.includes(
      "test food"
    )
  ) {
    return {
      shell:
        "border-emerald-100 bg-emerald-50/55",

      icon:
        "bg-emerald-100 text-emerald-700",

      eyebrow:
        "text-emerald-700",

      symbol:
        "T",
    };
  }


  if (
    normalized.includes(
      "pos"
    ) ||
    normalized.includes(
      "void"
    )
  ) {
    return {
      shell:
        "border-red-100 bg-red-50/55",

      icon:
        "bg-red-100 text-red-700",

      eyebrow:
        "text-red-700",

      symbol:
        "P",
    };
  }


  if (
    normalized.includes(
      "report"
    )
  ) {
    return {
      shell:
        "border-sky-100 bg-sky-50/55",

      icon:
        "bg-sky-100 text-sky-700",

      eyebrow:
        "text-sky-700",

      symbol:
        "R",
    };
  }


  return {
    shell:
      "border-[#E5E0D9] bg-[#F6F4F1]/70",

    icon:
      "bg-white text-[#292824]",

    eyebrow:
      "text-neutral-500",

    symbol:
      "→",
  };
}


function cleanStatus(
  value: string
) {
  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /_/g,
      " "
    )
    .toUpperCase();
}


function statusClass(
  value: string
) {
  const status =
    cleanStatus(
      value
    );


  if (
    [
      "COMPLETED",
      "SUBMITTED",
      "VERIFIED",
      "CLOSED",
    ].includes(
      status
    )
  ) {
    return "bg-emerald-50 text-emerald-700";
  }


  if (
    [
      "IN PROGRESS",
      "REOPENED",
      "ASSIGNED",
    ].includes(
      status
    )
  ) {
    return "bg-[#D8D355]/35 text-[#59570C]";
  }


  return "bg-neutral-100 text-neutral-500";
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


export function ManagementDashboard({
  outletName,
  dateLabel,
  quickLinks,
  activities,
}: {
  outletName:
    string;

  dateLabel:
    string;

  quickLinks:
    ManagementQuickLink[];

  activities:
    ManagementActivity[];
}) {
  return (
    <main className="min-h-screen bg-[#F5F5F3] text-[#292824]">

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-9">

        <header>

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
            Management Overview
          </p>

          <h1 className="mt-1.5 text-[30px] font-black tracking-[-0.03em] md:text-4xl">
            Dashboard
          </h1>

          <p className="mt-2 text-sm font-medium text-neutral-500">
            {dateLabel}
          </p>

        </header>


        <section className="mt-6 overflow-hidden rounded-[30px] border border-[#E3DED7] bg-white shadow-[0_18px_55px_rgba(58,52,44,0.06)]">

          <div className="grid lg:grid-cols-[minmax(0,1.45fr)_360px]">

            <div className="relative overflow-hidden p-6 sm:p-7 md:p-9">

              <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#D8D355]/25 blur-3xl" />

              <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-red-100/45 blur-3xl" />


              <div className="relative">

                <div className="flex flex-wrap items-center gap-2">

                  <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-700">
                    Management Control
                  </span>

                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">
                    Outlet Oversight
                  </span>

                </div>


                <h2 className="mt-5 max-w-3xl text-[28px] font-black tracking-[-0.035em] sm:text-[34px]">
                  Keep the operation visible,
                  actionable and under control.
                </h2>


                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-neutral-500">
                  Review operational performance,
                  audit findings, corrective actions
                  and report history from one management
                  workspace.
                </p>


                <div className="mt-7 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-[20px] border border-neutral-200 bg-white/80 p-4 backdrop-blur">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Monitor
                    </p>

                    <p className="mt-2 text-sm font-black">
                      Audit & Compliance
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                      Scores, findings and outlet trends.
                    </p>

                  </div>


                  <div className="rounded-[20px] border border-neutral-200 bg-white/80 p-4 backdrop-blur">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Follow Up
                    </p>

                    <p className="mt-2 text-sm font-black">
                      Issues & Exceptions
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                      Ownership, resolution and verification.
                    </p>

                  </div>


                  <div className="rounded-[20px] border border-neutral-200 bg-white/80 p-4 backdrop-blur">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Review
                    </p>

                    <p className="mt-2 text-sm font-black">
                      Operational Reports
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                      Daily history and operational evidence.
                    </p>

                  </div>

                </div>

              </div>

            </div>


            <aside className="border-t border-neutral-100 bg-[#F8F7F4] p-6 lg:border-l lg:border-t-0 md:p-7">

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Active Outlet
              </p>


              <div className="mt-4 rounded-[24px] border border-neutral-200 bg-white p-5">

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-700">
                    {
                      outletName
                        .split(
                          " "
                        )
                        .map(
                          word =>
                            word[0]
                        )
                        .join(
                          ""
                        )
                        .slice(
                          0,
                          3
                        )
                        .toUpperCase()
                    }
                  </div>


                  <div className="min-w-0">

                    <p className="truncate text-xl font-black tracking-tight">
                      {outletName}
                    </p>

                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                      Management
                    </p>

                  </div>

                </div>


                <Link
                  href="/protected/select-outlet"
                  className="mt-5 flex h-11 items-center justify-center rounded-xl border border-neutral-200 text-xs font-black transition hover:bg-neutral-50"
                >
                  Change Outlet
                </Link>

              </div>


              <div className="mt-4 rounded-[20px] bg-[#292824] p-4 text-white">

                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
                  Focus
                </p>

                <p className="mt-2 text-sm font-black">
                  Review → Follow Up → Verify
                </p>

                <p className="mt-1 text-[10px] leading-5 text-white/55">
                  Management workspace stays focused
                  on oversight rather than daily data entry.
                </p>

              </div>

            </aside>

          </div>

        </section>


        <section className="mt-5">

          <div className="flex items-end justify-between gap-3">

            <div>

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Management Tools
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight">
                Control Center
              </h2>

            </div>


            <span className="text-[10px] font-bold text-neutral-400">
              {quickLinks.length} available
            </span>

          </div>


          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

            {quickLinks.map(
              item => {
                const tone =
                  toneFor(
                    `${item.key} ${item.label}`
                  );


                return (
                  <Link
                    key={
                      item.key
                    }
                    href={
                      item.href
                    }
                    className={[
                      "group relative overflow-hidden rounded-[22px] border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(50,45,38,0.08)]",
                      tone.shell,
                    ].join(
                      " "
                    )}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <span
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black",
                            tone.icon,
                          ].join(
                            " "
                          )}
                        >
                          {tone.symbol}
                        </span>


                        <p
                          className={[
                            "mt-4 text-[9px] font-black uppercase tracking-[0.14em]",
                            tone.eyebrow,
                          ].join(
                            " "
                          )}
                        >
                          {item.key ===
                          "pos-void-sales"
                            ? "POS Insights"
                            : "Management Access"}
                        </p>


                        <h3 className="mt-1 text-[17px] font-black tracking-tight">
                          {item.label}
                        </h3>


                        <p className="mt-1.5 text-xs leading-5 text-neutral-500">
                          {item.description}
                        </p>

                      </div>


                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-neutral-400 transition group-hover:bg-[#292824] group-hover:text-white">
                        <ArrowIcon />
                      </span>

                    </div>

                  </Link>
                );
              }
            )}

          </div>

        </section>


        {activities.length > 0 && (
          <section className="mt-6 rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-end justify-between gap-3">

              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  History
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Recent Activity
                </h2>

              </div>


              <span className="text-[10px] font-bold text-neutral-400">
                Latest {
                  Math.min(
                    activities.length,
                    4
                  )
                }
              </span>

            </div>


            <div className="mt-4 grid gap-2 md:grid-cols-2">

              {activities
                .slice(
                  0,
                  4
                )
                .map(
                  item => (
                    <Link
                      key={
                        item.key
                      }
                      href={
                        item.href
                      }
                      className="flex items-center justify-between gap-4 rounded-[18px] border border-neutral-200 bg-[#F8F7F4] px-4 py-3 transition hover:border-neutral-300"
                    >

                      <div className="min-w-0">

                        <p className="truncate text-xs font-black">
                          {item.title}
                        </p>

                        <p className="mt-1 truncate text-[10px] text-neutral-400">
                          {item.meta}
                        </p>

                      </div>


                      <span
                        className={[
                          "shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black uppercase",
                          statusClass(
                            item.status
                          ),
                        ].join(
                          " "
                        )}
                      >
                        {
                          cleanStatus(
                            item.status
                          )
                        }
                      </span>

                    </Link>
                  )
                )}

            </div>

          </section>
        )}

      </div>

    </main>
  );
}
