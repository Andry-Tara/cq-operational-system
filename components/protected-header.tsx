"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

type ProtectedHeaderProps = {
  displayName: string;
  roleName: string;
  outletName?: string | null;
  showAdministration: boolean;
  showOpening: boolean;
  showClosing: boolean;
  showReports: boolean;
};

type GlyphKind =
  | "home"
  | "opening"
  | "closing"
  | "reports"
  | "more";

function getBackHref(pathname: string) {
  if (pathname.startsWith("/protected/admin/")) {
    return "/protected/admin";
  }

  if (pathname === "/protected/admin") {
    return "/protected";
  }

  if (pathname.startsWith("/protected/reports")) {
    return "/protected";
  }

  if (pathname.startsWith("/protected/closing")) {
    return "/protected";
  }

  if (pathname.startsWith("/protected/operations")) {
    return "/protected";
  }

  if (pathname.startsWith("/protected/select-outlet")) {
    return "/protected";
  }

  return "/protected";
}

function NavGlyph({
  kind,
}: {
  kind: GlyphKind;
}) {
  if (kind === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10.5 12 3.8l8.5 6.7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" />
      </svg>
    );
  }

  if (kind === "opening") {
    return (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3.5" />
        <path strokeLinecap="round" d="M12 2.7v2.2M12 19.1v2.2M2.7 12h2.2M19.1 12h2.2M5.4 5.4 7 7M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
      </svg>
    );
  }

  if (kind === "closing") {
    return (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 15.5A8.2 8.2 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />
      </svg>
    );
  }

  if (kind === "reports") {
    return (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h9l3 3v14H6z" />
        <path strokeLinecap="round" d="M9 10h6M9 14h6M9 18h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function MobileNavItem({
  href,
  label,
  kind,
  active,
}: {
  href: string;
  label: string;
  kind: GlyphKind;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition ${
        active
          ? "text-red-700"
          : "text-neutral-400 active:bg-neutral-100"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`flex h-7 w-9 items-center justify-center rounded-xl transition ${
          active ? "bg-red-50" : ""
        }`}
      >
        <NavGlyph kind={kind} />
      </span>
      <span className="max-w-full truncate text-[9px] font-bold">
        {label}
      </span>
    </Link>
  );
}

function MenuLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-11 items-center justify-between rounded-xl px-3.5 text-[13px] font-bold text-neutral-700 transition hover:bg-neutral-50 active:bg-neutral-100"
    >
      <span>{label}</span>
      <span className="text-neutral-300">→</span>
    </Link>
  );
}

export function ProtectedHeader({
  displayName,
  roleName,
  outletName,
  showAdministration,
  showOpening,
  showClosing,
  showReports,
}: ProtectedHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] =
    useState(false);

  const isDashboard =
    pathname === "/protected";

  const backHref =
    getBackHref(pathname);

  const isOperationalInput =
    pathname.startsWith(
      "/protected/closing/"
    ) ||
    pathname.startsWith(
      "/protected/operations/"
    );

  const openingActive =
    pathname.startsWith(
      "/protected/operations/"
    );

  const closingActive =
    pathname.startsWith(
      "/protected/closing/"
    );

  const reportsActive =
    pathname.startsWith(
      "/protected/reports"
    );

  const moreActive =
    menuOpen ||
    pathname.startsWith(
      "/protected/admin"
    ) ||
    pathname.startsWith(
      "/protected/select-outlet"
    );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [menuOpen]);

  function refreshPage() {
    window.location.reload();
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[62px] max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-5 md:min-h-[66px] md:px-8">
          {/* LEFT */}
          <div className="flex min-w-0 items-center gap-2.5">
            {!isDashboard && (
              <Link
                href={backHref}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-neutral-200 px-2.5 text-[11px] font-bold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-900"
              >
                ←
                <span className="hidden sm:inline">
                  Back
                </span>
              </Link>
            )}

            <Link
              href="/protected"
              className="min-w-0"
            >
              <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-red-700 sm:text-[10px]">
                Resto Operational System
              </p>

              {outletName && (
                <p className="mt-0.5 max-w-[190px] truncate text-[10px] font-semibold text-neutral-500 lg:hidden">
                  {outletName}
                </p>
              )}
            </Link>
          </div>

          {/* RIGHT */}
          <div className="flex shrink-0 items-center gap-2">
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

            <button
              type="button"
              onClick={refreshPage}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:bg-neutral-50 active:scale-95"
              aria-label="Refresh page"
              title="Refresh page"
            >
              <Image
                src="/icon.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] rounded-md object-cover"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setMenuOpen(true)
              }
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                moreActive
                  ? "border-red-100 bg-red-50 text-red-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <NavGlyph kind="more" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION
          Hidden while user is actively filling operational forms
          so Input Focus Mode keeps maximum screen space. */}
      {!isOperationalInput && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 px-2 pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur md:hidden"
          style={{
            paddingBottom:
              "max(0.45rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-md items-center gap-0.5">
            <MobileNavItem
              href="/protected"
              label="Dashboard"
              kind="home"
              active={isDashboard}
            />

            {showOpening && (
              <MobileNavItem
                href="/protected/operations/OPENING/KITCHEN"
                label="Opening"
                kind="opening"
                active={openingActive}
              />
            )}

            {showClosing && (
              <MobileNavItem
                href="/protected/closing/kitchen"
                label="Closing"
                kind="closing"
                active={closingActive}
              />
            )}

            {showReports && (
              <MobileNavItem
                href="/protected/reports"
                label="Reports"
                kind="reports"
                active={reportsActive}
              />
            )}

            <button
              type="button"
              onClick={() =>
                setMenuOpen(true)
              }
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition ${
                moreActive
                  ? "text-red-700"
                  : "text-neutral-400 active:bg-neutral-100"
              }`}
            >
              <span
                className={`flex h-7 w-9 items-center justify-center rounded-xl ${
                  moreActive
                    ? "bg-red-50"
                    : ""
                }`}
              >
                <NavGlyph kind="more" />
              </span>
              <span className="text-[9px] font-bold">
                More
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* MORE BOTTOM SHEET */}
      {menuOpen && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setMenuOpen(false)
            }
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />

          <section
            className="absolute inset-x-0 bottom-0 max-h-[86svh] overflow-y-auto rounded-t-[24px] border border-neutral-200 bg-white shadow-2xl md:inset-x-auto md:bottom-auto md:right-6 md:top-[76px] md:w-[360px] md:rounded-[20px]"
            style={{
              paddingBottom:
                "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pb-1 pt-2.5 md:hidden">
              <div className="h-1 w-10 rounded-full bg-neutral-200" />
            </div>

            <div className="border-b border-neutral-100 px-5 pb-4 pt-3 md:pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-xs font-black text-red-700">
                  {displayName
                    .trim()
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-neutral-950">
                    {displayName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                    {roleName}
                  </p>
                </div>
              </div>

              {outletName && (
                <div className="mt-3 rounded-xl bg-neutral-50 px-3.5 py-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-neutral-400">
                    Active Outlet
                  </p>
                  <p className="mt-1 truncate text-xs font-bold text-neutral-800">
                    {outletName}
                  </p>
                </div>
              )}
            </div>

            <div className="p-2.5">
              <MenuLink
                href="/protected"
                label="Dashboard"
                onClick={() =>
                  setMenuOpen(false)
                }
              />

              {showAdministration && (
                <MenuLink
                  href="/protected/admin"
                  label="Administration"
                  onClick={() =>
                    setMenuOpen(false)
                  }
                />
              )}

              <MenuLink
                href="/protected/select-outlet"
                label="Change Outlet"
                onClick={() =>
                  setMenuOpen(false)
                }
              />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  refreshPage();
                }}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-3.5 text-[13px] font-bold text-neutral-700 transition hover:bg-neutral-50 active:bg-neutral-100"
              >
                <span>Refresh Page</span>
                <Image
                  src="/icon.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-md object-cover"
                />
              </button>

              <div className="my-2 border-t border-neutral-100" />

              <div className="px-1">
                <LogoutButton compact />
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
