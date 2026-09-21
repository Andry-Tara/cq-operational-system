"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type Outlet = {
  id:
    string;

  code:
    string;

  name:
    string;

  timezone:
    string;
};


type Branch = {
  external_branch_id:
    number;

  name:
    string;

  address:
    string |
    null;

  phone_number:
    string |
    null;

  external_status:
    number |
    null;

  last_synced_at:
    string;
};


type Mapping = {
  id:
    string;

  external_branch_id:
    number;

  external_branch_name:
    string;

  outlet_id:
    string;

  is_active:
    boolean;
};


type SyncRun = {
  id:
    string;

  sync_type:
    string;

  status:
    string;

  date_from:
    string |
    null;

  date_to:
    string |
    null;

  pages_processed:
    number;

  orders_seen:
    number;

  orders_upserted:
    number;

  items_upserted:
    number;

  unmapped_orders:
    number;

  error_message:
    string |
    null;

  started_at:
    string;

  completed_at:
    string |
    null;
};


export default function PosIntegrationClient({
  configured,
  baseUrl,
  outlets,
  branches,
  mappings,
  syncRuns,
}: {
  configured:
    boolean;

  baseUrl:
    string;

  outlets:
    Outlet[];

  branches:
    Branch[];

  mappings:
    Mapping[];

  syncRuns:
    SyncRun[];
}) {
  const router =
    useRouter();


  const mappingByBranch =
    useMemo(
      () =>
        new Map(
          mappings.map(
            item => [
              Number(
                item.external_branch_id
              ),
              item,
            ]
          )
        ),
      [
        mappings,
      ]
    );


  const [
    selections,
    setSelections,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      Object.fromEntries(
        branches.map(
          branch => [
            String(
              branch.external_branch_id
            ),
            mappingByBranch.get(
              Number(
                branch.external_branch_id
              )
            )
              ?.outlet_id ||
            "",
          ]
        )
      )
    );


  const [
    busy,
    setBusy,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  async function call(
    key:
      string,

    url:
      string,

    body?:
      any
  ) {
    setBusy(
      key
    );

    setMessage(
      null
    );

    setError(
      null
    );


    try {
      const response =
        await fetch(
          url,
          {
            method:
              body ===
                undefined
                ? "GET"
                : "POST",

            headers:
              body ===
                undefined
                ? undefined
                : {
                    "Content-Type":
                      "application/json",
                  },

            body:
              body ===
                undefined
                ? undefined
                : JSON.stringify(
                    body
                  ),
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          payload?.message ||
          "Request failed."
        );
      }


      return payload;

    } catch (
      callError: any
    ) {
      setError(
        callError
          ?.message ||
        "Request failed."
      );

      return null;

    } finally {
      setBusy(
        null
      );
    }
  }


  async function testConnection() {
    const payload =
      await call(
        "health",
        "/api/admin/pos-integration/health"
      );


    if (!payload) {
      return;
    }


    if (!payload.ok) {
      setError(
        payload.message ||
        "POS API connection failed."
      );

      return;
    }


    setMessage(
      `API connected. ${payload.branchCount ?? 0} branches available.`
    );
  }


  async function refreshBranches() {
    const payload =
      await call(
        "branches",
        "/api/admin/pos-integration/branches",
        {}
      );


    if (!payload) {
      return;
    }


    setMessage(
      `${payload.branches ?? 0} POS branches refreshed.`
    );


    router.refresh();
  }


  async function saveMapping(
    branch:
      Branch
  ) {
    const key =
      String(
        branch.external_branch_id
      );


    const outletId =
      selections[
        key
      ] ||
      "";


    const payload =
      await call(
        `mapping-${key}`,
        "/api/admin/pos-integration/mappings",
        outletId
          ? {
              action:
                "SET",

              externalBranchId:
                branch.external_branch_id,

              outletId,
            }
          : {
              action:
                "DELETE",

              externalBranchId:
                branch.external_branch_id,
            }
      );


    if (!payload) {
      return;
    }


    setMessage(
      outletId
        ? `${branch.name} mapping saved.`
        : `${branch.name} mapping removed.`
    );


    router.refresh();
  }


  async function syncOrders() {
    const payload =
      await call(
        "sync",
        "/api/admin/pos-integration/sync",
        {
          lookbackDays:
            3,
        }
      );


    if (!payload) {
      return;
    }


    setMessage(
      `Sync ${payload.status}. ${payload.ordersUpserted} orders and ${payload.itemsUpserted} items processed.`
    );


    router.refresh();
  }


  const mappedCount =
    mappings.filter(
      item =>
        item.is_active
    ).length;


  const latestSync =
    syncRuns.find(
      item =>
        item.sync_type ===
        "ORDERS"
    );


  return (
    <main className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 md:py-9">

      <section className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              External Data Integration
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#292824]">
              POS Integration
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              ChongQing External API · Branch mapping, order synchronization and normalized operational data.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              disabled={
                busy !==
                null
              }
              onClick={
                testConnection
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-[#292824] disabled:opacity-40"
            >
              Test Connection
            </button>


            <button
              type="button"
              disabled={
                busy !==
                null ||
                !configured
              }
              onClick={
                refreshBranches
              }
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-[#292824] disabled:opacity-40"
            >
              Refresh Branches
            </button>


            <button
              type="button"
              disabled={
                busy !==
                null ||
                !configured ||
                mappedCount ===
                  0
              }
              onClick={
                syncOrders
              }
              className="h-11 rounded-xl bg-[#292824] px-5 text-xs font-black text-white disabled:opacity-35"
            >
              Sync Last 3 Days
            </button>

          </div>

        </div>


        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        )}


        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}


        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <Stat
            label="API"
            value={
              configured
                ? "Configured"
                : "Not Configured"
            }
            detail={
              baseUrl ||
              "Environment variables required"
            }
          />


          <Stat
            label="POS Branches"
            value={
              String(
                branches.length
              )
            }
            detail="Cached from external API"
          />


          <Stat
            label="Mapped"
            value={
              `${mappedCount}/${branches.length}`
            }
            detail="POS branches linked to outlets"
          />


          <Stat
            label="Last Orders Sync"
            value={
              latestSync
                ?.status ||
              "Never"
            }
            detail={
              latestSync
                ?.completed_at ||
              latestSync
                ?.started_at ||
              "No sync history"
            }
          />

        </div>

      </section>


      {!configured && (
        <section className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-5">

          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">
            Configuration Required
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            Add CHONGQING_POS_API_BASE_URL and CHONGQING_POS_API_KEY to the server environment, then restart Next.js.
          </p>

        </section>
      )}


      <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex items-end justify-between gap-3">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              Branch Mapping
            </p>

            <h2 className="mt-1 text-xl font-black text-[#292824]">
              POS Branch → Outlet
            </h2>

          </div>


          <span className="rounded-full bg-[#F6F4F1] px-3 py-2 text-[10px] font-black text-neutral-600">
            {mappedCount} mapped
          </span>

        </div>


        <div className="mt-5 space-y-2">

          {branches.map(
            branch => {
              const key =
                String(
                  branch.external_branch_id
                );


              return (
                <div
                  key={
                    key
                  }
                  className="grid gap-3 rounded-2xl border border-neutral-200 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_auto]"
                >

                  <div>

                    <p className="text-sm font-black text-[#292824]">
                      {branch.name}
                    </p>

                    <p className="mt-1 text-[10px] font-bold text-neutral-400">
                      POS Branch #{branch.external_branch_id}
                      {branch.address
                        ? ` · ${branch.address}`
                        : ""}
                    </p>

                  </div>


                  <select
                    value={
                      selections[
                        key
                      ] ||
                      ""
                    }
                    onChange={
                      event =>
                        setSelections(
                          current => ({
                            ...current,

                            [key]:
                              event
                                .target
                                .value,
                          })
                        )
                    }
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-[#292824]"
                  >
                    <option value="">
                      Not mapped
                    </option>

                    {outlets.map(
                      outlet => (
                        <option
                          key={
                            outlet.id
                          }
                          value={
                            outlet.id
                          }
                        >
                          {outlet.name}
                          {" · "}
                          {outlet.code}
                        </option>
                      )
                    )}

                  </select>


                  <button
                    type="button"
                    disabled={
                      busy !==
                      null
                    }
                    onClick={() =>
                      saveMapping(
                        branch
                      )
                    }
                    className="h-11 rounded-xl bg-[#292824] px-5 text-xs font-black text-white disabled:opacity-40"
                  >
                    Save
                  </button>

                </div>
              );
            }
          )}


          {branches.length ===
            0 && (
            <div className="rounded-2xl bg-neutral-50 p-8 text-center">

              <p className="text-sm font-black text-neutral-500">
                No POS branches cached yet.
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Configure the API and click Refresh Branches.
              </p>

            </div>
          )}

        </div>

      </section>


      <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
            Synchronization
          </p>

          <h2 className="mt-1 text-xl font-black text-[#292824]">
            Recent Sync Runs
          </h2>

        </div>


        <div className="mt-5 space-y-2">

          {syncRuns.map(
            run => (
              <div
                key={
                  run.id
                }
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 md:flex-row md:items-center md:justify-between"
              >

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <p className="text-sm font-black">
                      {run.sync_type}
                    </p>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[8px] font-black",
                        run.status ===
                          "SUCCESS"
                          ? "bg-emerald-50 text-emerald-700"
                          : run.status ===
                              "FAILED"
                            ? "bg-red-50 text-red-700"
                            : "bg-[#D8D355]/30 text-[#5C5A0B]",
                      ].join(
                        " "
                      )}
                    >
                      {run.status}
                    </span>

                  </div>

                  <p className="mt-1 text-[10px] font-bold text-neutral-400">
                    {run.date_from &&
                     run.date_to
                      ? `${run.date_from} → ${run.date_to} · `
                      : ""}
                    {run.started_at}
                  </p>

                  {run.error_message && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {run.error_message}
                    </p>
                  )}

                </div>


                <div className="flex flex-wrap gap-2 text-[10px] font-black text-neutral-500">

                  <span className="rounded-lg bg-neutral-50 px-3 py-2">
                    {run.pages_processed} pages
                  </span>

                  <span className="rounded-lg bg-neutral-50 px-3 py-2">
                    {run.orders_upserted} orders
                  </span>

                  <span className="rounded-lg bg-neutral-50 px-3 py-2">
                    {run.items_upserted} items
                  </span>

                  {run.unmapped_orders >
                    0 && (
                    <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                      {run.unmapped_orders} unmapped
                    </span>
                  )}

                </div>

              </div>
            )
          )}


          {syncRuns.length ===
            0 && (
            <div className="rounded-2xl bg-neutral-50 p-8 text-center text-sm font-bold text-neutral-400">
              No sync history yet.
            </div>
          )}

        </div>

      </section>

    </main>
  );
}


function Stat({
  label,
  value,
  detail,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <div className="rounded-[20px] border border-neutral-200 bg-[#F8F7F4] p-4">

      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p className="mt-2 truncate text-lg font-black text-[#292824]">
        {value}
      </p>

      <p className="mt-1 truncate text-[10px] font-medium text-neutral-400">
        {detail}
      </p>

    </div>
  );
}
