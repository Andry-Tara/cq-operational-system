import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveOutlet } from "@/lib/active-outlet";

import ClosingKitchenClient from "./closing-kitchen-client";


export default async function ClosingKitchenPage() {
  const supabase = await createClient();

  // ==========================================================
  // AUTH
  // ==========================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ==========================================================
  // PROFILE
  // ==========================================================

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      job_title,
      organization_id
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <ErrorState message="Profile user tidak ditemukan." />
    );
  }

  // ==========================================================
  // ACTIVE OUTLET
  //
  // Reads cq_active_outlet cookie.
  //
  // Admin / Management:
  //   can select any active outlet.
  //
  // Normal user:
  //   only assigned user_outlets.
  // ==========================================================

  const outlet = await getActiveOutlet();

  if (!outlet) {
    redirect("/protected/select-outlet");
  }

  // ==========================================================
  // DOUBLE CHECK OUTLET ACCESS
  // ==========================================================

  const { data: hasOutletAccess } =
    await supabase.rpc(
      "has_outlet_access",
      {
        p_outlet_id: outlet.id,
      }
    );

  if (hasOutletAccess !== true) {
    return (
      <ErrorState
        message="Anda tidak memiliki akses ke outlet ini."
        showChangeOutlet
      />
    );
  }

  // ==========================================================
  // CLOSING FORM
  // ==========================================================

  const { data: form } = await supabase
    .from("forms")
    .select(`
      id,
      code,
      name,
      organization_id
    `)
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq("code", "CLOSING")
    .eq("is_active", true)
    .maybeSingle();

  if (!form) {
    return (
      <ErrorState message="Form Closing belum tersedia." />
    );
  }

  // ==========================================================
  // OUTLET FORM ASSIGNMENT
  //
  // Each outlet can have its own active form version.
  // ==========================================================

  const {
    data: assignment,
    error: assignmentError,
  } = await supabase
    .from("outlet_form_assignments")
    .select(`
      id,
      outlet_id,
      form_id,
      form_version_id,
      is_active,
      effective_from
    `)
    .eq("outlet_id", outlet.id)
    .eq("form_id", form.id)
    .eq("is_active", true)
    .order("effective_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    return (
      <ErrorState
        message={`Unable to load Closing assignment: ${assignmentError.message}`}
      />
    );
  }

  if (!assignment) {
    return (
      <ErrorState
        message={`Closing belum diaktifkan untuk ${outlet.name}.`}
        showChangeOutlet
      />
    );
  }

  // ==========================================================
  // FORM VERSION
  // ==========================================================

  const {
    data: formVersion,
    error: versionError,
  } = await supabase
    .from("form_versions")
    .select(`
      id,
      form_id,
      version_number,
      status
    `)
    .eq(
      "id",
      assignment.form_version_id
    )
    .maybeSingle();

  if (versionError) {
    return (
      <ErrorState
        message={`Unable to load form version: ${versionError.message}`}
      />
    );
  }

  if (!formVersion) {
    return (
      <ErrorState message="Closing form version tidak ditemukan." />
    );
  }

  // ==========================================================
  // KITCHEN SECTION
  // ==========================================================

  const {
    data: section,
    error: sectionError,
  } = await supabase
    .from("sections")
    .select(`
      id,
      form_id,
      code,
      name,
      description
    `)
    .eq("form_id", form.id)
    .eq("code", "KITCHEN")
    .eq("is_active", true)
    .maybeSingle();

  if (sectionError) {
    return (
      <ErrorState
        message={`Unable to load Kitchen section: ${sectionError.message}`}
      />
    );
  }

  if (!section) {
    return (
      <ErrorState message="Section Kitchen belum tersedia." />
    );
  }

  // ==========================================================
  // CHECK SECTION INCLUDED IN FORM VERSION
  // ==========================================================

  const {
    data: versionSection,
    error: versionSectionError,
  } = await supabase
    .from("form_version_sections")
    .select(`
      id,
      form_version_id,
      section_id,
      sort_order
    `)
    .eq(
      "form_version_id",
      formVersion.id
    )
    .eq("section_id", section.id)
    .maybeSingle();

  if (versionSectionError) {
    return (
      <ErrorState
        message={`Unable to load section version: ${versionSectionError.message}`}
      />
    );
  }

  if (!versionSection) {
    return (
      <ErrorState message="Kitchen belum tersedia pada Closing version ini." />
    );
  }

  // ==========================================================
  // QUESTION GROUPS
  // ==========================================================

  const {
    data: groupsData,
    error: groupsError,
  } = await supabase
    .from("question_groups")
    .select(`
      id,
      code,
      name,
      description,
      sort_order
    `)
    .eq(
      "version_section_id",
      versionSection.id
    )
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (groupsError) {
    return (
      <ErrorState
        message={`Unable to load question groups: ${groupsError.message}`}
      />
    );
  }

  const groups = groupsData ?? [];

  // ==========================================================
  // QUESTIONS
  // ==========================================================

  const {
    data: questionsData,
    error: questionsError,
  } = await supabase
    .from("questions")
    .select(`
      id,
      question_group_id,
      code,
      question_text,
      help_text,
      question_type,
      unit,
      min_value,
      max_value,
      sort_order,
      is_required,
      is_active,
      config
    `)
    .eq(
      "version_section_id",
      versionSection.id
    )
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (questionsError) {
    return (
      <ErrorState
        message={`Unable to load questions: ${questionsError.message}`}
      />
    );
  }

  const questions = questionsData ?? [];

  if (!questions.length) {
    return (
      <ErrorState message="Belum ada pertanyaan Closing Kitchen." />
    );
  }

  // ==========================================================
  // QUESTION RULES
  //
  // Photo remains mandatory for every question.
  // ==========================================================

  const questionIds =
    questions.map((question: any) => question.id);

  const {
    data: rulesData,
    error: rulesError,
  } = await supabase
    .from("question_rules")
    .select(`
      id,
      question_id,
      rule_type,
      condition,
      action_config
    `)
    .in("question_id", questionIds);

  if (rulesError) {
    return (
      <ErrorState
        message={`Unable to load question rules: ${rulesError.message}`}
      />
    );
  }

  const rulesByQuestion =
    new Map<string, any[]>();

  for (const rule of rulesData ?? []) {
    const current =
      rulesByQuestion.get(
        rule.question_id
      ) ?? [];

    current.push(rule);

    rulesByQuestion.set(
      rule.question_id,
      current
    );
  }

  const questionsWithRules =
    questions.map((question: any) => ({
      ...question,
      rules:
        rulesByQuestion.get(
          question.id
        ) ?? [],
    }));

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <ClosingKitchenClient
      outlet={outlet}
      groups={groups}
      questions={questionsWithRules}
    />
  );
}

// ============================================================
// ERROR STATE
// ============================================================

function ErrorState({
  message,
  showChangeOutlet = false,
}: {
  message: string;
  showChangeOutlet?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-5 py-10 text-[#222]">
      <div className="w-full max-w-[680px] rounded-[32px] border border-black/5 bg-white px-8 py-14 text-center shadow-sm md:px-12">
        <div className="text-5xl">
          ⚠️
        </div>

        <h1 className="mt-7 text-3xl font-bold tracking-tight">
          Unable to Load Closing
        </h1>

        <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-neutral-500">
          {message}
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {showChangeOutlet && (
            <Link
              href="/protected/select-outlet"
              className="rounded-2xl bg-red-700 px-7 py-4 font-semibold text-white transition hover:bg-red-800"
            >
              Change Outlet
            </Link>
          )}

          <Link
            href="/protected"
            className="rounded-2xl bg-[#222] px-7 py-4 font-semibold text-white transition hover:bg-black"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
