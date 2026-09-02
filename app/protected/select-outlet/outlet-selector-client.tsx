"use client";

import { useState } from "react";

type Outlet = {
  id: string;
  code: string;
  name: string;
  timezone: string | null;
};

export default function OutletSelectorClient({
  outlets,
  allOutletAccess,
}: {
  outlets: Outlet[];
  allOutletAccess: boolean;
}) {
  const [loadingId, setLoadingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function selectOutlet(
    outlet: Outlet
  ) {
    if (loadingId) return;

    try {
      setError(null);
      setLoadingId(outlet.id);

      const response = await fetch(
        "/api/outlet/select",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            outletId: outlet.id,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to select outlet."
        );
      }

      // ======================================================
      // IMPORTANT:
      // Use hard navigation.
      //
      // The selected outlet is stored in an HTTP-only cookie.
      // Server Components must receive the new cookie on the
      // next request.
      //
      // router.push + router.refresh can race in Next.js.
      // ======================================================

      window.location.assign(
        "/protected"
      );
    } catch (err: any) {
      console.error(
        "Select outlet error:",
        err
      );

      setError(
        err?.message ||
          "Unable to select outlet."
      );

      setLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f4f4] px-5 py-10 text-[#202020] md:px-8">
      <div className="mx-auto max-w-[1100px]">

        <div className="mb-10">

          <div className="inline-flex rounded-full bg-red-50 px-4 py-2 text-xs font-bold tracking-wide text-red-700">
            RESTO OPERATIONAL SYSTEM
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Select Outlet
              </h1>

              <p className="mt-3 max-w-xl leading-7 text-neutral-500">
                Pilih outlet yang ingin
                digunakan untuk operational
                report.
              </p>
            </div>

            <a
              href="/protected"
              className="inline-flex w-fit items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            >
              ← Dashboard
            </a>
          </div>

          {allOutletAccess && (
            <div className="mt-4 inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-500">
              All Outlet Access
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {!outlets.length ? (
          <div className="rounded-[24px] border border-black/5 bg-white p-10 text-center shadow-sm">

            <div className="text-4xl">
              🏪
            </div>

            <h2 className="mt-5 text-xl font-bold">
              No Outlet Access
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              User ini belum memiliki
              assignment outlet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {outlets.map(
              (outlet) => {
                const loading =
                  loadingId === outlet.id;

                return (
                  <button
                    key={outlet.id}
                    type="button"
                    disabled={
                      loadingId !== null
                    }
                    onClick={() =>
                      selectOutlet(outlet)
                    }
                    className="group rounded-[24px] border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-red-100 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-700">
                        {outlet.code}
                      </div>

                      <span className="text-xl text-neutral-300 transition group-hover:translate-x-1 group-hover:text-red-700">
                        →
                      </span>
                    </div>

                    <h2 className="mt-7 text-lg font-bold">
                      {outlet.name}
                    </h2>

                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {outlet.code}
                    </p>

                    <div className="mt-6 border-t border-neutral-100 pt-4">

                      <span className="text-sm font-semibold text-red-700">
                        {loading
                          ? "Opening..."
                          : "Open Outlet"}
                      </span>

                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}
