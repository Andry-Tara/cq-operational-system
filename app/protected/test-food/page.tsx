import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

import { createAdminClient } from "@/lib/supabase/admin";

import { getActiveOutlet } from "@/lib/active-outlet";

import TestFoodClient from "./test-food-client";

function businessDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function TestFoodPage() {
  const [user, outlet] = await Promise.all([
    getCurrentUser(),
    getActiveOutlet(),
  ]);

  if (!user) {
    redirect("/auth/login");
  }

  if (!outlet) {
    redirect("/protected/select-outlet");
  }

  const admin = createAdminClient();

  const [profileResult, outletResult, assignmentResult] = await Promise.all([
    admin
      .from("profiles")
      .select(
        `
          id,
          full_name,
          job_title,
          organization_id,
          is_active
        `,
      )
      .eq("id", user.id)
      .maybeSingle(),

    admin
      .from("outlets")
      .select(
        `
          id,
          code,
          name,
          timezone,
          organization_id,
          is_active
        `,
      )
      .eq("id", outlet.id)
      .eq("is_active", true)
      .maybeSingle(),

    admin
      .from("user_outlets")
      .select(
        `
          outlet_id,
          is_active
        `,
      )
      .eq("user_id", user.id)
      .eq("outlet_id", outlet.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;

  const outletRow = outletResult.data;

  const assignment = assignmentResult.data;

  if (!profile || profile.is_active === false) {
    return <ErrorState message="Active user profile was not found." />;
  }

  if (!outletRow) {
    return <ErrorState message="Active outlet was not found." />;
  }

  if (profile.organization_id !== outletRow.organization_id) {
    return <ErrorState message="Outlet organization mismatch." />;
  }

  if (String(outletRow.code).toUpperCase() === "CNT") {
    return (
      <ErrorState message="Test Food is only available for restaurant outlets." />
    );
  }

  if (!assignment) {
    return (
      <ErrorState message="Test Food can only be completed by an assigned outlet PIC." />
    );
  }

  const date = businessDate(outletRow.timezone || "Asia/Jakarta");

  const [menuScopeResult, sessionsResult] = await Promise.all([
    admin
      .from("test_food_menu_outlets")
      .select(
        `
          menu_id,
          test_food_menus!inner (
            id,
            code,
            name,
            category,
            notes,
            is_seasonal,
            sort_order,
            organization_id,
            is_active
          )
        `,
      )
      .eq("outlet_id", outletRow.id)
      .eq("is_active", true)
      .eq("test_food_menus.organization_id", outletRow.organization_id)
      .eq("test_food_menus.is_active", true),

    admin
      .from("test_food_sessions")
      .select(
        `
          shift,
          result_status
        `,
      )
      .eq("outlet_id", outletRow.id)
      .eq("business_date", date)
      .eq("status", "SUBMITTED")
      .limit(3),
  ]);

  if (menuScopeResult.error) {
    return <ErrorState message={menuScopeResult.error.message} />;
  }

  const menus = (menuScopeResult.data ?? [])
    .flatMap((row: any) => {
      const menu = row.test_food_menus;

      if (Array.isArray(menu)) {
        return menu;
      }

      return menu ? [menu] : [];
    })
    .sort(
      (a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
    );

  const todaySessions = sessionsResult.data ?? [];
  return (
    <TestFoodClient
      outlet={{
        id: outletRow.id,
        code: outletRow.code,
        name: outletRow.name,
      }}
      picName={profile.full_name || user.email || "Outlet PIC"}
      businessDate={date}
      menus={menus}
      submittedShifts={todaySessions ?? []}
    />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#F6F4F1] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl rounded-[28px] border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Test Food
        </p>

        <h1 className="mt-2 text-xl font-black text-[#292824]">
          Unable to Open Test Food
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-600">{message}</p>
      </div>
    </main>
  );
}
