import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  updateSession,
} from "@/lib/supabase/proxy";

export async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  // ==========================================================
  // PUBLIC REPORT ROUTES
  //
  // These routes perform their own server-side authorization:
  //
  // /r/p/... = existing Production public report
  // /r/a/... = secure Outlet Audit share token
  //
  // Do not require a Supabase login session here.
  // ==========================================================

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

  return await updateSession(
    request
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - static image files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
