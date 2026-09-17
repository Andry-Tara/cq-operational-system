"use client";

import { useMemo, useState } from "react";

export type AuditorOutletCard = {
  id: string;
  code: string;
  name: string;

  status:
    | "not_started"
    | "draft"
    | "submitted";

  sessionId: string | null;
  latestSubmittedSessionId: string | null;

  auditNumber: string | null;

  findingCount: number;
  draftFindingCount: number;
  todayFindingCount: number;

  submittedToday: number;
  submittedFindingsToday: number;
  todayPenalty: number;

  monthlyScore: number;

  startedAt: string | null;
  submittedAt: string | null;
};

export type AuditorRecentAudit = {
  sessionId: string;
  auditNumber: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  findingCount: number;
  submittedAt: string | null;
};

function statusLabel(
  status: AuditorOutletCard["status"],
) {
  if (status === "draft") {
    return "IN PROGRESS";
  }

  if (status === "submitted") {
    return "SUBMITTED";
  }

  return "NOT STARTED";
}

function statusClass(
  status: AuditorOutletCard["status"],
) {
  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "submitted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-500";
}

function timeLabel(
  value: string | null,
) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(
      new Date(value),
    );
  } catch {
    return "";
  }
}

export function AuditorDashboard({
  auditorName,
  dateLabel,
  outlets,
  recentAudits,
}: {
  auditorName: string;
  dateLabel: string;
  outlets: AuditorOutletCard[];
  recentAudits: AuditorRecentAudit[];
}) {
  const [
    busyKey,
    setBusyKey,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const metrics =
    useMemo(
      () => ({
        total:
          outlets.length,

        completed:
          outlets.filter(
            (row) =>
              row.status ===
              "submitted",
          ).length,

        inProgress:
          outlets.filter(
            (row) =>
              row.status ===
              "draft",
          ).length,

        notStarted:
          outlets.filter(
            (row) =>
              row.status ===
              "not_started",
          ).length,

        findings:
          outlets.reduce(
            (
              total,
              row,
            ) =>
              total +
              row.todayFindingCount,
            0,
          ),
      }),
      [outlets],
    );

  async function activateOutlet(
    outletId: string,
  ) {
    const response =
      await fetch(
        "/api/outlet/select",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "same-origin",

          cache:
            "no-store",

          body:
            JSON.stringify({
              outletId,
            }),
        },
      );

    const payload =
      await response
        .json()
        .catch(
          () => ({}),
        );

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          "Unable to select outlet.",
      );
    }
  }

  async function openAudit(
    row: AuditorOutletCard,
  ) {
    if (busyKey) return;

    const key =
      `audit:${row.id}`;

    try {
      setBusyKey(key);
      setError(null);

      await activateOutlet(
        row.id,
      );

      const response =
        await fetch(
          "/api/audit/session",
          {
            method: "POST",
            credentials:
              "same-origin",
            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to open audit.",
        );
      }

      window.location.assign(
        "/protected/audit",
      );
    } catch (
      exception: any
    ) {
      setError(
        exception?.message ||
          "Unable to open audit.",
      );

      setBusyKey(null);
    }
  }

  async function openResult(
    outletId: string,
    sessionId: string,
    key: string,
  ) {
    if (busyKey) return;

    try {
      setBusyKey(key);
      setError(null);

      await activateOutlet(
        outletId,
      );

      window.location.assign(
        `/protected/audit/${sessionId}`,
      );
    } catch (
      exception: any
    ) {
      setError(
        exception?.message ||
          "Unable to open audit result.",
      );

      setBusyKey(null);
    }
  }

  function openHistory(
    outletId?: string,
  ) {
    if (outletId) {
      window.location.assign(
        `/protected/audit/history?outlet=${outletId}`,
      );

      return;
    }

    window.location.assign(
      "/protected/audit/history",
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
      <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-8 sm:px-6 md:pt-10 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Outlet Audit
            </p>

            <h1 className="mt-1.5 text-3xl font-black tracking-tight md:text-4xl">
              Today&apos;s Audit
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {dateLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Auditor
            </p>

            <p className="mt-1 text-sm font-bold">
              {auditorName}
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric
            label="Assigned"
            value={
              metrics.total
            }
            sub="Outlets"
          />

          <Metric
            label="Completed"
            value={
              metrics.completed
            }
            sub="Today"
            tone="success"
          />

          <Metric
            label="In Progress"
            value={
              metrics.inProgress
            }
            sub="Today"
            tone="warning"
          />

          <Metric
            label="Not Started"
            value={
              metrics.notStarted
            }
            sub="Today"
          />

          <Metric
            label="Findings"
            value={
              metrics.findings
            }
            sub="Today"
            tone="danger"
          />
        </section>

        <section className="mt-5 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                Assigned Outlets
              </p>

              <h2 className="mt-1 text-xl font-black">
                Today&apos;s Work
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                openHistory()
              }
              className="w-fit text-xs font-bold text-neutral-500 transition hover:text-red-700"
            >
              View All History →
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {outlets.map(
              (row) => {
                const loading =
                  busyKey ===
                    `audit:${row.id}` ||
                  busyKey ===
                    `result:${row.id}`;

                return (
                  <article
                    key={
                      row.id
                    }
                    className="px-5 py-5 sm:px-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xs font-black text-red-700">
                          {
                            row.code
                          }
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black">
                              {
                                row.name
                              }
                            </h3>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-black tracking-wide ${statusClass(
                                row.status,
                              )}`}
                            >
                              {statusLabel(
                                row.status,
                              )}
                            </span>
                          </div>

                          {row.auditNumber && (
                            <p className="mt-1 text-xs text-neutral-400">
                              {
                                row.auditNumber
                              }
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                            <span className="font-bold text-neutral-700">
                              Monthly Score{" "}
                              <strong className="text-base text-neutral-900">
                                {
                                  row.monthlyScore
                                }
                                /100
                              </strong>
                            </span>

                            <span className="text-neutral-500">
                              {
                                row.submittedToday
                              }{" "}
                              submitted audit
                              {row.submittedToday ===
                              1
                                ? ""
                                : "s"}{" "}
                              today
                            </span>

                            <span className="text-neutral-500">
                              {
                                row.submittedFindingsToday
                              }{" "}
                              submitted finding
                              {row.submittedFindingsToday ===
                              1
                                ? ""
                                : "s"}
                            </span>

                            {row.todayPenalty >
                              0 && (
                              <span className="font-bold text-red-700">
                                -
                                {
                                  row.todayPenalty
                                }{" "}
                                pts today
                              </span>
                            )}
                          </div>

                          {row.status ===
                            "draft" && (
                            <p className="mt-2 text-xs font-semibold text-amber-700">
                              Draft in
                              progress ·{" "}
                              {
                                row.draftFindingCount
                              }{" "}
                              finding
                              {row.draftFindingCount ===
                              1
                                ? ""
                                : "s"}
                            </p>
                          )}

                          {row.status ===
                            "submitted" &&
                            row.submittedAt && (
                              <p className="mt-2 text-xs text-neutral-400">
                                Latest
                                submitted{" "}
                                {timeLabel(
                                  row.submittedAt,
                                )}
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {row.status ===
                        "draft" ? (
                          <button
                            type="button"
                            disabled={
                              busyKey !==
                              null
                            }
                            onClick={() =>
                              openAudit(
                                row,
                              )
                            }
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                          >
                            {loading
                              ? "Opening..."
                              : "Continue Audit"}
                          </button>
                        ) : row.status ===
                            "submitted" &&
                          row.latestSubmittedSessionId ? (
                          <>
                            <button
                              type="button"
                              disabled={
                                busyKey !==
                                null
                              }
                              onClick={() =>
                                openResult(
                                  row.id,
                                  row.latestSubmittedSessionId!,
                                  `result:${row.id}`,
                                )
                              }
                              className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                            >
                              {busyKey ===
                              `result:${row.id}`
                                ? "Opening..."
                                : "View Latest"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                busyKey !==
                                null
                              }
                              onClick={() =>
                                openAudit(
                                  row,
                                )
                              }
                              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
                            >
                              New Audit
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              busyKey !==
                              null
                            }
                            onClick={() =>
                              openAudit(
                                row,
                              )
                            }
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                          >
                            {loading
                              ? "Opening..."
                              : "Start Audit"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={
                            busyKey !==
                            null
                          }
                          onClick={() =>
                            openHistory(
                              row.id,
                            )
                          }
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
                        >
                          History
                        </button>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-end justify-between gap-3 border-b border-neutral-100 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                History
              </p>

              <h2 className="mt-1 text-xl font-black">
                Recent Audits
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                openHistory()
              }
              className="text-xs font-bold text-neutral-500 hover:text-red-700"
            >
              View All →
            </button>
          </div>

          {!recentAudits.length ? (
            <div className="px-6 py-12 text-center text-sm text-neutral-400">
              No submitted
              audit history yet.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentAudits.map(
                (audit) => (
                  <button
                    key={
                      audit.sessionId
                    }
                    type="button"
                    disabled={
                      busyKey !==
                      null
                    }
                    onClick={() =>
                      openResult(
                        audit.outletId,
                        audit.sessionId,
                        `recent:${audit.sessionId}`,
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60 sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">
                          {
                            audit.outletName
                          }
                        </p>

                        <span className="text-xs text-neutral-400">
                          {
                            audit.auditNumber
                          }
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-neutral-500">
                        {
                          audit.findingCount
                        }{" "}
                        finding
                        {audit.findingCount ===
                        1
                          ? ""
                          : "s"}

                        {audit.submittedAt
                          ? ` · ${timeLabel(
                              audit.submittedAt,
                            )}`
                          : ""}
                      </p>
                    </div>

                    <span className="shrink-0 text-lg text-neutral-300">
                      →
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number;
  sub: string;

  tone?:
    | "default"
    | "success"
    | "warning"
    | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50/70"
      : tone ===
          "warning"
        ? "border-amber-100 bg-amber-50/70"
        : tone ===
            "danger"
          ? "border-red-100 bg-red-50/70"
          : "border-neutral-200 bg-white";

  const numberClass =
    tone === "success"
      ? "text-emerald-700"
      : tone ===
          "warning"
        ? "text-amber-700"
        : tone ===
            "danger"
          ? "text-red-700"
          : "text-neutral-900";

  return (
    <div
      className={`rounded-[20px] border p-4 shadow-sm ${toneClass}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black tracking-tight ${numberClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-neutral-500">
        {sub}
      </p>
    </div>
  );
}
