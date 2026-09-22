import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  hasEnvVars,
} from "../utils";

function authErrorCode(
  error: unknown
) {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return "";
  }

  const value =
    error as {
      code?: unknown;
    };

  return String(
    value.code ??
      ""
  );
}

function authErrorStatus(
  error: unknown
) {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return 0;
  }

  const value =
    error as {
      status?: unknown;
    };

  const status =
    Number(
      value.status
    );

  return Number.isFinite(
    status
  )
    ? status
    : 0;
}

function authErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    return String(
      (
        error as {
          message?: unknown;
        }
      ).message ??
        ""
    );
  }

  return "";
}

function isRateLimited(
  error: unknown
) {
  return (
    authErrorStatus(
      error
    ) === 429 ||
    authErrorCode(
      error
    ) ===
      "over_request_rate_limit"
  );
}

function isInvalidRefreshToken(
  error: unknown
) {
  const code =
    authErrorCode(
      error
    );

  const message =
    authErrorMessage(
      error
    ).toLowerCase();

  return (
    code ===
      "refresh_token_not_found" ||
    code ===
      "refresh_token_already_used" ||
    message.includes(
      "refresh token not found"
    ) ||
    message.includes(
      "invalid refresh token"
    )
  );
}

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse
) {
  for (
    const cookie
    of source.cookies.getAll()
  ) {
    destination.cookies.set(
      cookie
    );
  }
}

function redirectToLogin(
  request: NextRequest,
  sourceResponse: NextResponse,
  reason?: string
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    "/auth/login";

  url.search = "";

  if (reason) {
    url.searchParams.set(
      "reason",
      reason
    );
  }

  const response =
    NextResponse.redirect(
      url
    );

  copyResponseCookies(
    sourceResponse,
    response
  );

  return response;
}

function clearStaleAuthCookies(
  request: NextRequest,
  response: NextResponse
) {
  for (
    const cookie
    of request.cookies.getAll()
  ) {
    const name =
      cookie.name;

    const isSupabaseAuthCookie =
      name.startsWith(
        "sb-"
      ) &&
      (
        name.includes(
          "auth-token"
        ) ||
        name.includes(
          "code-verifier"
        )
      );

    if (
      !isSupabaseAuthCookie
    ) {
      continue;
    }

    response.cookies.set({
      name,
      value: "",
      path: "/",
      maxAge: 0,
      expires:
        new Date(0),
    });
  }

  /*
   * Prevent a new user/session from inheriting
   * a previous user's outlet selection.
   */
  response.cookies.set({
    name:
      "cq_active_outlet",
    value: "",
    path: "/",
    maxAge: 0,
    expires:
      new Date(0),
  });
}

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            for (
              const {
                name,
                value,
              }
              of cookiesToSet
            ) {
              request.cookies.set(
                name,
                value
              );
            }

            supabaseResponse =
              NextResponse.next({
                request,
              });

            for (
              const {
                name,
                value,
                options,
              }
              of cookiesToSet
            ) {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          },
        },
      }
    );

  let claims:
    Record<
      string,
      unknown
    > |
    undefined;

  try {
    const {
      data,
      error,
    } =
      await supabase.auth.getClaims();

    if (error) {
      if (
        isInvalidRefreshToken(
          error
        )
      ) {
        const response =
          redirectToLogin(
            request,
            supabaseResponse,
            "session_expired"
          );

        clearStaleAuthCookies(
          request,
          response
        );

        return response;
      }

      if (
        isRateLimited(
          error
        )
      ) {
        /*
         * Do not repeatedly hit Auth while Supabase
         * is throttling refresh requests.
         *
         * Public login route bypasses updateSession,
         * so the loop stops here.
         */
        return redirectToLogin(
          request,
          supabaseResponse,
          "rate_limited"
        );
      }

      return redirectToLogin(
        request,
        supabaseResponse,
        "session_invalid"
      );
    }

    claims =
      data?.claims;
  } catch (error) {
    if (
      isInvalidRefreshToken(
        error
      )
    ) {
      const response =
        redirectToLogin(
          request,
          supabaseResponse,
          "session_expired"
        );

      clearStaleAuthCookies(
        request,
        response
      );

      return response;
    }

    if (
      isRateLimited(
        error
      )
    ) {
      return redirectToLogin(
        request,
        supabaseResponse,
        "rate_limited"
      );
    }

    console.error(
      "Supabase proxy auth check failed:",
      error
    );

    return redirectToLogin(
      request,
      supabaseResponse,
      "session_invalid"
    );
  }

  if (
    request.nextUrl.pathname !==
      "/" &&
    !claims
  ) {
    return redirectToLogin(
      request,
      supabaseResponse
    );
  }

  return supabaseResponse;
}
