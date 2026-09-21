import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  asBoolean,
  asNumber,
  businessDateForTimestamp,
  fetchPosOrdersPage,
  jakartaDate,
  rawText,
} from "@/lib/pos/chongqing-external-api";


const PROVIDER =
  "CHONGQING";


function relationOne(
  value:
    any
) {
  return Array.isArray(
    value
  )
    ? value[0]
    : value;
}


export async function POST(
  request:
    NextRequest
) {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }


  if (
    !context.isAdmin &&
    !context.permissionCodes.includes(
      "pos.manage"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }


  const body =
    await request
      .json()
      .catch(
        () =>
          ({})
      );


  const requestedDays =
    Number(
      body?.lookbackDays ??
      3
    );


  const lookbackDays =
    Math.max(
      1,
      Math.min(
        Number.isFinite(
          requestedDays
        )
          ? Math.trunc(
              requestedDays
            )
          : 3,
        14
      )
    );


  const dateFrom =
    jakartaDate(
      -(lookbackDays - 1)
    );

  const dateTo =
    jakartaDate(
      0
    );


  const admin:
    any =
    createAdminClient();


  const {
    data:
      mappingRows,
    error:
      mappingError,
  } =
    await admin
      .from(
        "pos_branch_mappings"
      )
      .select(`
        external_branch_id,
        outlet_id,
        outlets (
          id,
          name,
          timezone,
          organization_id
        )
      `)
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .eq(
        "provider",
        PROVIDER
      )
      .eq(
        "is_active",
        true
      );


  if (mappingError) {
    return NextResponse.json(
      {
        error:
          mappingError.message,
      },
      {
        status: 400,
      }
    );
  }


  if (
    !mappingRows ||
    mappingRows.length ===
      0
  ) {
    return NextResponse.json(
      {
        error:
          "No active POS branch mappings are configured.",
      },
      {
        status: 400,
      }
    );
  }


  const mappingByBranch =
    new Map<
      number,
      {
        outletId:
          string;

        timezone:
          string;
      }
    >();


  for (
    const row of
      mappingRows
  ) {
    const outlet =
      relationOne(
        row.outlets
      );


    if (!outlet?.id) {
      continue;
    }


    mappingByBranch.set(
      Number(
        row.external_branch_id
      ),
      {
        outletId:
          outlet.id,

        timezone:
          outlet.timezone ||
          "Asia/Jakarta",
      }
    );
  }


  const {
    data:
      syncRun,
    error:
      syncInsertError,
  } =
    await admin
      .from(
        "pos_sync_runs"
      )
      .insert({
        organization_id:
          context.profile
            .organization_id,

        provider:
          PROVIDER,

        sync_type:
          "ORDERS",

        status:
          "RUNNING",

        date_from:
          dateFrom,

        date_to:
          dateTo,

        created_by:
          context.user.id,
      })
      .select(
        "id"
      )
      .single();


  if (
    syncInsertError ||
    !syncRun
  ) {
    return NextResponse.json(
      {
        error:
          syncInsertError
            ?.message ||
          "Unable to start sync run.",
      },
      {
        status: 400,
      }
    );
  }


  let page =
    1;

  let pagesProcessed =
    0;

  let ordersSeen =
    0;

  let ordersUpserted =
    0;

  let itemsUpserted =
    0;

  let unmappedOrders =
    0;


  try {
    while (true) {
      const response =
        await fetchPosOrdersPage({
          dateFrom,
          dateTo,
          page,
        });


      const orders =
        response.data ??
        [];


      pagesProcessed +=
        1;

      ordersSeen +=
        orders.length;


      const normalizedOrders =
        orders
          .map(
            order => {
              const mapping =
                mappingByBranch.get(
                  Number(
                    order.branch_id
                  )
                );


              if (!mapping) {
                unmappedOrders +=
                  1;

                return null;
              }


              return {
                source:
                  order,

                row: {
                  organization_id:
                    context.profile
                      .organization_id,

                  outlet_id:
                    mapping.outletId,

                  provider:
                    PROVIDER,

                  external_order_id:
                    order.id,

                  external_branch_id:
                    order.branch_id,

                  order_code:
                    order.order_code ??
                    null,

                  order_type:
                    order.order_type ??
                    null,

                  table_number:
                    order.table_number ===
                      undefined ||
                    order.table_number ===
                      null
                      ? null
                      : String(
                          order.table_number
                        ),

                  customer_name:
                    order.customer_name ??
                    null,

                  status:
                    order.status ??
                    null,

                  payment_status:
                    order.payment_status ??
                    null,

                  payment_method:
                    order.payment_method ??
                    null,

                  pax:
                    asNumber(
                      order.pax
                    ),

                  promo_discount:
                    asNumber(
                      order.promo_discount
                    ),

                  ppn:
                    asNumber(
                      order.ppn
                    ),

                  service_charge:
                    asNumber(
                      order
                        .service_charge_7percent ??
                      order.service_charge
                    ),

                  rounding_value:
                    asNumber(
                      order.rounding_value
                    ),

                  total_price:
                    asNumber(
                      order.total_price
                    ),

                  amount_paid:
                    asNumber(
                      order.amount_paid
                    ),

                  is_void:
                    asBoolean(
                      order.is_void
                    ),

                  void_reason:
                    order.void_reason ??
                    null,

                  void_time_raw:
                    rawText(
                      order.void_time
                    ),

                  void_by_raw:
                    rawText(
                      order.void_by
                    ),

                  void_manager_by_raw:
                    rawText(
                      order
                        .void_manager_by
                    ),

                  pos_user_id:
                    order.user_id ??
                    null,

                  business_date:
                    businessDateForTimestamp(
                      order.created_at,
                      mapping.timezone
                    ),

                  external_created_at:
                    order.created_at ??
                    null,

                  external_updated_at:
                    order.updated_at ??
                    null,

                  raw_payload:
                    order,

                  last_synced_at:
                    new Date()
                      .toISOString(),
                },

                mapping,
              };
            }
          )
          .filter(
            Boolean
          ) as any[];


      if (
        normalizedOrders.length >
        0
      ) {
        const {
          data:
            upsertedOrders,
          error:
            orderUpsertError,
        } =
          await admin
            .from(
              "pos_orders"
            )
            .upsert(
              normalizedOrders.map(
                item =>
                  item.row
              ),
              {
                onConflict:
                  "organization_id,provider,external_order_id",
              }
            )
            .select(
              "id, external_order_id"
            );


        if (
          orderUpsertError
        ) {
          throw orderUpsertError;
        }


        const internalOrderIdByExternal =
          new Map<
            number,
            string
          >(
            (
              upsertedOrders ??
              []
            ).map(
              (
                row: any
              ) => [
                Number(
                  row.external_order_id
                ),
                row.id,
              ]
            )
          );


        ordersUpserted +=
          normalizedOrders.length;


        const itemRows:
          any[] =
          [];


        for (
          const normalized of
            normalizedOrders
        ) {
          const order =
            normalized.source;

          const mapping =
            normalized.mapping;

          const internalOrderId =
            internalOrderIdByExternal.get(
              Number(
                order.id
              )
            );


          if (!internalOrderId) {
            continue;
          }


          for (
            const item of
              order.items ??
              []
          ) {
            itemRows.push({
              organization_id:
                context.profile
                  .organization_id,

              outlet_id:
                mapping.outletId,

              pos_order_id:
                internalOrderId,

              provider:
                PROVIDER,

              external_item_id:
                item.id,

              external_order_id:
                order.id,

              menu_id:
                item.menu_id ??
                null,

              sku:
                item.sku ??
                null,

              variant_id:
                item.variant_id ??
                null,

              variant_sku:
                item.variant_sku ??
                null,

              name:
                String(
                  item.name ||
                  "Unnamed POS Item"
                ),

              qty:
                asNumber(
                  item.qty
                ),

              price:
                asNumber(
                  item.price
                ),

              total_price:
                asNumber(
                  item.total_price
                ),

              discount:
                asNumber(
                  item.discount
                ),

              complimentary:
                asBoolean(
                  item.complimentary
                ),

              is_package:
                asBoolean(
                  item.is_package
                ),

              is_half_portion:
                asBoolean(
                  item.is_half_portion
                ),

              is_three_portion:
                asBoolean(
                  item.is_three_portion
                ),

              is_personal:
                asBoolean(
                  item.is_personal
                ),

              is_glass:
                asBoolean(
                  item.is_glass
                ),

              is_cashback:
                asBoolean(
                  item.is_cashback
                ),

              is_void:
                asBoolean(
                  item.is_void
                ),

              void_reason:
                item.void_reason ??
                null,

              void_time_raw:
                rawText(
                  item.void_time
                ),

              void_by_raw:
                rawText(
                  item.void_by
                ),

              void_manager_by_raw:
                rawText(
                  item
                    .void_manager_by
                ),

              pos_user_id:
                item.user_id ??
                null,

              business_date:
                businessDateForTimestamp(
                  order.created_at,
                  mapping.timezone
                ),

              external_created_at:
                item.created_at ??
                null,

              external_updated_at:
                item.updated_at ??
                null,

              raw_payload:
                item,

              last_synced_at:
                new Date()
                  .toISOString(),
            });
          }
        }


        if (
          itemRows.length >
          0
        ) {
          const {
            error:
              itemUpsertError,
          } =
            await admin
              .from(
                "pos_order_items"
              )
              .upsert(
                itemRows,
                {
                  onConflict:
                    "organization_id,provider,external_item_id",
                }
              );


          if (
            itemUpsertError
          ) {
            throw itemUpsertError;
          }


          itemsUpserted +=
            itemRows.length;
        }
      }


      const currentPage =
        Number(
          response.meta
            ?.current_page ??
          page
        );


      const lastPage =
        Number(
          response.meta
            ?.last_page ??
          currentPage
        );


      if (
        currentPage >=
          lastPage ||
        !response.links
          ?.next
      ) {
        break;
      }


      page +=
        1;


      if (
        page >
        1000
      ) {
        throw new Error(
          "POS sync safety stop: exceeded 1000 pages."
        );
      }
    }


    await admin
      .from(
        "pos_sync_runs"
      )
      .update({
        status:
          unmappedOrders >
            0
            ? "PARTIAL"
            : "SUCCESS",

        pages_processed:
          pagesProcessed,

        orders_seen:
          ordersSeen,

        orders_upserted:
          ordersUpserted,

        items_upserted:
          itemsUpserted,

        unmapped_orders:
          unmappedOrders,

        completed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        syncRun.id
      );


    return NextResponse.json({
      ok:
        true,

      status:
        unmappedOrders >
          0
          ? "PARTIAL"
          : "SUCCESS",

      dateFrom,
      dateTo,
      pagesProcessed,
      ordersSeen,
      ordersUpserted,
      itemsUpserted,
      unmappedOrders,
    });

  } catch (
    error: any
  ) {
    await admin
      .from(
        "pos_sync_runs"
      )
      .update({
        status:
          "FAILED",

        pages_processed:
          pagesProcessed,

        orders_seen:
          ordersSeen,

        orders_upserted:
          ordersUpserted,

        items_upserted:
          itemsUpserted,

        unmapped_orders:
          unmappedOrders,

        error_message:
          error?.message ||
          "POS sync failed.",

        completed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        syncRun.id
      );


    return NextResponse.json(
      {
        error:
          error?.message ||
          "POS sync failed.",
      },
      {
        status: 400,
      }
    );
  }
}
