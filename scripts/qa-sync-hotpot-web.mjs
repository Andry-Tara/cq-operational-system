import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in environment.",
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const BASE_URL = "https://hotpot.co.id";

const CATEGORY_NAMES = new Set([
  "APPETIZERS",
  "SET MENU",
  "SOUP",
  "MEAT",
  "FRESH MEATBALL",
  "FRESH PASTE",
  "FRESH WONTON",
  "ALASKAN KING CRAB",
  "SEAFOOD",
  "INNARDS",
  "SPECIALS",
  "SHAO KAO",
  "KIDS MEAL",
  "VEGETABLE",
  "TOFU",
  "MUSHROOM",
  "STAPLE",
  "DESSERT",
  "BEVERAGE",
  "ON GOING",
  "KAFEI",
  "ONLINE FOOD",
]);

const NON_QA_CATEGORIES = new Set([
  "SET MENU",
  "BEVERAGE",
  "ON GOING",
  "KAFEI",
  "ONLINE FOOD",
]);

function normalizeName(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code)),
    );
}

function htmlText(value = "") {
  return decodeHtml(
    String(value)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function extractBranchIds(html) {
  const found = new Set();

  for (const match of html.matchAll(/branchId(?:=|%3D)(\d+)/gi)) {
    found.add(Number(match[1]));
  }

  for (
    const match of html.matchAll(
      /<option\b[^>]*value=["']?([^"' >]+)["']?[^>]*>/gi,
    )
  ) {
    const value = String(match[1] || "");

    if (/^\d+$/.test(value)) {
      found.add(Number(value));
      continue;
    }

    const nested = value.match(/branchId=(\d+)/i);

    if (nested) {
      found.add(Number(nested[1]));
    }
  }

  return [...found]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
}

function extractActiveBranchName(html) {
  const selected = html.match(
    /<option\b[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
  );

  if (selected) {
    const value = htmlText(selected[1]);

    if (value && value.toLowerCase() !== "select") {
      return value;
    }
  }

  const plain = htmlText(html);

  const cartMatch = plain.match(
    /0\s*Items\s+(.+?)\s+\(No Pork[^)]*\)/i,
  );

  if (cartMatch?.[1]) {
    return cartMatch[1].trim();
  }

  return null;
}

function parseMenuPage(
  html,
  {
    branchId,
    branchName,
    url,
  },
) {
  const headings = [];

  const headingRegex =
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while ((match = headingRegex.exec(html))) {
    const text = htmlText(match[2]).trim();

    if (!text) continue;

    headings.push({
      start: match.index,
      end: headingRegex.lastIndex,
      text,
    });
  }

  const menus = [];
  let currentCategory = null;

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];

    const nextStart =
      headings[index + 1]?.start ??
      html.length;

    const afterHeading =
      html.slice(
        heading.end,
        nextStart,
      );

    const blockText =
      htmlText(afterHeading);

    const upper =
      heading.text
        .trim()
        .toUpperCase();

    if (CATEGORY_NAMES.has(upper)) {
      currentCategory = upper;
      continue;
    }

    if (!currentCategory) {
      continue;
    }

    const prices = [
      ...blockText.matchAll(
        /Rp\.?\s*([\d.]+)/gi,
      ),
    ].map((row) =>
      Number(
        String(row[1])
          .replace(/\./g, ""),
      ),
    );

    if (prices.length === 0) {
      continue;
    }

    const normalized =
      normalizeName(
        heading.text,
      );

    if (
      !normalized ||
      normalized === "all menu" ||
      normalized === "select"
    ) {
      continue;
    }

    menus.push({
      source: "HOTPOT_WEB",
      sourceBranchId:
        branchId == null
          ? "default"
          : String(branchId),

      branchName:
        branchName || null,

      menuName:
        heading.text.trim(),

      normalizedName:
        normalized,

      category:
        currentCategory,

      qaEligible:
        !NON_QA_CATEGORIES.has(
          currentCategory,
        ),

      prices,

      url,

      rawText:
        blockText.slice(
          0,
          1000,
        ),
    });
  }

  return menus;
}

async function fetchHtml(url) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000,
    );

  try {
    const response =
      await fetch(url, {
        signal:
          controller.signal,

        cache:
          "no-store",

        headers: {
          "User-Agent":
            "Mozilla/5.0 QA-Food-Menu-Sync/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },
      });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      );
    }

    return {
      html:
        await response.text(),

      finalUrl:
        response.url,
    };
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function chunks(
  rows,
  size,
  worker,
) {
  const result = [];

  for (
    let i = 0;
    i < rows.length;
    i += size
  ) {
    const part =
      rows.slice(
        i,
        i + size,
      );

    result.push(
      ...(await worker(part)),
    );
  }

  return result;
}

async function main() {
  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    " QA FOOD — HOTPOT WEB FULL MENU SYNC",
  );
  console.log(
    "==============================================",
  );

  const {
    data: outlets,
    error: outletError,
  } =
    await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        organization_id,
        is_active
      `)
      .eq(
        "is_active",
        true,
      );

  if (outletError) {
    throw outletError;
  }

  const restaurants =
    (outlets ?? []).filter(
      (outlet) =>
        String(
          outlet.code,
        ).toUpperCase() !==
        "CNT",
    );

  const organizationIds =
    [
      ...new Set(
        restaurants.map(
          (outlet) =>
            outlet.organization_id,
        ),
      ),
    ];

  if (
    organizationIds.length !==
    1
  ) {
    throw new Error(
      `Expected exactly one restaurant organization, found ${organizationIds.length}.`,
    );
  }

  const organizationId =
    organizationIds[0];

  console.log(
    `Organization: ${organizationId}`,
  );
  console.log(
    `Restaurant outlets: ${restaurants.length}`,
  );

  const {
    data: run,
    error: runError,
  } =
    await supabase
      .from(
        "qa_food_sync_runs",
      )
      .insert({
        organization_id:
          organizationId,

        source:
          "HOTPOT_WEB",

        status:
          "RUNNING",
      })
      .select("id")
      .single();

  if (runError) {
    throw runError;
  }

  try {
    console.log("");
    console.log(
      "Fetching default catalog...",
    );

    const defaultResult =
      await fetchHtml(
        BASE_URL,
      );

    let branchIds =
      extractBranchIds(
        defaultResult.html,
      );

    console.log(
      `Discovered branch IDs from page: ${
        branchIds.length
          ? branchIds.join(", ")
          : "(none)"
      }`,
    );

    /*
     * Fallback discovery.
     *
     * If the branch selector is not present in server-rendered HTML,
     * probe a modest range. Duplicate catalogs are harmless because
     * canonical menus are deduplicated by normalized name.
     */
    if (
      branchIds.length <
      3
    ) {
      branchIds = [
        ...new Set([
          ...branchIds,
          ...Array.from(
            {
              length:
                20,
            },
            (
              _,
              index,
            ) =>
              index + 1,
          ),
          3,
          12,
        ]),
      ].sort(
        (a, b) =>
          a - b,
      );

      console.log(
        `Fallback probe enabled: ${branchIds.length} candidate branch IDs.`,
      );
    }

    const pages = [
      {
        branchId:
          null,

        url:
          BASE_URL,

        html:
          defaultResult.html,

        branchName:
          extractActiveBranchName(
            defaultResult.html,
          ),
      },
    ];

    /*
     * Fetch in small batches so we don't hammer the public site.
     */
    for (
      let i = 0;
      i < branchIds.length;
      i += 4
    ) {
      const batch =
        branchIds.slice(
          i,
          i + 4,
        );

      const settled =
        await Promise.allSettled(
          batch.map(
            async (
              branchId,
            ) => {
              const url =
                `${BASE_URL}/?branchId=${branchId}`;

              const response =
                await fetchHtml(
                  url,
                );

              return {
                branchId,

                url,

                html:
                  response.html,

                branchName:
                  extractActiveBranchName(
                    response.html,
                  ),
              };
            },
          ),
        );

      for (
        const row of settled
      ) {
        if (
          row.status ===
          "fulfilled"
        ) {
          pages.push(
            row.value,
          );
        } else {
          console.warn(
            "Branch fetch failed:",
            row.reason?.message ||
              row.reason,
          );
        }
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150,
          ),
      );
    }

    console.log("");
    console.log(
      `Fetched catalog pages: ${pages.length}`,
    );

    const observations =
      [];

    for (
      const page of pages
    ) {
      const parsed =
        parseMenuPage(
          page.html,
          page,
        );

      console.log(
        `  branch ${
          page.branchId ??
          "default"
        }${
          page.branchName
            ? ` (${page.branchName})`
            : ""
        }: ${parsed.length} menu observations`,
      );

      observations.push(
        ...parsed,
      );
    }

    if (
      observations.length <
      20
    ) {
      throw new Error(
        `Only ${observations.length} menu observations parsed. Aborting to avoid corrupting master data.`,
      );
    }

    /*
     * Dedupe raw observations by branch + normalized menu name.
     */
    const observationMap =
      new Map();

    for (
      const row of observations
    ) {
      const key =
        `${row.sourceBranchId}:${row.normalizedName}`;

      const existing =
        observationMap.get(
          key,
        );

      if (
        !existing ||
        row.prices.length >
          existing.prices.length
      ) {
        observationMap.set(
          key,
          row,
        );
      }
    }

    const uniqueObservations =
      [
        ...observationMap.values(),
      ];

    /*
     * Build union/canonical catalog.
     */
    const canonicalUnion =
      new Map();

    for (
      const row of uniqueObservations
    ) {
      const current =
        canonicalUnion.get(
          row.normalizedName,
        );

      if (!current) {
        canonicalUnion.set(
          row.normalizedName,
          {
            name:
              row.menuName,

            normalizedName:
              row.normalizedName,

            category:
              row.category,

            qaEligible:
              row.qaEligible,

            branches:
              new Set([
                row.sourceBranchId,
              ]),
          },
        );
      } else {
        current.branches.add(
          row.sourceBranchId,
        );

        /*
         * Prefer QA-eligible food category over an online/package
         * category if the same menu is observed in multiple places.
         */
        if (
          !current.qaEligible &&
          row.qaEligible
        ) {
          current.category =
            row.category;

          current.qaEligible =
            true;
        }
      }
    }

    console.log("");
    console.log(
      `Unique website observations: ${uniqueObservations.length}`,
    );
    console.log(
      `Canonical menu names: ${canonicalUnion.size}`,
    );

    const {
      data:
        existingMenus,
      error:
        existingMenuError,
    } =
      await supabase
        .from(
          "qa_food_menus",
        )
        .select(`
          id,
          organization_id,
          source,
          source_menu_key,
          name,
          category,
          canonical_key,
          is_active
        `)
        .eq(
          "organization_id",
          organizationId,
        );

    if (
      existingMenuError
    ) {
      throw existingMenuError;
    }

    const canonicalByKey =
      new Map();

    for (
      const menu of
      existingMenus ?? []
    ) {
      canonicalByKey.set(
        menu.canonical_key ||
          normalizeName(
            menu.name,
          ),
        menu,
      );
    }

    const missingRows =
      [];

    for (
      const item of
      canonicalUnion.values()
    ) {
      if (
        canonicalByKey.has(
          item.normalizedName,
        )
      ) {
        continue;
      }

      missingRows.push({
        organization_id:
          organizationId,

        source:
          "HOTPOT_WEB",

        source_menu_key:
          `web:${item.normalizedName}`,

        canonical_key:
          item.normalizedName,

        name:
          item.name,

        category:
          item.category,

        default_service_standard_seconds:
          780,

        is_active:
          true,

        lifecycle_status:
          "CURRENT",

        current_web_visible:
          true,

        seen_in_api_orders:
          false,

        first_seen_at:
          new Date()
            .toISOString(),

        last_seen_at:
          new Date()
            .toISOString(),

        metadata: {
          discovered_from:
            "hotpot.co.id",
        },
      });
    }

    let createdMenus =
      0;

    if (
      missingRows.length
    ) {
      const created =
        await chunks(
          missingRows,
          200,
          async (
            part,
          ) => {
            const {
              data,
              error,
            } =
              await supabase
                .from(
                  "qa_food_menus",
                )
                .insert(
                  part,
                )
                .select(`
                  id,
                  organization_id,
                  source,
                  source_menu_key,
                  name,
                  category,
                  canonical_key,
                  is_active
                `);

            if (error) {
              throw error;
            }

            return (
              data ?? []
            );
          },
        );

      createdMenus =
        created.length;

      for (
        const menu of created
      ) {
        canonicalByKey.set(
          menu.canonical_key,
          menu,
        );
      }
    }

    /*
     * Refresh web flags/category for existing canonical menus.
     */
    const categoryGroups =
      new Map();

    for (
      const item of
      canonicalUnion.values()
    ) {
      const menu =
        canonicalByKey.get(
          item.normalizedName,
        );

      if (!menu) continue;

      const category =
        item.category ||
        "OTHER";

      if (
        !categoryGroups.has(
          category,
        )
      ) {
        categoryGroups.set(
          category,
          [],
        );
      }

      categoryGroups
        .get(category)
        .push(menu.id);
    }

    const now =
      new Date()
        .toISOString();

    for (
      const [
        category,
        ids,
      ] of categoryGroups
    ) {
      for (
        let i = 0;
        i < ids.length;
        i += 200
      ) {
        const part =
          ids.slice(
            i,
            i + 200,
          );

        const {
          error,
        } =
          await supabase
            .from(
              "qa_food_menus",
            )
            .update({
              category,

              lifecycle_status:
                "CURRENT",

              current_web_visible:
                true,

              last_seen_at:
                now,

              is_active:
                true,
            })
            .in(
              "id",
              part,
            );

        if (error) {
          throw error;
        }
      }
    }

    /*
     * Raw/source observations.
     */
    const observationRows =
      uniqueObservations
        .map(
          (
            row,
          ) => {
            const menu =
              canonicalByKey.get(
                row.normalizedName,
              );

            if (!menu) {
              return null;
            }

            return {
              organization_id:
                organizationId,

              canonical_menu_id:
                menu.id,

              source:
                "HOTPOT_WEB",

              observation_key:
                `branch:${row.sourceBranchId}:name:${row.normalizedName}`,

              source_branch_id:
                row.sourceBranchId,

              menu_name:
                row.menuName,

              normalized_name:
                row.normalizedName,

              category:
                row.category,

              is_variant:
                false,

              is_package:
                row.category ===
                "SET MENU",

              is_current_visible:
                true,

              first_seen_at:
                now,

              last_seen_at:
                now,

              raw_payload: {
                branch_name:
                  row.branchName,

                url:
                  row.url,

                prices:
                  row.prices,

                text:
                  row.rawText,
              },
            };
          },
        )
        .filter(
          Boolean,
        );

    await chunks(
      observationRows,
      250,
      async (
        part,
      ) => {
        const {
          error,
        } =
          await supabase
            .from(
              "qa_food_menu_observations",
            )
            .upsert(
              part,
              {
                onConflict:
                  "organization_id,source,observation_key",
              },
            );

        if (error) {
          throw error;
        }

        return [];
      },
    );

    /*
     * Store discovered branch/source metadata.
     */
    const sourceBranches =
      new Map();

    for (
      const page of pages
    ) {
      const sourceBranchId =
        page.branchId == null
          ? "default"
          : String(
              page.branchId,
            );

      sourceBranches.set(
        sourceBranchId,
        {
          organization_id:
            organizationId,

          source:
            "HOTPOT_WEB",

          source_branch_id:
            sourceBranchId,

          source_branch_name:
            page.branchName,

          outlet_id:
            null,

          mapping_status:
            "UNMAPPED",

          first_seen_at:
            now,

          last_seen_at:
            now,

          metadata: {
            url:
              page.url,
          },
        },
      );
    }

    if (
      sourceBranches.size
    ) {
      const {
        error,
      } =
        await supabase
          .from(
            "qa_food_source_branches",
          )
          .upsert(
            [
              ...sourceBranches.values(),
            ],
            {
              onConflict:
                "organization_id,source,source_branch_id",
            },
          );

      if (error) {
        throw error;
      }
    }

    /*
     * MAX-COVERAGE runtime mapping.
     *
     * Until the API/branch mapping is repaired, every current
     * QA-eligible food discovered on the website is exposed to
     * every restaurant outlet.
     *
     * Exact per-outlet mapping can replace WEB_UNION later.
     */
    const eligibleMenuIds =
      [];

    for (
      const item of
      canonicalUnion.values()
    ) {
      if (
        !item.qaEligible
      ) {
        continue;
      }

      const menu =
        canonicalByKey.get(
          item.normalizedName,
        );

      if (menu) {
        eligibleMenuIds.push(
          menu.id,
        );
      }
    }

    const mappingRows =
      [];

    for (
      const menuId of
      eligibleMenuIds
    ) {
      for (
        const outlet of
        restaurants
      ) {
        mappingRows.push({
          menu_id:
            menuId,

          outlet_id:
            outlet.id,

          source_branch_id:
            "WEB_UNION",

          qa_eligible:
            true,

          service_standard_seconds:
            780,

          is_active:
            true,

          last_synced_at:
            now,
        });
      }
    }

    await chunks(
      mappingRows,
      250,
      async (
        part,
      ) => {
        const {
          error,
        } =
          await supabase
            .from(
              "qa_food_menu_outlets",
            )
            .upsert(
              part,
              {
                onConflict:
                  "menu_id,outlet_id",
              },
            );

        if (error) {
          throw error;
        }

        return [];
      },
    );

    const categorySummary =
      {};

    for (
      const item of
      canonicalUnion.values()
    ) {
      categorySummary[
        item.category ||
          "OTHER"
      ] =
        (
          categorySummary[
            item.category ||
              "OTHER"
          ] ||
          0
        ) +
        1;
    }

    await supabase
      .from(
        "qa_food_sync_runs",
      )
      .update({
        status:
          "COMPLETED",

        completed_at:
          now,

        source_rows:
          observations.length,

        observation_rows:
          observationRows.length,

        created_menus:
          createdMenus,

        updated_menus:
          canonicalUnion.size -
          createdMenus,

        review_rows:
          [...canonicalUnion.values()]
            .filter(
              (
                item,
              ) =>
                !item.qaEligible,
            )
            .length,

        metadata: {
          fetched_pages:
            pages.length,

          branch_ids:
            branchIds,

          canonical_count:
            canonicalUnion.size,

          eligible_count:
            eligibleMenuIds.length,

          outlet_mapping_count:
            mappingRows.length,

          categories:
            categorySummary,
        },
      })
      .eq(
        "id",
        run.id,
      );

    console.log("");
    console.log(
      "========== SYNC RESULT ==========",
    );

    console.log(
      `Raw observations : ${observations.length}`,
    );

    console.log(
      `Unique observations: ${uniqueObservations.length}`,
    );

    console.log(
      `Canonical menus  : ${canonicalUnion.size}`,
    );

    console.log(
      `Created menus    : ${createdMenus}`,
    );

    console.log(
      `QA eligible      : ${eligibleMenuIds.length}`,
    );

    console.log(
      `Outlet mappings  : ${mappingRows.length}`,
    );

    console.log("");
    console.log(
      "Categories:",
    );

    console.table(
      Object.entries(
        categorySummary,
      )
        .sort(
          (
            a,
            b,
          ) =>
            a[0].localeCompare(
              b[0],
            ),
        )
        .map(
          (
            [
              category,
              count,
            ],
          ) => ({
            category,
            count,
            qa_eligible:
              !NON_QA_CATEGORIES.has(
                category,
              ),
          }),
        ),
    );

    console.log("");
    console.log(
      "QA FOOD WEB SYNC OK",
    );
  } catch (error) {
    await supabase
      .from(
        "qa_food_sync_runs",
      )
      .update({
        status:
          "FAILED",

        completed_at:
          new Date()
            .toISOString(),

        error_message:
          error?.message ||
          String(
            error,
          ),
      })
      .eq(
        "id",
        run.id,
      );

    throw error;
  }
}

main().catch(
  (
    error,
  ) => {
    console.error("");
    console.error(
      "QA FOOD WEB SYNC FAILED",
    );

    console.error(
      error,
    );

    process.exit(
      1,
    );
  },
);
