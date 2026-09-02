import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportsHistoryClient from "./reports-history-client";

function jakartaBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year =
    parts.find((item) => item.type === "year")?.value ?? "";

  const month =
    parts.find((item) => item.type === "month")?.value ?? "";

  const day =
    parts.find((item) => item.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function relationOne(value: any) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function ReportsPage() {
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
  // ROLE
  // ==========================================================

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select(`
      roles (
        id,
        code,
        name,
        is_admin
      )
    `)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const role =
    relationOne(roleRow?.roles);

  // ==========================================================
  // ALL OUTLET ACCESS?
  // ==========================================================

  const { data: hasAllAccess } =
    await supabase.rpc(
      "has_all_outlet_access"
    );

  // ==========================================================
  // REOPEN PERMISSION
  // ==========================================================

  const {
    data: canReopenReport,
    error: reopenPermissionError,
  } =
    await supabase.rpc(
      "has_permission",
      {
        p_permission_code:
          "reports.reopen",
      }
    );

  if (reopenPermissionError) {
    console.error(
      "Unable to check reports.reopen permission:",
      reopenPermissionError
    );
  }


  // ==========================================================
  // ACCESSIBLE OUTLETS
  // ==========================================================

  let outlets: any[] = [];

  if (hasAllAccess === true) {
    const { data, error } = await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        timezone,
        is_active
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq("is_active", true)
      .order("name");

    if (error) {
      return (
        <ErrorState message={error.message} />
      );
    }

    outlets = data ?? [];
  } else {
    const { data, error } = await supabase
      .from("user_outlets")
      .select(`
        outlet_id,
        outlets (
          id,
          code,
          name,
          timezone,
          is_active
        )
      `)
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) {
      return (
        <ErrorState message={error.message} />
      );
    }

    outlets =
      (data ?? [])
        .map((row: any) =>
          relationOne(row.outlets)
        )
        .filter(
          (outlet: any) =>
            outlet &&
            outlet.is_active === true
        );
  }

  if (!outlets.length) {
    return (
      <ErrorState message="User belum memiliki akses outlet." />
    );
  }

  // ==========================================================
  // CLOSING FORM
  // ==========================================================

  const { data: closingForm } = await supabase
    .from("forms")
    .select(`
      id,
      code,
      name
    `)
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq("code", "CLOSING")
    .eq("is_active", true)
    .maybeSingle();

  if (!closingForm) {
    return (
      <ErrorState message="Form Closing tidak ditemukan." />
    );
  }

  // ==========================================================
  // LOAD REPORT HISTORY
  //
  // 90 days is enough for initial dashboard.
  // Later we can add server pagination.
  // ==========================================================

  const outletIds =
    outlets.map(
      (outlet: any) => outlet.id
    );

  const { data: reportsData, error: reportsError } =
    await supabase
      .from("reports")
      .select(`
        id,
        outlet_id,
        form_id,
        report_number,
        business_date,
        status,
        created_at,
        completed_at,
        pdf_storage_path
      `)
      .eq("form_id", closingForm.id)
      .in("outlet_id", outletIds)
      .order("business_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(1000);

  if (reportsError) {
    return (
      <ErrorState
        message={reportsError.message}
      />
    );
  }

  const reports =
    reportsData ?? [];

  const reportIds =
    reports.map(
      (report: any) => report.id
    );

  // ==========================================================
  // REPORT SECTIONS
  // ==========================================================

  let reportSections: any[] = [];

  if (reportIds.length) {
    const { data } = await supabase
      .from("report_sections")
      .select(`
        id,
        report_id,
        status
      `)
      .in("report_id", reportIds);

    reportSections = data ?? [];
  }

  const sectionIds =
    reportSections.map(
      (section: any) => section.id
    );

  // ==========================================================
  // PHOTOS
  // ==========================================================

  let photos: any[] = [];

  if (sectionIds.length) {
    const { data } = await supabase
      .from("report_photos")
      .select(`
        id,
        report_section_id
      `)
      .in(
        "report_section_id",
        sectionIds
      );

    photos = data ?? [];
  }

  // ==========================================================
  // ISSUES
  // ==========================================================

  let issues: any[] = [];

  if (reportIds.length) {
    const { data } = await supabase
      .from("issues")
      .select(`
        id,
        report_id,
        status
      `)
      .in("report_id", reportIds);

    issues = data ?? [];
  }

  // ==========================================================
  // MAP COUNTS
  // ==========================================================

  const sectionsByReport =
    new Map<string, string[]>();

  for (const section of reportSections) {
    const current =
      sectionsByReport.get(
        section.report_id
      ) ?? [];

    current.push(section.id);

    sectionsByReport.set(
      section.report_id,
      current
    );
  }

  const photosBySection =
    new Map<string, number>();

  for (const photo of photos) {
    photosBySection.set(
      photo.report_section_id,
      (
        photosBySection.get(
          photo.report_section_id
        ) ?? 0
      ) + 1
    );
  }

  const issuesByReport =
    new Map<string, number>();

  for (const issue of issues) {
    issuesByReport.set(
      issue.report_id,
      (
        issuesByReport.get(
          issue.report_id
        ) ?? 0
      ) + 1
    );
  }

  // ==========================================================
  // FINAL REPORT OBJECT
  // ==========================================================

  const hydratedReports =
    reports.map((report: any) => {
      const sectionList =
        sectionsByReport.get(
          report.id
        ) ?? [];

      const photoCount =
        sectionList.reduce(
          (total, sectionId) =>
            total +
            (
              photosBySection.get(
                sectionId
              ) ?? 0
            ),
          0
        );

      return {
        ...report,
        photo_count:
          photoCount,
        issue_count:
          issuesByReport.get(
            report.id
          ) ?? 0,
      };
    });

  const today =
    jakartaBusinessDate();

  return (
    <ReportsHistoryClient
      outlets={outlets}
      reports={hydratedReports}
      today={today}
      user={{
        full_name:
          profile.full_name ||
          user.email ||
          "CQ User",
        role:
          role?.name ||
          profile.job_title ||
          "Operational User",
        allOutletAccess:
          hasAllAccess === true,
        isAdmin:
          canReopenReport === true,
      }}
    />
  );
}

// ============================================================
// ERROR
// ============================================================

function ErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-5">
      <div className="w-full max-w-xl rounded-[28px] border border-black/5 bg-white p-10 text-center shadow-sm">

        <div className="text-4xl">
          ⚠️
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          Unable to Load Reports
        </h1>

        <p className="mt-3 text-neutral-500">
          {message}
        </p>

        <a
          href="/protected"
          className="mt-7 inline-flex rounded-2xl bg-[#222] px-6 py-3 font-semibold text-white"
        >
          Back to Dashboard
        </a>
      </div>
    </main>
  );
}
