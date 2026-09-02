"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";

function getBackHref(pathname: string) {
  if (
    pathname.startsWith(
      "/protected/admin/"
    )
  ) {
    return "/protected/admin";
  }

  if (
    pathname ===
    "/protected/admin"
  ) {
    return "/protected";
  }

  if (
    pathname.startsWith(
      "/protected/reports"
    )
  ) {
    return "/protected";
  }

  if (
    pathname.startsWith(
      "/protected/closing"
    )
  ) {
    return "/protected";
  }

  if (
    pathname.startsWith(
      "/protected/select-outlet"
    )
  ) {
    return "/protected";
  }

  return "/protected";
}

export function ProtectedHeader({
  displayName,
  roleName,
  outletName,
  showAdministration,
}: {
  displayName: string;
  roleName: string;
  outletName?: string | null;
  showAdministration: boolean;
}) {
  const pathname =
    usePathname();

  const isDashboard =
    pathname === "/protected";

  const backHref =
    getBackHref(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/95 backdrop-blur">

      <div className="mx-auto flex min-h-[68px] max-w-[1480px] items-center justify-between gap-4 px-5 md:px-8">

        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3">

          {!isDashboard && (
            <Link
              href={backHref}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-xs font-bold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              ← Back
            </Link>
          )}

          <Link
            href="/protected"
            className="min-w-0"
          >
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-red-700 sm:text-[11px]">
              Resto Operational System
            </p>
          </Link>

        </div>


        {/* RIGHT */}
        <div className="flex shrink-0 items-center gap-3">

          {outletName && (
            <div className="hidden text-right lg:block">
              <p className="text-[8px] font-black uppercase tracking-wide text-neutral-400">
                Active Outlet
              </p>

              <p className="mt-0.5 max-w-[150px] truncate text-xs font-bold text-neutral-800">
                {outletName}
              </p>
            </div>
          )}

          <div className="hidden border-l border-neutral-200 pl-4 text-right md:block">
            <p className="max-w-[170px] truncate text-xs font-bold text-neutral-800">
              {displayName}
            </p>

            <p className="mt-0.5 max-w-[170px] truncate text-[10px] text-neutral-400">
              {roleName}
            </p>
          </div>


          <details className="group relative">

            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-neutral-300 [&::-webkit-details-marker]:hidden">
              Menu
              <span className="text-neutral-400 transition group-open:rotate-180">
                ▾
              </span>
            </summary>

            <div className="absolute right-0 mt-2 w-[230px] overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">

              <div className="border-b border-neutral-100 px-3 py-3 md:hidden">
                <p className="truncate text-xs font-bold text-neutral-900">
                  {displayName}
                </p>

                <p className="mt-1 truncate text-[10px] text-neutral-400">
                  {roleName}
                </p>

                {outletName && (
                  <p className="mt-2 truncate text-[10px] font-bold text-red-700">
                    {outletName}
                  </p>
                )}
              </div>

              <Link
                href="/protected"
                className="flex rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Dashboard
              </Link>

              {showAdministration && (
                <Link
                  href="/protected/admin"
                  className="flex rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  Administration
                </Link>
              )}

              <Link
                href="/protected/select-outlet"
                className="flex rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Change Outlet
              </Link>

              <div className="my-2 border-t border-neutral-100" />

              <LogoutButton compact />

            </div>

          </details>

        </div>

      </div>

    </header>
  );
}
