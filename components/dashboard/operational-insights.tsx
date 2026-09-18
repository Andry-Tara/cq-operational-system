function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?:
    | "neutral"
    | "success"
    | "active"
    | "danger";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
      : tone === "active"
        ? "border-[#D8D355]/80 bg-[#D8D355]/20 text-[#59570C]"
        : tone === "danger"
          ? "border-red-100 bg-red-50/70 text-red-700"
          : "border-[#E5E0D9] bg-[#F6F4F1]/70 text-[#34322E]";

  return (
    <div
      className={`rounded-[20px] border px-4 py-4 ${cls}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.13em] opacity-60">
        {label}
      </p>

      <p className="mt-1.5 text-3xl font-black tracking-[-0.04em]">
        {value}
      </p>
    </div>
  );
}


export function OutletInsights({
  outletName,
  assigned,
  completed,
  active,
  remaining,
  issues,
}: {
  outletName: string;
  assigned: number;
  completed: number;
  active: number;
  remaining: number;
  issues: number;
}) {
  const completion =
    assigned > 0
      ? Math.round(
          completed /
          assigned *
          100
        )
      : 0;

  return (
    <section className="mt-5 overflow-hidden rounded-[26px] border border-[#E5E0D9] bg-white shadow-[0_12px_34px_rgba(79,73,64,0.04)] md:mt-6 md:rounded-[30px]">
      <div className="border-b border-[#EEEAE4] px-5 py-5 md:px-7 md:py-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#918B82]">
          Outlet Insights
        </p>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-[-0.03em] text-[#292824] md:text-2xl">
              {outletName}
            </h2>

            <p className="mt-1 text-xs text-[#777169]">
              Today operational completion
            </p>
          </div>

          <span className="w-fit rounded-full border border-[#D8D355]/70 bg-[#D8D355]/16 px-3 py-1.5 text-[10px] font-black text-[#59570C]">
            {completion}% completed
          </span>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#EEEAE4]">
          <div
            className="h-full rounded-full bg-[#D8D355]"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  completion
                )
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 xl:grid-cols-5 md:p-7">
        <Stat
          label="Assigned"
          value={assigned}
        />

        <Stat
          label="Completed"
          value={completed}
          tone="success"
        />

        <Stat
          label="Active"
          value={active}
          tone="active"
        />

        <Stat
          label="Remaining"
          value={remaining}
        />

        <Stat
          label="Issues"
          value={issues}
          tone={
            issues > 0
              ? "danger"
              : "neutral"
          }
        />
      </div>
    </section>
  );
}


export function CkProgress({
  outletName,
  assigned,
  completed,
  active,
  pending,
  issues,
}: {
  outletName: string;
  assigned: number;
  completed: number;
  active: number;
  pending: number;
  issues: number;
}) {
  return (
    <section className="mt-5 rounded-[26px] border border-[#E5E0D9] bg-white p-5 shadow-[0_12px_34px_rgba(79,73,64,0.04)] md:mt-6 md:rounded-[30px] md:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#918B82]">
            Central Kitchen
          </p>

          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#292824] md:text-2xl">
            CK Progress
          </h2>

          <p className="mt-1 text-xs text-[#777169]">
            {outletName} · assigned section progress
          </p>
        </div>

        <span className="w-fit rounded-full border border-[#D8D355]/70 bg-[#D8D355]/16 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#59570C]">
          Opening / Closing CK
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Assigned"
          value={assigned}
        />

        <Stat
          label="Completed"
          value={completed}
          tone="success"
        />

        <Stat
          label="Active"
          value={active}
          tone="active"
        />

        <Stat
          label="Pending"
          value={pending}
        />

        <Stat
          label="Issues"
          value={issues}
          tone={
            issues > 0
              ? "danger"
              : "neutral"
          }
        />
      </div>
    </section>
  );
}
