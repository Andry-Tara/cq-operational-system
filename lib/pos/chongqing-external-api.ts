const DEFAULT_TIMEOUT_MS =
  30000;


export type ChongqingBranch = {
  id:
    number;

  name:
    string;

  address?:
    string |
    null;

  phone_number?:
    string |
    null;

  status?:
    number |
    null;
};


export type ChongqingOrderItem = {
  id:
    number;

  order_id:
    number;

  menu_id?:
    number |
    null;

  sku?:
    string |
    null;

  variant_id?:
    number |
    null;

  variant_sku?:
    string |
    null;

  name:
    string;

  qty?:
    number |
    null;

  price?:
    number |
    null;

  total_price?:
    number |
    null;

  discount?:
    number |
    null;

  status?:
    string |
    null;

  user_id?:
    number |
    null;

  complimentary?:
    number |
    boolean |
    null;

  is_package?:
    number |
    boolean |
    null;

  is_half_portion?:
    number |
    boolean |
    null;

  is_three_portion?:
    number |
    boolean |
    null;

  is_personal?:
    number |
    boolean |
    null;

  is_glass?:
    number |
    boolean |
    null;

  is_cashback?:
    number |
    boolean |
    null;

  is_void?:
    number |
    boolean |
    null;

  void_reason?:
    string |
    null;

  void_time?:
    unknown;

  void_by?:
    unknown;

  void_manager_by?:
    unknown;

  created_at?:
    string |
    null;

  updated_at?:
    string |
    null;

  package_items?:
    unknown[];

  [key: string]:
    unknown;
};


export type ChongqingOrder = {
  id:
    number;

  order_code?:
    string |
    null;

  branch_id:
    number;

  order_type?:
    string |
    null;

  table_number?:
    string |
    number |
    null;

  customer_name?:
    string |
    null;

  promo_discount?:
    number |
    null;

  ppn?:
    number |
    null;

  service_charge?:
    number |
    null;

  service_charge_7percent?:
    number |
    null;

  rounding_value?:
    number |
    null;

  total_price?:
    number |
    null;

  amount_paid?:
    number |
    null;

  status?:
    string |
    null;

  payment_method?:
    string |
    null;

  payment_status?:
    string |
    null;

  user_id?:
    number |
    null;

  pax?:
    number |
    null;

  is_void?:
    number |
    boolean |
    null;

  void_reason?:
    string |
    null;

  void_time?:
    unknown;

  void_by?:
    unknown;

  void_manager_by?:
    unknown;

  created_at?:
    string |
    null;

  updated_at?:
    string |
    null;

  items?:
    ChongqingOrderItem[];

  [key: string]:
    unknown;
};


type PaginatedResponse<T> = {
  data:
    T[];

  links?: {
    next?:
      string |
      null;
  };

  meta?: {
    current_page?:
      number;

    last_page?:
      number;

    per_page?:
      number;

    total?:
      number;
  };
};


function config() {
  const baseUrl =
    String(
      process.env
        .CHONGQING_POS_API_BASE_URL ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );


  const apiKey =
    String(
      process.env
        .CHONGQING_POS_API_KEY ||
      ""
    ).trim();


  if (!baseUrl) {
    throw new Error(
      "CHONGQING_POS_API_BASE_URL is not configured."
    );
  }


  if (!apiKey) {
    throw new Error(
      "CHONGQING_POS_API_KEY is not configured."
    );
  }


  return {
    baseUrl,
    apiKey,
  };
}


async function apiFetch<T>(
  path:
    string,

  params?:
    Record<
      string,
      string |
      number |
      null |
      undefined
    >
) {
  const {
    baseUrl,
    apiKey,
  } =
    config();


  const url =
    new URL(
      `${baseUrl}${path}`
    );


  for (
    const [
      key,
      value,
    ] of
      Object.entries(
        params ??
        {}
      )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null ||
      value ===
        ""
    ) {
      continue;
    }


    url.searchParams.set(
      key,
      String(
        value
      )
    );
  }


  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () =>
        controller.abort(),
      DEFAULT_TIMEOUT_MS
    );


  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            "X-Api-Key":
              apiKey,

            Accept:
              "application/json",
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );


    const body =
      await response
        .json()
        .catch(
          () =>
            null
        );


    if (!response.ok) {
      const retryAfter =
        response.headers.get(
          "Retry-After"
        );


      const message =
        body?.message ||
        `ChongQing API request failed with HTTP ${response.status}.`;


      throw new Error(
        response.status ===
          429 &&
        retryAfter
          ? `${message} Retry after ${retryAfter} seconds.`
          : message
      );
    }


    return body as T;

  } finally {
    clearTimeout(
      timer
    );
  }
}


export function posApiConfigured() {
  return Boolean(
    String(
      process.env
        .CHONGQING_POS_API_BASE_URL ||
      ""
    ).trim() &&
    String(
      process.env
        .CHONGQING_POS_API_KEY ||
      ""
    ).trim()
  );
}


export function posApiBaseUrl() {
  return String(
    process.env
      .CHONGQING_POS_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}


export async function fetchPosBranches() {
  const response =
    await apiFetch<{
      data:
        ChongqingBranch[];
    }>(
      "/branches"
    );


  return response.data ??
    [];
}


export async function fetchPosOrdersPage({
  dateFrom,
  dateTo,
  page,
}: {
  dateFrom:
    string;

  dateTo:
    string;

  page:
    number;
}) {
  return apiFetch<
    PaginatedResponse<
      ChongqingOrder
    >
  >(
    "/orders",
    {
      date_from:
        dateFrom,

      date_to:
        dateTo,

      page,

      per_page:
        100,
    }
  );
}


export function asBoolean(
  value:
    unknown
) {
  return (
    value ===
      true ||
    value ===
      1 ||
    value ===
      "1"
  );
}


export function rawText(
  value:
    unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return null;
  }


  if (
    typeof value ===
      "string"
  ) {
    return value;
  }


  return JSON.stringify(
    value
  );
}


export function asNumber(
  value:
    unknown
) {
  const number =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


export function businessDateForTimestamp(
  timestamp:
    string |
    null |
    undefined,

  timezone:
    string
) {
  const date =
    timestamp
      ? new Date(
          timestamp
        )
      : new Date();


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone ||
          "Asia/Jakarta",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).format(
      new Date()
    );
  }


  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    date
  );
}


export function jakartaDate(
  offsetDays = 0
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Jakarta",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );


  const get =
    (
      type:
        string
    ) =>
      parts.find(
        item =>
          item.type ===
          type
      )?.value ||
      "";


  const base =
    new Date(
      `${get("year")}-${get("month")}-${get("day")}T12:00:00Z`
    );


  base.setUTCDate(
    base.getUTCDate() +
    offsetDays
  );


  return base
    .toISOString()
    .slice(
      0,
      10
    );
}
