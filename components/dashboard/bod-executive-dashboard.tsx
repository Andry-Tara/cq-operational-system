import Link from "next/link";


type ExecutiveMetricProps = {
  label: string;
  value: string | number;
  helper: string;
  href: string;
  tone?:
    | "neutral"
    | "green"
    | "amber"
    | "red"
    | "blue";
};


function metricClass(
  tone:
    | "neutral"
    | "green"
    | "amber"
    | "red"
    | "blue" =
      "neutral"
) {
  if (
    tone === "green"
  ) {
    return "border-emerald-100 bg-emerald-50/65";
  }

  if (
    tone === "amber"
  ) {
    return "border-[#D8D355]/80 bg-[#D8D355]/20";
  }

  if (
    tone === "red"
  ) {
    return "border-red-100 bg-red-50/65";
  }

  if (
    tone === "blue"
  ) {
    return "border-[#E5E0D9] bg-[#F6F4F1]/75";
  }

  return "border-[#E5E0D9] bg-[#F6F4F1]/60";
}


function ExecutiveMetric({
  label,
  value,
  helper,
  href,
  tone,
}: ExecutiveMetricProps) {
  return (
    <Link
      href={
        href
      }
      className={`group rounded-[24px] border p-5 shadow-[0_8px_24px_rgba(79,73,64,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D8D2C8] hover:shadow-md ${metricClass(
        tone
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8D877E]">
            {
              label
            }
          </p>

          <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#292824]">
            {
              value
            }
          </p>

          <p className="mt-1.5 text-xs font-semibold text-[#777169]">
            {
              helper
            }
          </p>
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-black text-[#AAA49B] transition duration-200 group-hover:bg-[#D8D355] group-hover:text-[#3E3D0D]">
          →
        </span>
      </div>
    </Link>
  );
}


export function BodExecutiveDashboard({
  executiveName,
  dateLabel,
  outletCount,
  completedReports,
  inProgressReports,
  auditAverage,
  scoredOutlets,
  criticalFindings,
}: {
  executiveName: string;
  dateLabel: string;
  outletCount: number;
  completedReports: number;
  inProgressReports: number;
  auditAverage: number | null;
  scoredOutlets: number;
  criticalFindings: number;
}) {
  return (
    <main className="mx-auto w-full max-w-[1540px] px-4 py-7 sm:px-6 md:px-8 md:py-10">
      {/* =====================================================
          EXECUTIVE HEADER
      ===================================================== */}

      <section>
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#D8D355]" />

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              Executive Overview
            </p>
          </div>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-[#292824] md:text-5xl">
            Management Dashboard
          </h1>

          <p className="mt-2 text-sm font-medium text-[#777169]">
            {
              dateLabel
            }
            {" · "}
            Organization-wide read only
          </p>
        </div>
      </section>


      {/* =====================================================
          EXECUTIVE METRICS
      ===================================================== */}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ExecutiveMetric
          label="Outlets"
          value={
            outletCount
          }
          helper="Organization scope"
          href="/protected/reports"
          tone="blue"
        />

        <ExecutiveMetric
          label="Completed Reports"
          value={
            completedReports
          }
          helper="Operational reports today"
          href="/protected/reports"
          tone="green"
        />

        <ExecutiveMetric
          label="In Progress"
          value={
            inProgressReports
          }
          helper="Operational work today"
          href="/protected/reports"
          tone="amber"
        />

        <ExecutiveMetric
          label="Audit Average"
          value={
            auditAverage ===
            null
              ? "N/A"
              : auditAverage.toFixed(
                  1
                )
          }
          helper={`${scoredOutlets}/${outletCount} outlets scored`}
          href="/protected/audit/management"
        />

        <ExecutiveMetric
          label="Critical Findings"
          value={
            criticalFindings
          }
          helper="Current audit month"
          href="/protected/audit/management"
          tone={
            criticalFindings >
            0
              ? "red"
              : "neutral"
          }
        />
      </section>


      {/* =====================================================
          MANAGEMENT INTELLIGENCE
      ===================================================== */}

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[30px] border border-[#E5E0D9] bg-white p-6 shadow-[0_12px_36px_rgba(79,73,64,0.04)] md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#918B82]">
            Management Intelligence
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#292824]">
            Performance &amp; Compliance
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777169]">
            Executive access is focused on organization-wide monitoring,
            exceptions, trends, compliance, and submitted reports.
            Operational input remains with the responsible PIC.
          </p>


          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/protected/reports"
              className="group rounded-[22px] border border-[#E5E0D9] bg-[#F6F4F1]/65 p-5 transition hover:-translate-y-0.5 hover:border-[#D8D2C8] hover:bg-[#F6F4F1]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#292824]">
                    Operational Reports
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-[#777169]">
                    Opening, Closing and Central Kitchen across all outlets.
                  </p>
                </div>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#AAA49B] transition group-hover:bg-[#D8D355] group-hover:text-[#3E3D0D]">
                  →
                </span>
              </div>

              <p className="mt-5 text-xs font-black text-red-700">
                Open Reports Center
              </p>
            </Link>


            <Link
              href="/protected/audit/management"
              className="group rounded-[22px] border border-[#D8D355]/70 bg-[#D8D355]/15 p-5 transition hover:-translate-y-0.5 hover:bg-[#D8D355]/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#292824]">
                    Outlet Audit
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-[#706C65]">
                    Monthly score, findings, severity and outlet trends.
                  </p>
                </div>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8D355] text-[#3E3D0D]">
                  →
                </span>
              </div>

              <p className="mt-5 text-xs font-black text-[#59570C]">
                Open Audit Dashboard
              </p>
            </Link>
          </div>
        </div>


        {/* ===================================================
            EXECUTIVE IDENTITY
        =================================================== */}

        <div className="relative overflow-hidden rounded-[30px] border border-[#48483B] bg-gradient-to-br from-[#38382E] via-[#2D2D25] to-[#23231E] p-6 text-white shadow-[0_16px_40px_rgba(47,46,37,0.14)] md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#D8D355]/15 blur-3xl" />

          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D8D355]">
              Executive Snapshot
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
              Today at a glance
            </h2>

            <p className="mt-1.5 text-xs font-medium text-white/50">
              Organization-wide operational activity
            </p>


            <div className="mt-6 grid gap-2.5">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.055] px-4 py-3.5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/45">
                    Reports Today
                  </p>

                  <p className="mt-1 text-xs font-semibold text-white/55">
                    Completed operational reports
                  </p>
                </div>

                <p className="text-2xl font-black">
                  {
                    completedReports
                  }
                </p>
              </div>


              <div className="flex items-center justify-between rounded-[18px] border border-[#D8D355]/20 bg-[#D8D355]/10 px-4 py-3.5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#D8D355]">
                    In Progress
                  </p>

                  <p className="mt-1 text-xs font-semibold text-white/55">
                    Operational work today
                  </p>
                </div>

                <p className="text-2xl font-black text-[#E5E05A]">
                  {
                    inProgressReports
                  }
                </p>
              </div>


              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.055] px-4 py-3.5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/45">
                    Critical Findings
                  </p>

                  <p className="mt-1 text-xs font-semibold text-white/55">
                    Current audit month
                  </p>
                </div>

                <p
                  className={
                    criticalFindings > 0
                      ? "text-2xl font-black text-red-300"
                      : "text-2xl font-black text-white"
                  }
                >
                  {
                    criticalFindings
                  }
                </p>
              </div>
            </div>


            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-[10px] font-bold text-white/35">
                Signed in as
              </span>

              <span className="max-w-[65%] truncate text-right text-[10px] font-black text-white/60">
                {
                  executiveName
                }
              </span>
            </div>
          </div>
        </div>
      </section>


      {/* =====================================================
          ROADMAP
      ===================================================== */}

      <section className="mt-6 rounded-[30px] border border-dashed border-[#D8D2CA] bg-[#F6F4F1]/60 p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#918B82]">
          Platform Roadmap
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Opening / Closing Trends",
            "Central Kitchen Trends",
            "Briefing · 3 Times",
            "Test Food",
            "Floor Mapping",
            "Void / POS Integration",
            "Exception Center",
          ].map(
            (
              module
            ) => (
              <span
                key={
                  module
                }
                className="rounded-full border border-[#E2DDD5] bg-white/80 px-3 py-2 text-[10px] font-black text-[#706A62]"
              >
                {
                  module
                }
              </span>
            )
          )}
        </div>
      </section>
    </main>
  );
}
