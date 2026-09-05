import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import ReportsHistoryClient from "./reports-history-client";


function jakartaBusinessDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (item) =>
        item.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (item) =>
        item.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (item) =>
        item.type === "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}


function relationOne(
  value: any
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}


function uniqueIds(
  values: Array<
    string | null | undefined
  >
) {
  return [
    ...new Set(
      values.filter(
        Boolean
      ) as string[]
    ),
  ];
}


export default async function ReportsPage() {
  const supabase =
    await createClient();

  // ==========================================================
  // AUTH
  // ==========================================================

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/auth/login"
    );
  }


  // ==========================================================
  // PROFILE
  // ==========================================================

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        job_title,
        organization_id
      `)
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (!profile) {
    return (
      <ErrorState
        message="Profile user tidak ditemukan."
      />
    );
  }


  // ==========================================================
  // ROLE
  // ==========================================================

  const {
    data: roleRow,
  } =
    await supabase
      .from("user_roles")
      .select(`
        roles (
          id,
          code,
          name,
          is_admin
        )
      `)
      .eq(
        "user_id",
        user.id
      )
      .limit(1)
      .maybeSingle();

  const role =
    relationOne(
      roleRow?.roles
    );


  // ==========================================================
  // ACCESS
  // ==========================================================

  const {
    data: hasAllAccess,
  } =
    await supabase.rpc(
      "has_all_outlet_access"
    );

  const {
    data: canReopenReport,
    error:
      reopenPermissionError,
  } =
    await supabase.rpc(
      "has_permission",
      {
        p_permission_code:
          "reports.reopen",
      }
    );

  if (
    reopenPermissionError
  ) {
    console.error(
      "Unable to check reports.reopen permission:",
      reopenPermissionError
    );
  }


  // ==========================================================
  // OUTLETS
  // ==========================================================

  let outlets: any[] =
    [];

  if (
    hasAllAccess === true
  ) {
    const {
      data,
      error,
    } =
      await supabase
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
        .eq(
          "is_active",
          true
        )
        .order("name");

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    outlets =
      data ?? [];
  } else {
    const {
      data,
      error,
    } =
      await supabase
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
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    outlets =
      (data ?? [])
        .map(
          (row: any) =>
            relationOne(
              row.outlets
            )
        )
        .filter(
          (
            outlet: any
          ) =>
            outlet &&
            outlet.is_active ===
              true
        );
  }

  if (
    !outlets.length
  ) {
    return (
      <ErrorState
        message="User belum memiliki akses outlet."
      />
    );
  }


  // ==========================================================
  // FORMS
  //
  // Generic:
  // OPENING
  // CLOSING
  // future CLOSING_CK
  // future AUDIT / MYSTERY GUEST
  // ==========================================================

  const {
    data: formsData,
    error: formsError,
  } =
    await supabase
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
      .eq(
        "is_active",
        true
      )
      .order("name");

  if (formsError) {
    return (
      <ErrorState
        message={
          formsError.message
        }
      />
    );
  }

  const forms =
    formsData ?? [];

  if (
    !forms.length
  ) {
    return (
      <ErrorState
        message="Tidak ada operational form aktif."
      />
    );
  }


  const outletIds =
    outlets.map(
      (
        outlet: any
      ) =>
        outlet.id
    );

  const formIds =
    forms.map(
      (
        form: any
      ) =>
        form.id
    );


  // ==========================================================
  // ACTIVE FORM ASSIGNMENTS
  //
  // Determines which Outlet + Form combinations are expected.
  //
  // Important for CK:
  // CLOSING_CK will only appear for the outlet(s) assigned to it.
  // ==========================================================

  let assignments:
    any[] = [];

  const {
    data:
      assignmentRows,
    error:
      assignmentError,
  } =
    await supabase
      .from(
        "outlet_form_assignments"
      )
      .select(`
        id,
        outlet_id,
        form_id,
        form_version_id,
        effective_from
      `)
      .in(
        "outlet_id",
        outletIds
      )
      .in(
        "form_id",
        formIds
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "effective_from",
        {
          ascending: false,
        }
      );

  if (
    assignmentError
  ) {
    return (
      <ErrorState
        message={
          assignmentError.message
        }
      />
    );
  }

  // One current assignment per outlet + form.
  const assignmentMap =
    new Map<
      string,
      any
    >();

  for (
    const assignment of
    assignmentRows ?? []
  ) {
    const key =
      `${assignment.outlet_id}:${assignment.form_id}`;

    if (
      !assignmentMap.has(
        key
      )
    ) {
      assignmentMap.set(
        key,
        assignment
      );
    }
  }

  assignments =
    Array.from(
      assignmentMap.values()
    );


  // ==========================================================
  // REPORT HISTORY
  // ==========================================================

  const {
    data: reportsData,
    error: reportsError,
  } =
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
        pdf_storage_path,
        created_by_email
      `)
      .in(
        "outlet_id",
        outletIds
      )
      .in(
        "form_id",
        formIds
      )
      .order(
        "business_date",
        {
          ascending: false,
        }
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1500);

  if (
    reportsError
  ) {
    return (
      <ErrorState
        message={
          reportsError.message
        }
      />
    );
  }

  const reports =
    reportsData ?? [];

  const reportIds =
    reports.map(
      (
        report: any
      ) =>
        report.id
    );


  // ==========================================================
  // REPORT SECTIONS
  // ==========================================================

  let reportSections:
    any[] = [];

  if (
    reportIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "report_sections"
        )
        .select(`
          id,
          report_id,
          section_id,
          version_section_id,
          status,
          created_by_email
        `)
        .in(
          "report_id",
          reportIds
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    reportSections =
      data ?? [];
  }


  // ==========================================================
  // SECTION DEFINITIONS
  // ==========================================================

  const sectionDefinitionIds =
    uniqueIds(
      reportSections.map(
        (
          section: any
        ) =>
          section.section_id
      )
    );

  let sectionDefinitions:
    any[] = [];

  if (
    sectionDefinitionIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("sections")
        .select(`
          id,
          form_id,
          code,
          name
        `)
        .in(
          "id",
          sectionDefinitionIds
        );

    if (error) {
      return (
        <ErrorState
          message={
            error.message
          }
        />
      );
    }

    sectionDefinitions =
      data ?? [];
  }


  // ==========================================================
  // EXPECTED QUESTIONS BY VERSION SECTION
  // ==========================================================

  const versionSectionIds =
    uniqueIds(
      reportSections.map(
        (
          section: any
        ) =>
          section.version_section_id
      )
    );

  let questionRows:
    any[] = [];

  if (
    versionSectionIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("questions")
        .select(`
          id,
          version_section_id
        `)
        .in(
          "version_section_id",
          versionSectionIds
        )
        .eq(
          "is_active",
          true
        );

    if (error) {
      console.error(
        "Unable to load report question counts:",
        error
      );
    } else {
      questionRows =
        data ?? [];
    }
  }


  // ==========================================================
  // ANSWERS
  // ==========================================================

  const reportSectionIds =
    reportSections.map(
      (
        section: any
      ) =>
        section.id
    );

  let answerRows:
    any[] = [];

  if (
    reportSectionIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "report_answers"
        )
        .select(`
          id,
          report_section_id
        `)
        .in(
          "report_section_id",
          reportSectionIds
        );

    if (error) {
      console.error(
        "Unable to load report answer counts:",
        error
      );
    } else {
      answerRows =
        data ?? [];
    }
  }


  // ==========================================================
  // PHOTOS
  // ==========================================================

  let photoRows:
    any[] = [];

  if (
    reportSectionIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "report_photos"
        )
        .select(`
          id,
          report_section_id
        `)
        .in(
          "report_section_id",
          reportSectionIds
        );

    if (error) {
      console.error(
        "Unable to load report photo counts:",
        error
      );
    } else {
      photoRows =
        data ?? [];
    }
  }


  // ==========================================================
  // ISSUES
  // ==========================================================

  let issueRows:
    any[] = [];

  if (
    reportIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("issues")
        .select(`
          id,
          report_id,
          status
        `)
        .in(
          "report_id",
          reportIds
        );

    if (error) {
      console.error(
        "Unable to load report issue counts:",
        error
      );
    } else {
      issueRows =
        data ?? [];
    }
  }


  // ==========================================================
  // LOOKUP MAPS
  // ==========================================================

  const formMap =
    new Map(
      forms.map(
        (
          form: any
        ) => [
          form.id,
          form,
        ]
      )
    );

  const sectionDefinitionMap =
    new Map(
      sectionDefinitions.map(
        (
          section: any
        ) => [
          section.id,
          section,
        ]
      )
    );


  const questionCountByVersionSection =
    new Map<
      string,
      number
    >();

  for (
    const question of
    questionRows
  ) {
    const key =
      question.version_section_id;

    questionCountByVersionSection.set(
      key,
      (
        questionCountByVersionSection.get(
          key
        ) ?? 0
      ) + 1
    );
  }


  const answerCountBySection =
    new Map<
      string,
      number
    >();

  for (
    const answer of
    answerRows
  ) {
    answerCountBySection.set(
      answer.report_section_id,
      (
        answerCountBySection.get(
          answer.report_section_id
        ) ?? 0
      ) + 1
    );
  }


  const photoCountBySection =
    new Map<
      string,
      number
    >();

  for (
    const photo of
    photoRows
  ) {
    photoCountBySection.set(
      photo.report_section_id,
      (
        photoCountBySection.get(
          photo.report_section_id
        ) ?? 0
      ) + 1
    );
  }


  const issueCountByReport =
    new Map<
      string,
      number
    >();

  const openIssueCountByReport =
    new Map<
      string,
      number
    >();

  for (
    const issue of
    issueRows
  ) {
    const reportId =
      issue.report_id;

    issueCountByReport.set(
      reportId,
      (
        issueCountByReport.get(
          reportId
        ) ?? 0
      ) + 1
    );

    const issueStatus =
      String(
        issue.status || ""
      ).toLowerCase();

    const closed =
      [
        "closed",
        "resolved",
        "completed",
      ].includes(
        issueStatus
      );

    if (!closed) {
      openIssueCountByReport.set(
        reportId,
        (
          openIssueCountByReport.get(
            reportId
          ) ?? 0
        ) + 1
      );
    }
  }


  // ==========================================================
  // HYDRATE SECTIONS
  // ==========================================================

  const sectionsByReport =
    new Map<
      string,
      any[]
    >();

  for (
    const reportSection of
    reportSections
  ) {
    const definition =
      sectionDefinitionMap.get(
        reportSection.section_id
      );

    const hydratedSection = {
      id:
        reportSection.id,

      section_id:
        reportSection.section_id,

      code:
        definition?.code ??
        "SECTION",

      name:
        definition?.name ??
        definition?.code ??
        "Operational Section",

      status:
        reportSection.status,

      created_by_email:
        reportSection.created_by_email ??
        null,

      question_count:
        questionCountByVersionSection.get(
          reportSection.version_section_id
        ) ?? 0,

      answer_count:
        answerCountBySection.get(
          reportSection.id
        ) ?? 0,

      photo_count:
        photoCountBySection.get(
          reportSection.id
        ) ?? 0,
    };

    const current =
      sectionsByReport.get(
        reportSection.report_id
      ) ?? [];

    current.push(
      hydratedSection
    );

    sectionsByReport.set(
      reportSection.report_id,
      current
    );
  }


  // ==========================================================
  // HYDRATE REPORTS
  // ==========================================================

  const hydratedReports =
    reports.map(
      (
        report: any
      ) => {
        const form =
          formMap.get(
            report.form_id
          );

        const sections =
          sectionsByReport.get(
            report.id
          ) ?? [];

        const answerCount =
          sections.reduce(
            (
              total,
              section
            ) =>
              total +
              (
                section.answer_count ??
                0
              ),
            0
          );

        const questionCount =
          sections.reduce(
            (
              total,
              section
            ) =>
              total +
              (
                section.question_count ??
                0
              ),
            0
          );

        const photoCount =
          sections.reduce(
            (
              total,
              section
            ) =>
              total +
              (
                section.photo_count ??
                0
              ),
            0
          );

        return {
          ...report,

          form_code:
            form?.code ??
            "FORM",

          form_name:
            form?.name ??
            form?.code ??
            "Operational Form",

          created_by_email:
            report.created_by_email ??
            null,

          sections,

          section_count:
            sections.length,

          completed_section_count:
            sections.filter(
              (
                section
              ) =>
                [
                  "completed",
                  "submitted",
                ].includes(
                  String(
                    section.status ||
                    ""
                  ).toLowerCase()
                )
            ).length,

          answer_count:
            answerCount,

          question_count:
            questionCount,

          photo_count:
            photoCount,

          issue_count:
            issueCountByReport.get(
              report.id
            ) ?? 0,

          open_issue_count:
            openIssueCountByReport.get(
              report.id
            ) ?? 0,
        };
      }
    );


  const today =
    jakartaBusinessDate();


  return (
    <ReportsHistoryClient
      outlets={
        outlets
      }
      forms={
        forms
      }
      assignments={
        assignments
      }
      reports={
        hydratedReports
      }
      today={
        today
      }
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
          hasAllAccess ===
          true,

        canReopen:
          canReopenReport ===
          true,
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
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
          Reports
        </p>

        <h1 className="mt-2 text-xl font-black text-neutral-900">
          Unable to load reports
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          {message}
        </p>
      </div>
    </main>
  );
}
