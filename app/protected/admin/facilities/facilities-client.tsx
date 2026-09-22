"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Outlet = {
  id: string;
  code: string;
  name: string;
  timezone?: string | null;
};

type Facility = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};

type FacilityConfig = {
  id: string;
  outletId: string;
  facilityId: string;
  isAvailable: boolean;
  updatedAt: string;
};

type Blocker = {
  key: string;
  reports: string[];
};

type Props = {
  outlets: Outlet[];
  facilities: Facility[];
  initialConfigurations:
    FacilityConfig[];
  requiredCells:
    Array<{
      outletId: string;
      facilityCode: string;
    }>;
  blockers:
    Blocker[];
};

function configKey(
  outletId: string,
  facilityId: string
) {
  return `${outletId}:${facilityId}`;
}

export function FacilitiesClient({
  outlets,
  facilities,
  initialConfigurations,
  requiredCells,
  blockers,
}: Props) {
  const router =
    useRouter();

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    onlyMissing,
    setOnlyMissing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    pendingKey,
    setPendingKey,
  ] =
    useState<
      string | null
    >(null);

  const [
    configurationMap,
    setConfigurationMap,
  ] =
    useState<
      Record<
        string,
        FacilityConfig
      >
    >(() => {
      const next:
        Record<
          string,
          FacilityConfig
        > = {};

      for (
        const config
        of initialConfigurations
      ) {
        next[
          configKey(
            config.outletId,
            config.facilityId
          )
        ] =
          config;
      }

      return next;
    });

  const requiredSet =
    new Set<string>(
      (
        requiredCells ??
        []
      ).map(
        (cell) =>
          `${cell.outletId}:${String(
            cell.facilityCode
          )
            .trim()
            .toUpperCase()}`
      )
    );

  const blockerMap =
    useMemo(
      () =>
        new Map(
          blockers.map(
            (item) => [
              item.key,
              item,
            ]
          )
        ),
      [
        blockers,
      ]
    );

  const requiredTotal =
    requiredSet.size;

  const requiredConfigured =
    Array.from(
      requiredSet
    ).filter(
      (key) =>
        Boolean(
          configurationMap[
            key
          ]
        )
    ).length;

  const requiredMissing =
    Math.max(
      0,
      requiredTotal -
        requiredConfigured
    );

  const lockedCount =
    blockerMap.size;

  const filteredOutlets =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      return outlets.filter(
        (outlet) => {
          if (
            needle &&
            !`${outlet.code} ${outlet.name}`
              .toLowerCase()
              .includes(
                needle
              )
          ) {
            return false;
          }

          if (
            onlyMissing
          ) {
            return facilities.some(
              (facility) => {
                const key =
                  configKey(
                    outlet.id,
                    facility.id
                  );

                return (
                  requiredSet.has(
                    key
                  ) &&
                  !configurationMap[
                    key
                  ]
                );
              }
            );
          }

          return true;
        }
      );
    }, [
      search,
      onlyMissing,
      outlets,
      facilities,
      requiredSet,
      configurationMap,
    ]);

  async function updateFacility(
    outlet: Outlet,
    facility: Facility,
    nextValue: boolean
  ) {
    const key =
      configKey(
        outlet.id,
        facility.id
      );

    const blocker =
      blockerMap.get(
        key
      );

    if (
      blocker
    ) {
      setError(
        `Facility is locked by unfinished report: ${blocker.reports.join(
          ", "
        )}`
      );

      return;
    }

    const current =
      configurationMap[
        key
      ] ??
      null;

    const nextLabel =
      nextValue
        ? "Available"
        : "Not Available";

    const confirmed =
      window.confirm(
        `${outlet.code} · ${facility.name}\n\nSet to ${nextLabel}?\n\nThis affects future operation sessions.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setPendingKey(
      key
    );

    try {
      const response =
        await fetch(
          `/api/admin/outlet-facilities/${encodeURIComponent(
            outlet.id
          )}/${encodeURIComponent(
            facility.id
          )}`,
          {
            method:
              "PATCH",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  isAvailable:
                    nextValue,
                  expectedUpdatedAt:
                    current?.updatedAt ??
                    null,
                  reason:
                    "Admin Outlet Facilities",
                }
              ),
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
            "Unable to update facility."
        );
      }

      const row =
        payload?.facility;

      if (
        !row?.id ||
        !row?.updatedAt
      ) {
        throw new Error(
          "Server returned an invalid facility configuration."
        );
      }

      setConfigurationMap(
        (previous) => ({
          ...previous,
          [key]: {
            id:
              String(
                row.id
              ),
            outletId:
              String(
                row.outletId
              ),
            facilityId:
              String(
                row.facilityId
              ),
            isAvailable:
              row.isAvailable ===
              true,
            updatedAt:
              String(
                row.updatedAt
              ),
          },
        })
      );
    } catch (
      updateError
    ) {
      setError(
        updateError instanceof
          Error
          ? updateError.message
          : "Unable to update facility."
      );
    } finally {
      setPendingKey(
        null
      );
    }
  }

  return (
    <div className="mt-7">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outlets"
          value={
            outlets.length
          }
        />

        <StatCard
          label="Required Configured"
          value={
            requiredConfigured
          }
        />

        <StatCard
          label="Required Missing"
          value={
            requiredMissing
          }
          warning={
            requiredMissing >
            0
          }
        />

        <StatCard
          label="Locked"
          value={
            lockedCount
          }
        />
      </div>

      <div className="mt-5 rounded-[22px] border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event
                    .target
                    .value
                )
              }
              placeholder="Search outlet..."
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 sm:max-w-sm"
            />

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={
                  onlyMissing
                }
                onChange={(
                  event
                ) =>
                  setOnlyMissing(
                    event
                      .target
                      .checked
                  )
                }
              />

              Required missing only
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              router.refresh()
            }
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
          <Legend
            label="YES"
            className="bg-emerald-50 text-emerald-700"
          />

          <Legend
            label="NO"
            className="bg-neutral-100 text-neutral-600"
          />

          <Legend
            label="MISSING"
            className="bg-amber-50 text-amber-700"
          />

          <Legend
            label="UNUSED"
            className="bg-slate-50 text-slate-500"
          />

          <Legend
            label="LOCKED"
            className="bg-red-50 text-red-700"
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-neutral-500">
          Required follows the active form version for each
          outlet. Unused facilities are not configuration
          errors. Locked facilities are protected by unfinished
          operational reports.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="sticky left-0 z-20 min-w-[220px] bg-neutral-50 px-4 py-4 text-xs font-black uppercase tracking-wide text-neutral-500">
                  Outlet
                </th>

                {facilities.map(
                  (
                    facility
                  ) => (
                    <th
                      key={
                        facility.id
                      }
                      title={
                        facility.description ??
                        facility.code
                      }
                      className="min-w-[150px] px-3 py-4 text-center"
                    >
                      <div className="text-xs font-black text-neutral-900">
                        {
                          facility.name
                        }
                      </div>

                      <div className="mt-1 text-[10px] font-bold tracking-wide text-neutral-400">
                        {
                          facility.code
                        }
                      </div>
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {filteredOutlets.map(
                (
                  outlet
                ) => (
                  <tr
                    key={
                      outlet.id
                    }
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-4">
                      <div className="text-sm font-black text-neutral-950">
                        {
                          outlet.code
                        }
                      </div>

                      <div className="mt-1 max-w-[200px] truncate text-xs text-neutral-500">
                        {
                          outlet.name
                        }
                      </div>
                    </td>

                    {facilities.map(
                      (
                        facility
                      ) => {
                        const key =
                          configKey(
                            outlet.id,
                            facility.id
                          );

                        const config =
                          configurationMap[
                            key
                          ] ??
                          null;

                        const required =
                          requiredSet.has(
                            `${outlet.id}:${String(
                              facility.code
                            )
                              .trim()
                              .toUpperCase()}`
                          );

                        const blocker =
                          blockerMap.get(
                            key
                          );

                        const pending =
                          pendingKey ===
                          key;

                        const disabled =
                          pending ||
                          Boolean(
                            blocker
                          );

                        const title =
                          blocker
                            ? `Locked by ${blocker.reports.join(
                                ", "
                              )}`
                            : config
                              ? `Updated ${config.updatedAt}`
                              : required
                                ? "Required by active form version"
                                : "Not used by active form version";

                        return (
                          <td
                            key={
                              facility.id
                            }
                            className="px-3 py-3 text-center"
                          >
                            <div
                              title={
                                title
                              }
                              className="flex min-h-[58px] flex-col items-center justify-center gap-1.5"
                            >
                              {config ? (
                                <button
                                  type="button"
                                  disabled={
                                    disabled
                                  }
                                  onClick={() =>
                                    updateFacility(
                                      outlet,
                                      facility,
                                      !config.isAvailable
                                    )
                                  }
                                  className={`inline-flex min-w-[74px] items-center justify-center rounded-full px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    config.isAvailable
                                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                  }`}
                                >
                                  {pending
                                    ? "..."
                                    : config.isAvailable
                                      ? "YES"
                                      : "NO"}
                                </button>
                              ) : required ? (
                                <>
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                    MISSING
                                  </span>

                                  {!blocker && (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        disabled={
                                          pending
                                        }
                                        onClick={() =>
                                          updateFacility(
                                            outlet,
                                            facility,
                                            true
                                          )
                                        }
                                        className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-black text-emerald-700 disabled:opacity-50"
                                      >
                                        YES
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          pending
                                        }
                                        onClick={() =>
                                          updateFacility(
                                            outlet,
                                            facility,
                                            false
                                          )
                                        }
                                        className="rounded-lg border border-neutral-200 px-2 py-1 text-[10px] font-black text-neutral-600 disabled:opacity-50"
                                      >
                                        NO
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                  UNUSED
                                </span>
                              )}

                              {blocker ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-black text-red-700">
                                  LOCKED
                                </span>
                              ) : !required &&
                                config ? (
                                <span className="text-[9px] font-bold text-slate-400">
                                  UNUSED
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      }
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>

          {!filteredOutlets.length && (
            <div className="px-6 py-12 text-center text-sm text-neutral-500">
              No outlets match the current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-black/5 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${
          warning
            ? "text-amber-600"
            : "text-neutral-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Legend({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${className}`}
    >
      {label}
    </span>
  );
}
