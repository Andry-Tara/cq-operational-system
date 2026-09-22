import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  updateSession,
} from "@/lib/supabase/proxy";

function isPublicAuthRoute(
  pathname: string
) {
  return (
    pathname === "/auth/login" ||
    pathname.startsWith(
      "/auth/login/"
    ) ||
    pathname ===
      "/auth/forgot-password" ||
    pathname.startsWith(
      "/auth/forgot-password/"
    ) ||
    pathname ===
      "/auth/sign-up" ||
    pathname.startsWith(
      "/auth/sign-up/"
    ) ||
    pathname ===
      "/auth/sign-up-success" ||
    pathname.startsWith(
      "/auth/sign-up-success/"
    ) ||
    pathname ===
      "/auth/error" ||
    pathname.startsWith(
      "/auth/error/"
    ) ||
    pathname ===
      "/auth/confirm" ||
    pathname.startsWith(
      "/auth/confirm/"
    ) ||
    pathname === "/login" ||
    pathname.startsWith(
      "/login/"
    )
  );
}

export async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  /*
   * Public report routes perform
   * their own authorization.
   */
  if (
    pathname.startsWith(
      "/r/p/"
    ) ||
    pathname.startsWith(
      "/r/a/"
    )
  ) {
    return NextResponse.next();
  }

  /*
   * CRITICAL:
   *
   * Login / sign-up / recovery entry routes
   * must NOT try to refresh an already broken
   * Supabase session.
   *
   * Otherwise:
   *
   * invalid refresh token
   *   -> /auth/login
   *   -> proxy getClaims()
   *   -> refresh again
   *   -> /auth/login
   *   -> repeated auth traffic / 429
   *
   * /auth/update-password intentionally remains
   * behind updateSession because a password recovery
   * session may need its auth cookies refreshed.
   */
  if (
    isPublicAuthRoute(
      pathname
    )
  ) {
    return NextResponse.next();
  }

  return updateSession(
    request
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
