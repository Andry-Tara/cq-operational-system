import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


const PROVIDER =
  "CHONGQING";

const PAGE_SIZE =
  1000;

const MAX_META_ROWS =
  10000;

const MAX_DAY_ROWS =
  5000;


function one(
  value:
    any
) {
  return Array.isArray(
    value
  )
    ? value[0]
    : value;
}


function param(
  value:
    string |
    string[] |
    undefined
) {
  return Array.isArray(
    value
  )
    ? value[0] ||
        ""
    : value ||
        "";
}


function money(
  value:
    unknown
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style:
        "currency",

      currency:
        "IDR",

      maximumFractionDigits:
        0,
    }
  ).format(
    Math.abs(
      Number(
        value ??
        0
      )
    )
  );
}


function number(
  value:
    unknown
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits:
        2,
    }
  ).format(
    Math.abs(
      Number(
        value ??
        0
      )
    )
  );
}


function cleanText(
  value:
    unknown
) {
  return String(
    value ??
    ""
  ).trim();
}


function reasonKey(
  value:
    unknown
) {
  const cleaned =
    cleanText(
      value
    );


  return cleaned
    ? cleaned.toLocaleLowerCase()
    : "__NO_REASON__";
}


function reasonLabel(
  value:
    unknown
) {
  const cleaned =
    cleanText(
      value
    );


  return cleaned ||
    "No reason recorded";
}


function posUserLabel(
  value:
    unknown
) {
  const cleaned =
    cleanText(
      value
    );


  if (
    !cleaned ||
    cleaned ===
      "0" ||
    cleaned.toLocaleLowerCase() ===
      "null"
  ) {
    return "—";
  }


  return `POS User #${cleaned}`;
}


function managerLabel(
  value:
    unknown
) {
  const cleaned =
    cleanText(
      value
    );


  if (
    !cleaned ||
    cleaned ===
      "0" ||
    cleaned.toLocaleLowerCase() ===
      "null"
  ) {
    return "—";
  }


  return `POS User #${cleaned}`;
}


function displayDate(
  value:
    string
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      `${value}T12:00:00Z`
    );


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    date
  );
}


function displaySyncTime(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "No synchronization history";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Jakarta",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    date
  ) + " WIB";
}


function displayVoidTime(
  value:
    unknown
) {
  const cleaned =
    cleanText(
      value
    );


  if (!cleaned) {
    return "Time unavailable";
  }


  const parts =
    cleaned.split(
      " "
    );


  return parts.length >
    1
    ? parts[
        parts.length -
        1
      ].slice(
        0,
        5
      )
    : cleaned;
}


type VoidMetaRow = {
  business_date:
    string;

  outlet_id:
    string;

  void_reason:
    string |
    null;

  void_by_raw:
    string |
    null;
};


async function loadVoidMeta(
  admin:
    any,

  organizationId:
    string
) {
  const rows:
    VoidMetaRow[] =
    [];


  for (
    let from = 0;
    from < MAX_META_ROWS;
    from += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "pos_order_items"
        )
        .select(`
          business_date,
          outlet_id,
          void_reason,
          void_by_raw
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "provider",
          PROVIDER
        )
        .eq(
          "is_void",
          true
        )
        .order(
          "business_date",
          {
            ascending:
              false,
          }
        )
        .range(
          from,
          from +
            PAGE_SIZE -
            1
        );


    if (error) {
      throw error;
    }


    const current =
      (
        data ??
        []
      ) as VoidMetaRow[];


    rows.push(
      ...current
    );


    if (
      current.length <
      PAGE_SIZE
    ) {
      break;
    }
  }


  return rows;
}


async function loadDayRows(
  admin:
    any,

  organizationId:
    string,

  businessDate:
    string
) {
  const rows:
    any[] =
    [];


  for (
    let from = 0;
    from < MAX_DAY_ROWS;
    from += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "pos_order_items"
        )
        .select(`
          id,
          outlet_id,
          pos_order_id,
          external_item_id,
          external_order_id,
          name,
          qty,
          price,
          total_price,
          void_reason,
          void_time_raw,
          void_by_raw,
          void_manager_by_raw,
          business_date,
          external_created_at,
          external_updated_at,
          outlets (
            id,
            code,
            name,
            timezone
          ),
          pos_orders (
            id,
            order_code,
            table_number,
            order_type,
            status,
            payment_status
          )
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "provider",
          PROVIDER
        )
        .eq(
          "is_void",
          true
        )
        .eq(
          "business_date",
          businessDate
        )
        .order(
          "external_updated_at",
          {
            ascending:
              false,
          }
        )
        .range(
          from,
          from +
            PAGE_SIZE -
            1
        );


    if (error) {
      throw error;
    }


    const current =
      data ??
      [];


    rows.push(
      ...current
    );


    if (
      current.length <
      PAGE_SIZE
    ) {
      break;
    }
  }


  return rows;
}


export default async function VoidSalesPage({
  searchParams,
}: {
  searchParams:
    Promise<{
      date?:
        string |
        string[];

      outlet?:
        string |
        string[];

      reason?:
        string |
        string[];

      user?:
        string |
        string[];
    }>;
}) {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    redirect(
      "/auth/login"
    );
  }


  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      "pos.view"
    )
  ) {
    redirect(
      "/protected"
    );
  }


  const params =
    await searchParams;


  const admin:
    any =
    createAdminClient();


  const organizationId =
    context.profile
      .organization_id;


  const [
    metaRows,
    mappingsResult,
    latestSyncResult,
  ] =
    await Promise.all([
      loadVoidMeta(
        admin,
        organizationId
      ),

      admin
        .from(
          "pos_branch_mappings"
        )
        .select(`
          outlet_id,
          external_branch_id,
          external_branch_name,
          outlets (
            id,
            code,
            name,
            timezone
          )
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "provider",
          PROVIDER
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "external_branch_name",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "pos_sync_runs"
        )
        .select(`
          status,
          started_at,
          completed_at,
          orders_upserted,
          items_upserted
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "provider",
          PROVIDER
        )
        .eq(
          "sync_type",
          "ORDERS"
        )
        .order(
          "started_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle(),
    ]);


  if (
    mappingsResult.error
  ) {
    throw mappingsResult.error;
  }


  if (
    latestSyncResult.error
  ) {
    throw latestSyncResult.error;
  }


  const availableDates =
    Array.from(
      new Set(
        metaRows
          .map(
            row =>
              row.business_date
          )
          .filter(
            Boolean
          )
      )
    ).sort(
      (
        a,
        b
      ) =>
        b.localeCompare(
          a
        )
    );


  const requestedDate =
    param(
      params.date
    );


  const selectedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(
      requestedDate
    )
      ? requestedDate
      : availableDates[0] ||
        "";


  const selectedOutlet =
    param(
      params.outlet
    ) ||
    "ALL";


  const selectedReason =
    param(
      params.reason
    ) ||
    "ALL";


  const selectedUser =
    param(
      params.user
    ) ||
    "ALL";


  const mappedOutlets =
    (
      mappingsResult.data ??
      []
    )
      .map(
        (
          row: any
        ) => {
          const outlet =
            one(
              row.outlets
            );


          if (!outlet?.id) {
            return null;
          }


          return {
            id:
              outlet.id,

            code:
              outlet.code,

            name:
              outlet.name,

            timezone:
              outlet.timezone,

            externalBranchName:
              row
                .external_branch_name,
          };
        }
      )
      .filter(
        Boolean
      )
      .sort(
        (
          a: any,
          b: any
        ) =>
          a.name.localeCompare(
            b.name
          )
      );


  const outletMap =
    new Map(
      mappedOutlets.map(
        (
          outlet: any
        ) => [
          outlet.id,
          outlet,
        ]
      )
    );


  const dayRows =
    selectedDate
      ? await loadDayRows(
          admin,
          organizationId,
          selectedDate
        )
      : [];


  const reasonOptions =
    Array.from(
      new Map(
        dayRows
          .filter(
            (
              row: any
            ) =>
              selectedOutlet ===
                "ALL" ||
              row.outlet_id ===
                selectedOutlet
          )
          .map(
            (
              row: any
            ) => [
              reasonKey(
                row.void_reason
              ),
              reasonLabel(
                row.void_reason
              ),
            ]
          )
      ).entries()
    ).sort(
      (
        a,
        b
      ) =>
        a[1].localeCompare(
          b[1]
        )
    );


  const userOptions =
    Array.from(
      new Set(
        dayRows
          .filter(
            (
              row: any
            ) =>
              selectedOutlet ===
                "ALL" ||
              row.outlet_id ===
                selectedOutlet
          )
          .map(
            (
              row: any
            ) =>
              cleanText(
                row
                  .void_by_raw
              )
          )
          .filter(
            value =>
              value &&
              value !==
                "0"
          )
      )
    ).sort(
      (
        a,
        b
      ) =>
        a.localeCompare(
          b,
          undefined,
          {
            numeric:
              true,
          }
        )
    );


  const filteredRows =
    dayRows.filter(
      (
        row: any
      ) => {
        if (
          selectedOutlet !==
            "ALL" &&
          row.outlet_id !==
            selectedOutlet
        ) {
          return false;
        }


        if (
          selectedReason !==
            "ALL" &&
          reasonKey(
            row.void_reason
          ) !==
            selectedReason
        ) {
          return false;
        }


        if (
          selectedUser !==
            "ALL" &&
          cleanText(
            row.void_by_raw
          ) !==
            selectedUser
        ) {
          return false;
        }


        return true;
      }
    );


  const affectedOrders =
    new Set(
      filteredRows.map(
        (
          row: any
        ) =>
          String(
            row.external_order_id
          )
      )
    ).size;


  const voidItems =
    filteredRows.length;


  const voidQty =
    filteredRows.reduce(
      (
        sum:
          number,
        row:
          any
      ) =>
        sum +
        Math.abs(
          Number(
            row.qty ??
            0
          )
        ),
      0
    );


  const voidAmount =
    filteredRows.reduce(
      (
        sum:
          number,
        row:
          any
      ) =>
        sum +
        Math.abs(
          Number(
            row.total_price ??
            0
          )
        ),
      0
    );


  const byOutletMap =
    new Map<
      string,
      {
        outletId:
          string;

        outletName:
          string;

        itemCount:
          number;

        qty:
          number;

        amount:
          number;

        orders:
          Set<string>;
      }
    >();


  for (
    const row of
      filteredRows
  ) {
    const outlet =
      outletMap.get(
        row.outlet_id
      );


    const current =
      byOutletMap.get(
        row.outlet_id
      ) || {
        outletId:
          row.outlet_id,

        outletName:
          (outlet as any)?.name ||
          "Unknown Outlet",

        itemCount:
          0,

        qty:
          0,

        amount:
          0,

        orders:
          new Set<string>(),
      };


    current.itemCount +=
      1;

    current.qty +=
      Math.abs(
        Number(
          row.qty ??
          0
        )
      );

    current.amount +=
      Math.abs(
        Number(
          row.total_price ??
          0
        )
      );

    current.orders.add(
      String(
        row.external_order_id
      )
    );


    byOutletMap.set(
      row.outlet_id,
      current
    );
  }


  const outletBreakdown =
    Array.from(
      byOutletMap.values()
    ).sort(
      (
        a,
        b
      ) =>
        b.itemCount -
        a.itemCount
    );


  const reasonMap =
    new Map<
      string,
      {
        key:
          string;

        label:
          string;

        itemCount:
          number;

        qty:
          number;

        amount:
          number;
      }
    >();


  for (
    const row of
      filteredRows
  ) {
    const key =
      reasonKey(
        row.void_reason
      );


    const current =
      reasonMap.get(
        key
      ) || {
        key,

        label:
          reasonLabel(
            row.void_reason
          ),

        itemCount:
          0,

        qty:
          0,

        amount:
          0,
      };


    current.itemCount +=
      1;

    current.qty +=
      Math.abs(
        Number(
          row.qty ??
          0
        )
      );

    current.amount +=
      Math.abs(
        Number(
          row.total_price ??
          0
        )
      );


    reasonMap.set(
      key,
      current
    );
  }


  const reasonBreakdown =
    Array.from(
      reasonMap.values()
    ).sort(
      (
        a,
        b
      ) =>
        b.itemCount -
        a.itemCount
    );


  const latestSync =
    latestSyncResult.data;


  return (
    <main className="min-h-screen bg-[#F5F5F3] text-[#292824]">

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 md:py-9">

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              POS Analytics
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] md:text-4xl">
              Void Sales
            </h1>

            <p className="mt-2 text-sm font-medium text-neutral-500">
              Read-only item-level void monitoring from the ChongQing POS API.
            </p>

          </div>


          <div className="flex flex-wrap items-center gap-2">

            <Link
              href="/protected"
              className="flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black"
            >
              Dashboard
            </Link>


            {context.isAdmin && (
              <Link
                href="/protected/admin/pos-integration"
                className="flex h-11 items-center rounded-xl bg-[#292824] px-4 text-xs font-black text-white"
              >
                POS Integration
              </Link>
            )}

          </div>

        </header>


        <section className="mt-6 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">

          <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">

            <div className="p-5 sm:p-6 md:p-7">

              <div className="flex flex-wrap items-center gap-2">

                <span className="rounded-full bg-red-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-700">
                  Item-Level Void
                </span>

                <span className="rounded-full bg-[#F6F4F1] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">
                  {selectedDate
                    ? displayDate(
                        selectedDate
                      )
                    : "No Data"}
                </span>

              </div>


              <h2 className="mt-4 text-2xl font-black tracking-tight">
                Void activity by outlet, reason and POS user.
              </h2>


              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
                Negative POS quantities and amounts are normalized to absolute values for management reporting. Raw signed values remain unchanged in the database.
              </p>

            </div>


            <aside className="border-t border-neutral-100 bg-[#F8F7F4] p-5 lg:border-l lg:border-t-0 sm:p-6">

              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">
                Last Synced
              </p>

              <p className="mt-2 text-base font-black">
                {displaySyncTime(
                  latestSync
                    ?.completed_at ||
                  latestSync
                    ?.started_at
                )}
              </p>

              {latestSync && (
                <div className="mt-4 flex flex-wrap gap-2">

                  <span className="rounded-lg bg-white px-3 py-2 text-[9px] font-black text-neutral-500">
                    {latestSync.orders_upserted} orders
                  </span>

                  <span className="rounded-lg bg-white px-3 py-2 text-[9px] font-black text-neutral-500">
                    {latestSync.items_upserted} items
                  </span>


                  {context.isAdmin && (
                    <span className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[9px] font-black text-neutral-400">
                      Sync {latestSync.status}
                    </span>
                  )}

                </div>
              )}

            </aside>

          </div>

        </section>


        <form
          method="GET"
          className="mt-4 grid gap-3 rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.4fr_1fr_auto]"
        >

          <FilterSelect
            label="Business Date"
            name="date"
            value={
              selectedDate
            }
          >
            {availableDates.map(
              date => (
                <option
                  key={
                    date
                  }
                  value={
                    date
                  }
                >
                  {displayDate(
                    date
                  )}
                </option>
              )
            )}
          </FilterSelect>


          <FilterSelect
            label="Outlet"
            name="outlet"
            value={
              selectedOutlet
            }
          >
            <option value="ALL">
              All Outlets
            </option>

            {mappedOutlets.map(
              (
                outlet: any
              ) => (
                <option
                  key={
                    outlet.id
                  }
                  value={
                    outlet.id
                  }
                >
                  {outlet.name}
                </option>
              )
            )}
          </FilterSelect>


          <FilterSelect
            label="Void Reason"
            name="reason"
            value={
              selectedReason
            }
          >
            <option value="ALL">
              All Reasons
            </option>

            {reasonOptions.map(
              (
                [
                  key,
                  label,
                ]
              ) => (
                <option
                  key={
                    key
                  }
                  value={
                    key
                  }
                >
                  {label}
                </option>
              )
            )}
          </FilterSelect>


          <FilterSelect
            label="POS User"
            name="user"
            value={
              selectedUser
            }
          >
            <option value="ALL">
              All Users
            </option>

            {userOptions.map(
              user => (
                <option
                  key={
                    user
                  }
                  value={
                    user
                  }
                >
                  POS User #{user}
                </option>
              )
            )}
          </FilterSelect>


          <div className="flex items-end gap-2">

            <Link
              href="/protected/pos/void-sales"
              className="flex h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-[10px] font-black text-neutral-500"
            >
              Reset
            </Link>

            <button
              type="submit"
              className="h-12 flex-1 rounded-xl bg-[#292824] px-5 text-xs font-black text-white"
            >
              Apply
            </button>

          </div>

        </form>


        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <Kpi
            label="Affected Orders"
            value={
              number(
                affectedOrders
              )
            }
            detail="Distinct POS orders containing void items"
          />

          <Kpi
            label="Void Items"
            value={
              number(
                voidItems
              )
            }
            detail="Item-level void records"
          />

          <Kpi
            label="Void Qty"
            value={
              number(
                voidQty
              )
            }
            detail="Absolute quantity"
          />

          <Kpi
            label="Void Amount"
            value={
              money(
                voidAmount
              )
            }
            detail="Absolute item subtotal"
            strong
          />

        </section>


        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">

          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-end justify-between gap-3">

              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  Outlet Breakdown
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Void by Outlet
                </h2>

              </div>

              <span className="text-[10px] font-bold text-neutral-400">
                {outletBreakdown.length} outlets
              </span>

            </div>


            <div className="mt-4 space-y-2">

              {outletBreakdown.map(
                outlet => (
                  <div
                    key={
                      outlet.outletId
                    }
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-[18px] border border-neutral-200 bg-[#F8F7F4] px-4 py-3"
                  >

                    <div className="min-w-0">

                      <p className="truncate text-sm font-black">
                        {outlet.outletName}
                      </p>

                      <p className="mt-1 text-[10px] font-bold text-neutral-400">
                        {outlet.orders.size} affected orders · {number(outlet.qty)} qty
                      </p>

                    </div>


                    <div className="text-right">

                      <p className="text-sm font-black">
                        {outlet.itemCount} items
                      </p>

                      <p className="mt-1 text-[10px] font-black text-red-700">
                        {money(
                          outlet.amount
                        )}
                      </p>

                    </div>

                  </div>
                )
              )}


              {outletBreakdown.length ===
                0 && (
                <Empty
                  text="No void activity for the selected filters."
                />
              )}

            </div>

          </section>


          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-end justify-between gap-3">

              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  Reason Analysis
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Void Reasons
                </h2>

              </div>

              <span className="text-[10px] font-bold text-neutral-400">
                {reasonBreakdown.length} reasons
              </span>

            </div>


            <div className="mt-4 space-y-2">

              {reasonBreakdown
                .slice(
                  0,
                  12
                )
                .map(
                  reason => (
                    <div
                      key={
                        reason.key
                      }
                      className="flex items-center justify-between gap-4 rounded-[18px] border border-neutral-200 px-4 py-3"
                    >

                      <div className="min-w-0">

                        <p className="truncate text-xs font-black">
                          {reason.label}
                        </p>

                        <p className="mt-1 text-[10px] font-bold text-neutral-400">
                          {reason.itemCount} items · {number(reason.qty)} qty
                        </p>

                      </div>


                      <p className="shrink-0 text-xs font-black text-red-700">
                        {money(
                          reason.amount
                        )}
                      </p>

                    </div>
                  )
                )}


              {reasonBreakdown.length ===
                0 && (
                <Empty
                  text="No reason data for the selected filters."
                />
              )}

            </div>

          </section>

        </div>


        <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-wrap items-end justify-between gap-3">

            <div>

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Transaction Detail
              </p>

              <h2 className="mt-1 text-xl font-black">
                Void Items
              </h2>

            </div>


            <span className="rounded-full bg-red-50 px-3 py-2 text-[9px] font-black text-red-700">
              {filteredRows.length} records
            </span>

          </div>


          <div className="mt-5 grid gap-3 md:grid-cols-2">

            {filteredRows.map(
              (
                row: any
              ) => {
                const outlet:
                  any =
                  one(
                    row.outlets
                  ) ||
                  outletMap.get(
                    row.outlet_id
                  );


                const order =
                  one(
                    row.pos_orders
                  );


                return (
                  <article
                    key={
                      row.id
                    }
                    className="overflow-hidden rounded-[22px] border border-neutral-200"
                  >

                    <div className="flex items-start justify-between gap-4 bg-[#F8F7F4] px-4 py-3">

                      <div className="min-w-0">

                        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
                          {(outlet as any)?.name ||
                            "Unknown Outlet"}
                        </p>

                        <p className="mt-1 truncate text-sm font-black">
                          {order
                            ?.order_code ||
                            `Order #${row.external_order_id}`}
                        </p>

                        <p className="mt-1 text-[10px] font-bold text-neutral-400">
                          {order?.table_number
                            ? `Table ${order.table_number} · `
                            : ""}
                          {order?.order_type ||
                            "POS Order"}
                        </p>

                      </div>


                      <div className="text-right">

                        <p className="text-sm font-black text-red-700">
                          {displayVoidTime(
                            row.void_time_raw
                          )}
                        </p>

                        <p className="mt-1 text-[9px] font-bold text-neutral-400">
                          {row.business_date}
                        </p>

                      </div>

                    </div>


                    <div className="p-4">

                      <h3 className="text-[15px] font-black leading-5">
                        {row.name}
                      </h3>


                      <div className="mt-3 flex flex-wrap gap-2">

                        <span className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[9px] font-black text-neutral-600">
                          Qty {
                            number(
                              row.qty
                            )
                          }
                        </span>

                        <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[9px] font-black text-red-700">
                          {
                            money(
                              row.total_price
                            )
                          }
                        </span>

                      </div>


                      <div className="mt-4 rounded-[16px] border border-neutral-200 bg-white p-3">

                        <p className="text-[8px] font-black uppercase tracking-[0.13em] text-neutral-400">
                          Reason
                        </p>

                        <p className="mt-1 text-xs font-black">
                          {
                            reasonLabel(
                              row.void_reason
                            )
                          }
                        </p>

                      </div>


                      <div className="mt-3">

                        <div className="rounded-[14px] bg-[#F8F7F4] p-3">

                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
                            Voided By
                          </p>

                          <p className="mt-1 text-[11px] font-black">
                            {
                              posUserLabel(
                                row.void_by_raw
                              )
                            }
                          </p>

                        </div>



                      </div>

                    </div>

                  </article>
                );
              }
            )}


            {filteredRows.length ===
              0 && (
              <div className="md:col-span-2">
                <Empty
                  text="No void items match the selected filters."
                />
              </div>
            )}

          </div>

        </section>


        {metaRows.length >=
          MAX_META_ROWS && (
          <p className="mt-4 text-center text-[10px] font-bold text-amber-700">
            Historical filter options reached the V1 safety limit of {MAX_META_ROWS} void rows.
          </p>
        )}


        {dayRows.length >=
          MAX_DAY_ROWS && (
          <p className="mt-2 text-center text-[10px] font-bold text-amber-700">
            Daily detail reached the V1 safety limit of {MAX_DAY_ROWS} void rows.
          </p>
        )}

      </div>

    </main>
  );
}


function Kpi({
  label,
  value,
  detail,
  strong = false,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;

  strong?:
    boolean;
}) {
  return (
    <div
      className={[
        "rounded-[22px] border p-5 shadow-sm",
        strong
          ? "border-red-100 bg-red-50/55"
          : "border-neutral-200 bg-white",
      ].join(
        " "
      )}
    >

      <p
        className={[
          "text-[9px] font-black uppercase tracking-[0.15em]",
          strong
            ? "text-red-700"
            : "text-neutral-400",
        ].join(
          " "
        )}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-[10px] leading-4 text-neutral-400">
        {detail}
      </p>

    </div>
  );
}


function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label:
    string;

  name:
    string;

  value:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </span>

      <select
        key={`${name}:${value}`}
        name={
          name
        }
        defaultValue={
          value
        }
        className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black text-[#292824]"
      >
        {children}
      </select>

    </label>
  );
}


function Empty({
  text,
}: {
  text:
    string;
}) {
  return (
    <div className="rounded-[18px] bg-neutral-50 px-5 py-8 text-center">

      <p className="text-xs font-bold text-neutral-400">
        {text}
      </p>

    </div>
  );
}
