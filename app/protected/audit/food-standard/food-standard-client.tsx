"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import FoodQualityAssessmentButton from "./food-quality-assessment";

type SessionItem = {
  id: string;
  menu_id: string;
  round_no: number;
  sequence_no: number;
  state:
    | "SELECTED"
    | "RUNNING"
    | "SERVED"
    | "ASSESSED"
    | "VOIDED";
  menu_name_snapshot: string;
  category_snapshot:
    | string
    | null;
  service_standard_seconds: number;
  selected_at: string;
  started_at:
    | string
    | null;
  served_at:
    | string
    | null;
  service_seconds:
    | number
    | null;
  service_status:
    | "STANDARD"
    | "LATE"
    | null;
};

type QaScoringSnapshot = {
  scoring_version?: number;
  max_score?: number;
  score?: number;
  points_lost?: number;
  menu_count?: number;
  standard_menu_count?: number;
  needs_correction_count?: number;
  on_time_count?: number;
  late_count?: number;
};


type Session = {
  id: string;
  outlet_id: string;
  business_date: string;
  status: string;
  target_menu_count: number;
  result_status:
    | string
    | null;


  qa_number:
    | string
    | null;

  score:
    | number
    | null;

  max_score:
    | number
    | null;

  scoring_snapshot:
    | QaScoringSnapshot
    | null;
auditor_name_snapshot: string;
  started_at: string;
  finalized_at:
    | string
    | null;
  created_at: string;

  item_count: number;
  assessed_count: number;
  running_count: number;
  late_count: number;

  items?: SessionItem[];
};

type MenuOption = {
  id: string;
  name: string;
  category: string;
  source: string;
  source_menu_key: string;
  service_standard_seconds: number;
};

function formatDuration(
  seconds:
    | number
    | null
    | undefined,
) {
  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          seconds ||
            0,
        ),
      ),
    );

  const minutes =
    Math.floor(
      value / 60,
    );

  const remainder =
    value % 60;

  return `${String(
    minutes,
  ).padStart(
    2,
    "0",
  )}:${String(
    remainder,
  ).padStart(
    2,
    "0",
  )}`;
}

function elapsedSeconds(
  startedAt: string,
  nowMs: number,
) {
  return Math.max(
    0,
    Math.floor(
      (
        nowMs -
        new Date(
          startedAt,
        ).getTime()
      ) /
        1000,
    ),
  );
}

function sessionApiUrl() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "/api/audit/food-standard/session";
  }

  const sessionId =
    new URLSearchParams(
      window.location.search,
    ).get(
      "session_id",
    );

  return sessionId
    ? `/api/audit/food-standard/session?session_id=${encodeURIComponent(
        sessionId,
      )}`
    : "/api/audit/food-standard/session";
}


export default function FoodStandardClient({
  outlet,
}: {
  outlet: {
    id: string;
    code: string;
    name: string;
  };
}) {
  const [
    session,
    setSession,
  ] =
    useState<
      Session | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    starting,
    setStarting,
  ] =
    useState(
      false,
    );

  const [
    finalizing,
    setFinalizing,
  ] =
    useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false,
    );

  const [
    menuLoading,
    setMenuLoading,
  ] =
    useState(
      false,
    );

  const [
    menuOptions,
    setMenuOptions,
  ] =
    useState<
      MenuOption[]
    >(
      [],
    );

  const [
    selectedMenuIds,
    setSelectedMenuIds,
  ] =
    useState<
      string[]
    >(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  const [
    category,
    setCategory,
  ] =
    useState(
      "ALL",
    );

  const [
    adding,
    setAdding,
  ] =
    useState(
      false,
    );

  const [
    itemActionId,
    setItemActionId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    nowMs,
    setNowMs,
  ] =
    useState(
      Date.now(),
    );

  async function loadSession() {
    const response =
      await fetch(
        sessionApiUrl(),
        {
          method:
            "GET",
          cache:
            "no-store",
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        payload?.error ||
          "Unable to load QA session.",
      );
    }

    setSession(
      payload.session ||
        null,
    );

    return (
      payload.session ||
      null
    );
  }

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        try {
          const response =
            await fetch(
              sessionApiUrl(),
              {
                method:
                  "GET",
                cache:
                  "no-store",
              },
            );

          const payload =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              payload?.error ||
                "Unable to load QA session.",
            );
          }

          if (active) {
            setSession(
              payload.session ||
                null,
            );
          }
        } catch (
          loadError: any
        ) {
          if (active) {
            setError(
              loadError
                ?.message ||
                "Unable to load QA session.",
            );
          }
        } finally {
          if (active) {
            setLoading(
              false,
            );
          }
        }
      }

      load();

      return () => {
        active =
          false;
      };
    },
    [],
  );

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            setNowMs(
              Date.now(),
            );
          },
          1000,
        );

      return () =>
        window.clearInterval(
          timer,
        );
    },
    [],
  );

  const items =
    useMemo(
      () =>
        [
          ...(
            session?.items ??
            []
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            Number(
              a.sequence_no ||
                0,
            ) -
            Number(
              b.sequence_no ||
                0,
            ),
        ),
      [
        session,
      ],
    );

  const progress =
    useMemo(
      () => {
        if (!session) {
          return 0;
        }

        const target =
          Number(
            session
              .target_menu_count ||
              10,
          );

        if (
          target <= 0
        ) {
          return 0;
        }

        return Math.min(
          100,
          Math.round(
            (
              Number(
                session
                  .assessed_count ||
                  0,
              ) /
              target
            ) *
              100,
          ),
        );
      },
      [
        session,
      ],
    );

  const categories =
    useMemo(
      () => [
        "ALL",
        ...Array.from(
          new Set(
            menuOptions
              .map(
                (
                  menu,
                ) =>
                  menu.category ||
                  "OTHER",
              )
              .filter(
                Boolean,
              ),
          ),
        ).sort(),
      ],
      [
        menuOptions,
      ],
    );

  const filteredMenus =
    useMemo(
      () => {
        const q =
          search
            .trim()
            .toLowerCase();

        return menuOptions.filter(
          (
            menu,
          ) => {
            if (
              category !==
                "ALL" &&
              menu.category !==
                category
            ) {
              return false;
            }

            if (!q) {
              return true;
            }

            return (
              menu.name
                .toLowerCase()
                .includes(
                  q,
                ) ||
              menu.category
                .toLowerCase()
                .includes(
                  q,
                )
            );
          },
        );
      },
      [
        menuOptions,
        search,
        category,
      ],
    );

  const remainingSlots =
    session
      ? Math.max(
          0,
          Number(
            session
              .target_menu_count ||
              10,
          ) -
            Number(
              session
                .item_count ||
                0,
            ),
        )
      : 0;

  const selectionLimit =
    Math.min(
      4,
      remainingSlots,
    );

  async function startSession() {
    if (
      starting
    ) {
      return;
    }

    setStarting(
      true,
    );
    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/audit/food-standard/session",
          {
            method:
              "POST",
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to start QA session.",
        );
      }

      await loadSession();
    } catch (
      startError: any
    ) {
      setError(
        startError
          ?.message ||
          "Unable to start QA session.",
      );
    } finally {
      setStarting(
        false,
      );
    }
  }

  async function openMenuPanel() {
    if (
      !session ||
      remainingSlots <=
        0
    ) {
      return;
    }

    setAddOpen(
      true,
    );
    setMenuLoading(
      true,
    );
    setSelectedMenuIds(
      [],
    );
    setSearch(
      "",
    );
    setCategory(
      "ALL",
    );
    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/audit/food-standard/menus",
          {
            method:
              "GET",
            cache:
              "no-store",
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to load QA menus.",
        );
      }

      setMenuOptions(
        payload.menus ||
          [],
      );
    } catch (
      menuError: any
    ) {
      setError(
        menuError
          ?.message ||
          "Unable to load QA menus.",
      );
    } finally {
      setMenuLoading(
        false,
      );
    }
  }

  function toggleMenu(
    menuId: string,
  ) {
    setSelectedMenuIds(
      (
        current,
      ) => {
        if (
          current.includes(
            menuId,
          )
        ) {
          return current.filter(
            (
              id,
            ) =>
              id !==
              menuId,
          );
        }

        if (
          current.length >=
          selectionLimit
        ) {
          return current;
        }

        return [
          ...current,
          menuId,
        ];
      },
    );
  }

  async function addMenus() {
    if (
      selectedMenuIds.length <
        1 ||
      adding
    ) {
      return;
    }

    setAdding(
      true,
    );
    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/audit/food-standard/menus",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  menu_ids:
                    selectedMenuIds,
                },
              ),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to add QA menus.",
        );
      }

      setAddOpen(
        false,
      );
      setSelectedMenuIds(
        [],
      );

      await loadSession();
    } catch (
      addError: any
    ) {
      setError(
        addError
          ?.message ||
          "Unable to add QA menus.",
      );
    } finally {
      setAdding(
        false,
      );
    }
  }

  async function startTimer(
    itemId: string,
  ) {
    if (
      itemActionId
    ) {
      return;
    }

    setItemActionId(
      itemId,
    );
    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/start`,
          {
            method:
              "POST",
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to start timer.",
        );
      }

      await loadSession();
      setNowMs(
        Date.now(),
      );
    } catch (
      actionError: any
    ) {
      setError(
        actionError
          ?.message ||
          "Unable to start timer.",
      );
    } finally {
      setItemActionId(
        null,
      );
    }
  }

  async function markServed(
    itemId: string,
  ) {
    if (
      itemActionId
    ) {
      return;
    }

    setItemActionId(
      itemId,
    );
    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/served`,
          {
            method:
              "POST",
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to mark served.",
        );
      }

      await loadSession();
    } catch (
      actionError: any
    ) {
      setError(
        actionError
          ?.message ||
          "Unable to mark served.",
      );
    } finally {
      setItemActionId(
        null,
      );
    }
  }


  async function finalizeSession() {
    if (
      !session ||
      finalizing
    ) {
      return;
    }

    if (
      session.item_count !==
        session.target_menu_count ||
      session.assessed_count !==
        session.target_menu_count
    ) {
      setError(
        "All 10 menus must be completed before finalization.",
      );

      return;
    }

    setFinalizing(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/audit/food-standard/session/finalize",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                session_id:
                  session.id,
              }),
          },
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to finalize QA Food assessment.",
        );
      }

      window.location.href =
        `/protected/audit/food-standard?session_id=${encodeURIComponent(
          session.id,
        )}`;

    } catch (
      finalizeError: any
    ) {
      setError(
        finalizeError
          ?.message ||
          "Unable to finalize QA Food assessment.",
      );

      setFinalizing(
        false,
      );
    }
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm font-bold text-neutral-500">
          Checking active QA session...
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mt-6">
        <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#292824] text-lg font-black text-white">
            QA
          </div>

          <h3 className="mt-4 text-lg font-black text-[#292824]">
            Start QA Food Standard
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
            Mulai satu QA session untuk{" "}
            {outlet.name}. Session akan
            tetap tersimpan jika halaman
            direfresh atau dibuka kembali.
          </p>

          {error && (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={
              starting
            }
            onClick={
              startSession
            }
            className="mt-6 inline-flex h-12 min-w-[210px] items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting
              ? "Starting..."
              : "Start QA Session"}
          </button>
        </div>
      </div>
    );
  }


  if (
    session.status ===
    "FINALIZED"
  ) {
    const snapshot =
      session.scoring_snapshot ||
      {};

    const score =
      Number(
        session.score ??
        snapshot.score ??
        0,
      );

    const maxScore =
      Number(
        session.max_score ??
        snapshot.max_score ??
        100,
      );

    const pointsLost =
      Number(
        snapshot.points_lost ??
        Math.max(
          0,
          maxScore -
            score,
        ),
      );

    return (
      <div className="mt-6">
        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                QA Assessment Finalized
              </div>

              <h3 className="mt-3 text-xl font-black text-[#292824]">
                QA Food Standard Result
              </h3>

              <p className="mt-2 text-sm text-neutral-500">
                {outlet.name}
                {" · "}
                {session.business_date}
                {" · "}
                {session.auditor_name_snapshot}
              </p>

              {session.qa_number ? (
                <p className="mt-2 font-mono text-xs font-bold text-neutral-400">
                  {session.qa_number}
                </p>
              ) : null}
            </div>

            <div className="min-w-[160px] rounded-[22px] bg-[#292824] px-5 py-4 text-center text-white">

              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/60">
                QA SCORE
              </p>

              <p className="mt-1 text-3xl font-black">
                {score}
                <span className="text-base text-white/60">
                  /{maxScore}
                </span>
              </p>

            </div>
          </div>


          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">

            <RuntimeMetric
              label="Points Lost"
              value={`-${pointsLost}`}
            />

            <RuntimeMetric
              label="Standard Menu"
              value={`${Number(
                snapshot.standard_menu_count ??
                0,
              )}/10`}
            />

            <RuntimeMetric
              label="Needs Correction"
              value={`${Number(
                snapshot.needs_correction_count ??
                0,
              )}/10`}
            />

            <RuntimeMetric
              label="On Time"
              value={`${Number(
                snapshot.on_time_count ??
                0,
              )}/10`}
            />

            <RuntimeMetric
              label="Late"
              value={`${Number(
                snapshot.late_count ??
                0,
              )}/10`}
            />

          </div>


          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">

            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
              Final Result
            </p>

            <p className={[
              "mt-1 text-sm font-black",
              session.result_status ===
              "PASS"
                ? "text-emerald-700"
                : "text-amber-700",
            ].join(" ")}>
              {session.result_status ===
              "PASS"
                ? "FULL STANDARD"
                : "NEEDS CORRECTION"}
            </p>

          </div>



          <div className="mt-6 flex flex-col gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:flex-wrap">

            <a
              href="/protected/audit/food-standard/history"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-700"
            >
              History
            </a>

            <a
              href={`/protected/audit/food-standard/report/${session.id}`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-black text-white"
            >
              View Report
            </a>

            <a
              href={`/api/audit/food-standard/${session.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-900 bg-white px-5 text-sm font-black text-neutral-900"
            >
              PDF
            </a>

          </div>

</section>
      </div>
    );
  }


  return (
    <>
      <div className="mt-6">
        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                QA Session Open
              </div>

              <h3 className="mt-3 text-xl font-black text-[#292824]">
                {session.assessed_count} /{" "}
                {session.target_menu_count} Menu Completed
              </h3>

              <p className="mt-2 text-sm text-neutral-500">
                {outlet.name}
                {" · "}
                {session.business_date}
                {" · "}
                {session.auditor_name_snapshot}
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
                Progress
              </p>

              <p className="mt-1 text-lg font-black text-[#292824]">
                {progress}%
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#292824] transition-all"
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <RuntimeMetric
              label="Selected"
              value={`${session.item_count}/${session.target_menu_count}`}
            />

            <RuntimeMetric
              label="Completed"
              value={
                session.assessed_count
              }
            />

            <RuntimeMetric
              label="Running"
              value={
                session.running_count
              }
            />

            <RuntimeMetric
              label="Late"
              value={
                session.late_count
              }
            />
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {items.length >
            0 && (
            <div className="mt-6 space-y-3 border-t border-neutral-100 pt-6">
              {items.map(
                (
                  item,
                ) => (
                  <MenuRuntimeCard
                    key={
                      item.id
                    }
                    item={
                      item
                    }
                    nowMs={
                      nowMs
                    }
                    busy={
                      itemActionId ===
                      item.id
                    }
                    onStart={() =>
                      startTimer(
                        item.id,
                      )
                    }
                    onServed={() =>
                      markServed(
                        item.id,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}

          <div className="mt-6 border-t border-neutral-100 pt-5">

            {session.item_count ===
              session.target_menu_count &&
            session.assessed_count ===
              session.target_menu_count ? (

              <div className="mb-5 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">

                <div>
                  <p className="text-sm font-black text-emerald-900">
                    10 / 10 Menu Completed
                  </p>

                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    All menu assessments are complete. Finalize to lock the QA score.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    finalizing
                  }
                  onClick={
                    finalizeSession
                  }
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-700 px-6 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto"
                >
                  {finalizing
                    ? "Finalizing..."
                    : "Finalize Assessment"}
                </button>

              </div>

            ) : null}

            <button
              type="button"
              disabled={
                remainingSlots <=
                  0
              }
              onClick={
                openMenuPanel
              }
              className="inline-flex h-12 min-w-[190px] items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
            >
              + Add Menu Test
            </button>

            <p className="mt-3 text-xs leading-5 text-neutral-400">
              Maksimal 4 menu per order round.
              Total akhir session adalah 10 menu unik.
            </p>
          </div>
        </section>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-5">
          <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[28px] sm:border sm:border-neutral-200">
            <div className="shrink-0 flex items-start justify-between border-b border-neutral-100 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  New Order Round
                </p>

                <h3 className="mt-1 text-xl font-black text-[#292824]">
                  Add Menu Test
                </h3>

                <p className="mt-1 text-sm text-neutral-500">
                  Select 1–{selectionLimit} menu ·{" "}
                  {remainingSlots} slot remaining
                </p>
              </div>

              <button
                type="button"
                disabled={
                  adding
                }
                onClick={() =>
                  setAddOpen(
                    false,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-lg font-black text-neutral-500"
              >
                ×
              </button>
            </div>

            <div className="shrink-0 border-b border-neutral-100 p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <input
                  value={
                    search
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder="Search menu..."
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 outline-none focus:border-neutral-500"
                />

                <select
                  value={
                    category
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setCategory(
                        event
                          .target
                          .value,
                      )
                  }
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 outline-none"
                >
                  {categories.map(
                    (
                      value,
                    ) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {value ===
                        "ALL"
                          ? "All Categories"
                          : value}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-8 sm:p-5">
              {menuLoading ? (
                <div className="py-12 text-center text-sm font-bold text-neutral-400">
                  Loading menus...
                </div>
              ) : filteredMenus.length ===
                0 ? (
                <div className="py-12 text-center text-sm font-bold text-neutral-400">
                  No available menu found.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredMenus.map(
                    (
                      menu,
                    ) => {
                      const checked =
                        selectedMenuIds.includes(
                          menu.id,
                        );

                      const disabled =
                        !checked &&
                        selectedMenuIds.length >=
                          selectionLimit;

                      return (
                        <button
                          key={
                            menu.id
                          }
                          type="button"
                          disabled={
                            disabled
                          }
                          onClick={() =>
                            toggleMenu(
                              menu.id,
                            )
                          }
                          className={[
                            "flex items-start gap-3 rounded-[18px] border p-4 text-left transition",
                            checked
                              ? "border-[#292824] bg-neutral-50"
                              : "border-neutral-200 bg-white hover:border-neutral-400",
                            disabled
                              ? "cursor-not-allowed opacity-35"
                              : "",
                          ].join(
                            " ",
                          )}
                        >
                          <span
                            className={[
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-black",
                              checked
                                ? "border-[#292824] bg-[#292824] text-white"
                                : "border-neutral-300 bg-white",
                            ].join(
                              " ",
                            )}
                          >
                            {checked
                              ? "✓"
                              : ""}
                          </span>

                          <span className="min-w-0">
                            <span className="block text-sm font-black text-[#292824]">
                              {menu.name}
                            </span>

                            <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-neutral-400">
                              {menu.category}
                              {" · "}
                              {formatDuration(
                                menu.service_standard_seconds,
                              )}{" "}
                              SLA
                            </span>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div
              className="shrink-0 flex flex-col gap-3 border-t border-neutral-100 bg-white px-5 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-5"
              style={{
                paddingBottom:
                  "max(1rem, env(safe-area-inset-bottom))",
              }}
            >
              <p className="text-sm font-black text-neutral-600">
                {selectedMenuIds.length} selected
              </p>

              <button
                type="button"
                disabled={
                  adding ||
                  selectedMenuIds.length <
                    1
                }
                onClick={
                  addMenus
                }
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[190px]"
              >
                {adding
                  ? "Adding..."
                  : `Add ${selectedMenuIds.length || ""} Menu${selectedMenuIds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuRuntimeCard({
  item,
  nowMs,
  busy,
  onStart,
  onServed,
}: {
  item: SessionItem;
  nowMs: number;
  busy: boolean;
  onStart: () => void;
  onServed: () => void;
}) {
  const runningSeconds =
    item.state ===
      "RUNNING" &&
    item.started_at
      ? elapsedSeconds(
          item.started_at,
          nowMs,
        )
      : null;

  const shownSeconds =
    runningSeconds ??
    item.service_seconds ??
    0;

  const overStandard =
    shownSeconds >
    Number(
      item.service_standard_seconds ||
        780,
    );

  const status =
    item.service_status;

  return (
    <article className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
              Round {item.round_no}
            </span>

            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
              {item.category_snapshot ||
                "Menu"}
            </span>
          </div>

          <h4 className="mt-2 text-base font-black text-[#292824]">
            {item.menu_name_snapshot}
          </h4>

          <p className="mt-1 text-xs font-bold text-neutral-400">
            Standard ≤{" "}
            {formatDuration(
              item.service_standard_seconds,
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {item.state ===
            "SELECTED" && (
            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                onStart
              }
              className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-[#292824] px-5 text-sm font-black text-white disabled:opacity-40"
            >
              {busy
                ? "Starting..."
                : "Start Timer"}
            </button>
          )}

          {item.state ===
            "RUNNING" && (
            <>
              <div
                className={[
                  "min-w-[100px] rounded-xl border px-4 py-2 text-center",
                  overStandard
                    ? "border-red-200 bg-red-50"
                    : "border-emerald-200 bg-emerald-50",
                ].join(
                  " ",
                )}
              >
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
                  Running
                </p>

                <p
                  className={[
                    "mt-0.5 text-xl font-black tabular-nums",
                    overStandard
                      ? "text-red-700"
                      : "text-emerald-700",
                  ].join(
                    " ",
                  )}
                >
                  {formatDuration(
                    shownSeconds,
                  )}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={
                  onServed
                }
                className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-[#292824] px-5 text-sm font-black text-white disabled:opacity-40"
              >
                {busy
                  ? "Saving..."
                  : "Mark Served"}
              </button>
            </>
          )}

          {(item.state ===
            "SERVED" ||
            item.state ===
              "ASSESSED") && (
            <div
              className={[
                "min-w-[150px] rounded-xl border px-4 py-2 text-center",
                status ===
                  "STANDARD"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50",
              ].join(
                " ",
              )}
            >
              <p className="text-lg font-black tabular-nums text-[#292824]">
                {formatDuration(
                  item.service_seconds,
                )}
              </p>

              <p
                className={[
                  "mt-0.5 text-[9px] font-black uppercase tracking-[0.12em]",
                  status ===
                    "STANDARD"
                    ? "text-emerald-700"
                    : "text-red-700",
                ].join(
                  " ",
                )}
              >
                {status ===
                "STANDARD"
                  ? "✓ Standard"
                  : "Late"}
              </p>
            </div>
          )}
        </div>
      </div>

      {item.state ===
        "SERVED" && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <FoodQualityAssessmentButton
            itemId={item.id}
            menuName={item.menu_name_snapshot}
            serviceStatus={item.service_status}
            serviceSeconds={item.service_seconds}
          />
        </div>
      )}

      {item.state ===
        "ASSESSED" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-black text-emerald-700">
            ✓ Quality Assessment Completed
          </div>

          <FoodQualityAssessmentButton
            itemId={item.id}
            menuName={item.menu_name_snapshot}
            serviceStatus={item.service_status}
            serviceSeconds={item.service_seconds}
            buttonLabel="Edit Assessment"
          />
        </div>
      )}
    </article>
  );
}

function RuntimeMetric({
  label,
  value,
}: {
  label: string;
  value:
    string |
    number;
}) {
  return (
    <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-[#292824]">
        {value}
      </p>
    </div>
  );
}
