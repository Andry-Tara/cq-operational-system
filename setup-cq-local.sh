#!/bin/bash
set -e

echo "======================================"
echo " CQ Operational System - Local Setup"
echo "======================================"

mkdir -p app/protected/closing/kitchen

# ============================================================
# PROTECTED LAYOUT
# Menghilangkan header Supabase Starter bawaan
# ============================================================

cat > app/protected/layout.tsx <<'TSX'
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
TSX


# ============================================================
# DASHBOARD
# ============================================================

cat > app/protected/page.tsx <<'TSX'
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, job_title, organization_id")
    .eq("id", user.id)
    .single();

  const { data: outletAccess } = await supabase
    .from("user_outlets")
    .select(`
      outlet_id,
      is_primary,
      outlets (
        id,
        code,
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawOutlet: any = outletAccess?.outlets;

  const outlet =
    Array.isArray(rawOutlet)
      ? rawOutlet[0]
      : rawOutlet;

  const { data: roleAccess } = await supabase
    .from("user_roles")
    .select(`
      roles (
        code,
        name,
        is_admin
      )
    `)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const rawRole: any = roleAccess?.roles;

  const role =
    Array.isArray(rawRole)
      ? rawRole[0]
      : rawRole;

  const { data: closingForm } = await supabase
    .from("forms")
    .select("id, code, name")
    .eq("code", "CLOSING")
    .eq("is_active", true)
    .maybeSingle();

  let questionCount = 0;
  let kitchenName = "BOH / Kitchen";

  if (closingForm && outlet?.id) {
    const { data: kitchenSection } = await supabase
      .from("sections")
      .select("id, name")
      .eq("form_id", closingForm.id)
      .eq("code", "KITCHEN")
      .eq("is_active", true)
      .maybeSingle();

    if (kitchenSection) {
      kitchenName = kitchenSection.name;

      const { data: assignment } = await supabase
        .from("outlet_form_assignments")
        .select("form_version_id")
        .eq("outlet_id", outlet.id)
        .eq("form_id", closingForm.id)
        .eq("is_active", true)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignment) {
        const { data: versionSection } = await supabase
          .from("form_version_sections")
          .select("id")
          .eq("form_version_id", assignment.form_version_id)
          .eq("section_id", kitchenSection.id)
          .eq("is_active", true)
          .maybeSingle();

        if (versionSection) {
          const { count } = await supabase
            .from("questions")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("version_section_id", versionSection.id)
            .eq("is_active", true);

          questionCount = count ?? 0;
        }
      }
    }
  }

  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-red-500">
              CHONG QING HOT POT
            </p>

            <h1 className="mt-1 text-xl font-bold">
              CQ Operational System
            </h1>
          </div>

          <div className="text-right">
            <p className="text-xs text-neutral-500">
              Logged in as
            </p>

            <p className="text-sm text-neutral-300">
              {user.email}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section>
          <p className="text-sm text-neutral-500">
            Selamat datang,
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            {profile?.full_name ?? "CQ User"}
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {role?.name && (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-400">
                {role.name}
              </span>
            )}

            {profile?.job_title && (
              <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-neutral-400">
                {profile.job_title}
              </span>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#151515] p-6">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Outlet
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {outlet?.name ?? "No Outlet Assigned"}
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              {outlet?.code ?? "-"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#151515] p-6">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Hari Ini
            </p>

            <p className="mt-3 text-xl font-semibold capitalize">
              {today}
            </p>
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
            Daily Operation
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            Checklist Outlet
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div className="rounded-3xl border border-white/10 bg-[#151515] p-6 opacity-50">
              <div className="text-3xl">
                ☀️
              </div>

              <h4 className="mt-5 text-2xl font-bold">
                Opening
              </h4>

              <p className="mt-2 text-sm text-neutral-500">
                Opening checklist akan tersedia pada fase berikutnya.
              </p>

              <div className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-neutral-500">
                COMING SOON
              </div>
            </div>

            <div className="rounded-3xl border border-red-500/30 bg-gradient-to-b from-red-500/10 to-[#151515] p-6">
              <div className="flex items-center justify-between">
                <div className="text-3xl">
                  🌙
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  READY
                </span>
              </div>

              <h4 className="mt-5 text-2xl font-bold">
                Closing
              </h4>

              <p className="mt-1 text-neutral-400">
                {kitchenName}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 p-4">
                  <p className="text-xs text-neutral-500">
                    Questions
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {questionCount}
                  </p>
                </div>

                <div className="rounded-2xl bg-black/25 p-4">
                  <p className="text-xs text-neutral-500">
                    Status
                  </p>

                  <p className="mt-1 text-lg font-bold text-emerald-400">
                    Ready
                  </p>
                </div>
              </div>

              <Link
                href="/protected/closing/kitchen"
                className="mt-6 flex w-full items-center justify-center rounded-2xl bg-red-600 px-5 py-4 font-semibold transition hover:bg-red-500"
              >
                Start Closing →
              </Link>
            </div>

          </div>
        </section>

        {role?.is_admin && (
          <section className="mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
              Administration
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#151515] p-5">
                <div className="text-2xl">
                  👥
                </div>

                <p className="mt-3 font-semibold">
                  Users & Permission
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Coming next
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#151515] p-5">
                <div className="text-2xl">
                  📝
                </div>

                <p className="mt-3 font-semibold">
                  Form Builder
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Add, edit & disable questions
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#151515] p-5">
                <div className="text-2xl">
                  📊
                </div>

                <p className="mt-3 font-semibold">
                  Reports
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Operational history
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
TSX


# ============================================================
# CLOSING KITCHEN
# ============================================================

cat > app/protected/closing/kitchen/page.tsx <<'TSX'
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export default async function ClosingKitchenPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: outletAccess } = await supabase
    .from("user_outlets")
    .select(`
      outlet_id,
      outlets (
        id,
        code,
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawOutlet: any = outletAccess?.outlets;

  const outlet =
    Array.isArray(rawOutlet)
      ? rawOutlet[0]
      : rawOutlet;

  if (!outlet) {
    return (
      <ErrorBox message="Outlet belum di-assign ke user." />
    );
  }

  const { data: closingForm } = await supabase
    .from("forms")
    .select("id")
    .eq("code", "CLOSING")
    .eq("is_active", true)
    .maybeSingle();

  if (!closingForm) {
    return (
      <ErrorBox message="Closing Form tidak ditemukan." />
    );
  }

  const { data: assignment } = await supabase
    .from("outlet_form_assignments")
    .select("form_version_id")
    .eq("outlet_id", outlet.id)
    .eq("form_id", closingForm.id)
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment) {
    return (
      <ErrorBox message="Closing belum di-assign ke outlet." />
    );
  }

  const { data: kitchenSection } = await supabase
    .from("sections")
    .select("id, name")
    .eq("form_id", closingForm.id)
    .eq("code", "KITCHEN")
    .eq("is_active", true)
    .maybeSingle();

  if (!kitchenSection) {
    return (
      <ErrorBox message="Kitchen Section tidak ditemukan." />
    );
  }

  const { data: versionSection } = await supabase
    .from("form_version_sections")
    .select("id")
    .eq("form_version_id", assignment.form_version_id)
    .eq("section_id", kitchenSection.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!versionSection) {
    return (
      <ErrorBox message="Kitchen belum tersedia pada version aktif." />
    );
  }

  const { data: groups } = await supabase
    .from("question_groups")
    .select(`
      id,
      code,
      name,
      description,
      sort_order
    `)
    .eq("version_section_id", versionSection.id)
    .eq("is_active", true)
    .order("sort_order");

  const { data: questions } = await supabase
    .from("questions")
    .select(`
      id,
      question_group_id,
      question_text,
      help_text,
      question_type,
      is_required,
      unit,
      min_value,
      max_value,
      sort_order,
      config
    `)
    .eq("version_section_id", versionSection.id)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090909]/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="flex items-center justify-between">
            <Link
              href="/protected"
              className="text-sm text-neutral-400"
            >
              ← Dashboard
            </Link>

            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
              CLOSING
            </span>
          </div>

          <p className="mt-5 text-xs font-bold tracking-[0.2em] text-red-500">
            CHONG QING HOT POT
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            BOH / Kitchen
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            {outlet.name}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-[#151515] p-5">
          <div>
            <p className="text-xs uppercase text-neutral-500">
              Outlet
            </p>

            <p className="mt-1 font-bold">
              {outlet.code}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-neutral-500">
              Groups
            </p>

            <p className="mt-1 font-bold">
              {groups?.length ?? 0}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-neutral-500">
              Questions
            </p>

            <p className="mt-1 font-bold">
              {questions?.length ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          ✓ Dynamic form connected to Supabase
        </div>

        <div className="mt-8 space-y-10">
          {(groups ?? []).map((group, groupIndex) => {

            const groupQuestions =
              questions?.filter(
                (question) =>
                  question.question_group_id === group.id
              ) ?? [];

            return (
              <section key={group.id}>

                <div className="mb-4 flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 font-bold text-red-400">
                    {groupIndex + 1}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold">
                      {group.name}
                    </h2>

                    {group.description && (
                      <p className="mt-1 text-sm text-neutral-500">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">

                  {groupQuestions.map((question) => {

                    const needsReview =
                      question.config?.needs_review === true;

                    return (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-white/10 bg-[#151515] p-5"
                      >
                        <div className="flex items-start gap-2">

                          <p className="flex-1 font-medium leading-relaxed">
                            {question.question_text}
                          </p>

                          {question.is_required && (
                            <span className="text-red-500">
                              *
                            </span>
                          )}

                        </div>

                        {question.help_text && (
                          <p className="mt-2 text-sm text-neutral-500">
                            {question.help_text}
                          </p>
                        )}

                        {question.question_type === "yes_no" && (
                          <div className="mt-4 grid grid-cols-2 gap-2">

                            <button className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm font-bold text-emerald-400">
                              ✓ YES
                            </button>

                            <button className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-bold text-red-400">
                              ✕ NO
                            </button>

                          </div>
                        )}

                        {question.question_type === "temperature" && (
                          <div className="mt-4">

                            <div className="flex items-center gap-2">

                              <input
                                type="number"
                                disabled
                                placeholder="0.0"
                                className="w-36 rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                              />

                              <span className="text-neutral-500">
                                {question.unit}
                              </span>

                            </div>

                            {question.min_value !== null &&
                              question.max_value !== null && (
                                <p className="mt-2 text-xs text-neutral-500">
                                  Standard {question.min_value} – {question.max_value}{question.unit}
                                </p>
                              )}

                            {question.min_value === null &&
                              question.max_value !== null && (
                                <p className="mt-2 text-xs text-neutral-500">
                                  Standard ≤ {question.max_value}{question.unit}
                                </p>
                              )}

                          </div>
                        )}

                        {needsReview && (
                          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                            ⚠ Question wording requires Admin review.
                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              </section>
            );
          })}
        </div>

        <div className="h-20" />
      </div>
    </main>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-5 text-white">
      <div className="max-w-md rounded-3xl border border-red-500/20 bg-[#151515] p-8 text-center">

        <div className="text-4xl">
          ⚠️
        </div>

        <h1 className="mt-4 text-xl font-bold">
          Unable to Load Closing
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          {message}
        </p>

        <Link
          href="/protected"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
        >
          Back to Dashboard
        </Link>

      </div>
    </main>
  );
}
TSX


echo ""
echo "======================================"
echo " CQ Operational System files installed"
echo "======================================"
echo ""
echo "Dashboard:"
echo "app/protected/page.tsx"
echo ""
echo "Closing:"
echo "app/protected/closing/kitchen/page.tsx"
echo ""
