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
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50/70";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50/70";
  }

  if (tone === "red") {
    return "border-red-200 bg-red-50/70";
  }

  if (tone === "blue") {
    return "border-sky-200 bg-sky-50/70";
  }

  return "border-neutral-200 bg-white";
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
      href={href}
      className={`group rounded-[22px] border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${metricClass(
        tone
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-500">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
            {value}
          </p>

          <p className="mt-1 text-xs font-semibold text-neutral-500">
            {helper}
          </p>
        </div>

        <span className="text-lg font-black text-neutral-300 transition group-hover:translate-x-1 group-hover:text-red-700">
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
      <section>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              Executive Overview
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight text-neutral-950 md:text-5xl">
              Management Dashboard
            </h1>

            <p className="mt-2 text-sm font-medium text-neutral-500">
              {dateLabel}
              {" · "}
              Organization-wide read only
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/protected/reports"
              className="inline-flex min-h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-700 transition hover:bg-neutral-50"
            >
              Reports Center →
            </Link>

            <Link
              href="/protected/audit/management"
              className="inline-flex min-h-11 items-center rounded-xl bg-neutral-950 px-4 text-xs font-black text-white transition hover:bg-neutral-800"
            >
              Management Audit →
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ExecutiveMetric
          label="Outlets"
          value={outletCount}
          helper="Organization scope"
          href="/protected/reports"
          tone="blue"
        />

        <ExecutiveMetric
          label="Completed Reports"
          value={completedReports}
          helper="Operational reports today"
          href="/protected/reports"
          tone="green"
        />

        <ExecutiveMetric
          label="In Progress"
          value={inProgressReports}
          helper="Operational work today"
          href="/protected/reports"
          tone="amber"
        />

        <ExecutiveMetric
          label="Audit Average"
          value={
            auditAverage === null
              ? "N/A"
              : auditAverage.toFixed(1)
          }
          helper={`${scoredOutlets}/${outletCount} outlets scored`}
          href="/protected/audit/management"
        />

        <ExecutiveMetric
          label="Critical Findings"
          value={criticalFindings}
          helper="Current audit month"
          href="/protected/audit/management"
          tone={
            criticalFindings > 0
              ? "red"
              : "neutral"
          }
        />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
            Management Intelligence
          </p>

          <h2 className="mt-2 text-2xl font-black text-neutral-950">
            Performance & Compliance
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Executive access is focused on organization-wide monitoring,
            exceptions, trends, compliance, and submitted reports.
            Operational input remains with the responsible PIC.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/protected/reports"
              className="group rounded-2xl border border-neutral-200 p-5 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <p className="text-sm font-black text-neutral-900">
                Operational Reports
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Opening, Closing and Central Kitchen across all outlets.
              </p>

              <p className="mt-4 text-xs font-black text-red-700">
                Open Reports Center →
              </p>
            </Link>

            <Link
              href="/protected/audit/management"
              className="group rounded-2xl border border-neutral-200 p-5 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <p className="text-sm font-black text-neutral-900">
                Outlet Audit
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Monthly score, findings, severity and outlet trends.
              </p>

              <p className="mt-4 text-xs font-black text-red-700">
                Open Audit Dashboard →
              </p>
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Signed In
          </p>

          <p className="mt-3 text-xl font-black">
            {executiveName}
          </p>

          <p className="mt-1 text-xs font-bold text-neutral-400">
            BOD · Executive Read Only
          </p>

          <div className="mt-7 border-t border-neutral-800 pt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
              Executive Scope
            </p>

            <p className="mt-2 text-3xl font-black">
              All Outlets
            </p>

            <p className="mt-1 text-xs text-neutral-400">
              {outletCount} active outlets
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-dashed border-neutral-300 bg-white/60 p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
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
            (module) => (
              <span
                key={module}
                className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-[10px] font-black text-neutral-500"
              >
                {module}
              </span>
            )
          )}
        </div>
      </section>
    </main>
  );
}
