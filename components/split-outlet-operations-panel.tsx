import Link from "next/link";

import CompletedReportActions from "@/components/completed-report-actions";

import type {
  SplitOutletOperationCard,
} from "@/lib/operations/load-split-outlet-dashboard";

function statusClass(
  status:
    SplitOutletOperationCard["status"]
) {
  if (
    status === "COMPLETED"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    status === "IN PROGRESS"
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

export default function SplitOutletOperationsPanel({
  cards,
  outletName,
}: {
  cards:
    SplitOutletOperationCard[];
  outletName: string;
}) {
  if (!cards.length) {
    return null;
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-sm md:mt-6 md:rounded-[22px]">
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-700">
          Outlet Operations
        </p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-neutral-950 sm:text-xl">
          Opening & Closing
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-neutral-500 sm:text-sm">
          {outletName} · active forms based on assignment and your operation access.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 md:p-6">
        {cards.map(
          card => {
            const canOpen =
              card.status ===
                "COMPLETED" ||
              card.canFill;

            const action =
              card.status ===
              "COMPLETED"
                ? "View Report"
                : card.status ===
                    "IN PROGRESS"
                  ? "Resume"
                  : "Start";

            return (
              <article
                key={
                  card.formCode
                }
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                        {
                          card.area
                        }
                      </p>
                      <h3 className="mt-1 text-base font-black text-neutral-950">
                        {
                          card.title
                        }
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(
                        card.status
                      )}`}
                    >
                      {
                        card.status
                      }
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-neutral-500">
                    {
                      card.description
                    }
                  </p>

                  {card
                    .reportNumber ? (
                    <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                        Today's Report
                      </p>
                      <p className="mt-1 break-all text-xs font-bold text-neutral-800">
                        {
                          card.reportNumber
                        }
                      </p>
                    </div>
                  ) : null}
                </div>

                {card.status ===
                  "COMPLETED" &&
                card.reportId ? (
                  <CompletedReportActions
                    reportId={
                      card.reportId
                    }
                    title={
                      card.title
                    }
                    hasPdf={
                      card.hasPdf
                    }
                  />
                ) : canOpen ? (
                  <Link
                    href={
                      card.href
                    }
                    className="flex items-center justify-between border-t border-red-100 bg-red-50 px-4 py-3.5 text-sm font-black text-red-700 transition hover:bg-red-100 sm:px-5"
                  >
                    <span>
                      {action}{" "}
                      {
                        card.title
                      }
                    </span>
                    <span>
                      →
                    </span>
                  </Link>
                ) : (
                  <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3.5 text-xs font-semibold text-neutral-400 sm:px-5">
                    Fill access is required to open this operation.
                  </div>
                )}
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}
