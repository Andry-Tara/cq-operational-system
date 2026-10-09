import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import FoodStandardClient from "../food-standard-client";

export default async function QaFoodStandardPage() {
  const [
    access,
    outlet,
  ] =
    await Promise.all([
      getAccessContext(),
      getActiveOutlet(),
    ]);

  const {
    user,
    isAdmin,
    permissionCodes,
  } =
    access;

  if (!user) {
    redirect(
      "/auth/login",
    );
  }

  if (!outlet) {
    redirect(
      "/protected/select-outlet",
    );
  }

  const canUseAudit =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit",
    ) ||
    permissionCodes.includes(
      "audit.view_management",
    );

  if (!canUseAudit) {
    redirect(
      "/protected",
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-6 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-amber-50/50 px-5 py-7 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                  Audit &amp; Quality
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  QA Food Standard
                </h1>

                <p className="mt-2 text-sm font-medium text-neutral-500">
                  Kitchen Speed &amp; Menu Quality
                </p>
              </div>

              <Link
                href="/protected/audit/food-standard"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-700 transition hover:bg-neutral-50"
              >
                QA Dashboard
              </Link>
            </div>
          </header>

          <div className="px-5 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Target"
                value="10 Menu"
              />

              <Metric
                label="Service Standard"
                value="≤ 13 Min"
              />

              <Metric
                label="Ordering"
                value="Partial"
              />
            </div>

            <div className="mt-6 rounded-[24px] border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                Current Outlet
              </p>

              <h2 className="mt-2 text-xl font-black text-[#292824]">
                {outlet.name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Satu QA session menguji total 10 menu.
                Menu dapat dipesan bertahap selama
                session tetap berjalan.
              </p>
            </div>

            <FoodStandardClient
              outlet={{
                id:
                  outlet.id,
                code:
                  outlet.code,
                name:
                  outlet.name,
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-neutral-200 bg-white p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-[#292824]">
        {value}
      </p>
    </div>
  );
}
