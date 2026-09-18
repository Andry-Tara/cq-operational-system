type CkFormRow = {
  id: string;
  code: string | null;
};

type CkAssignmentRow = {
  form_id: string;
  form_version_id: string;
};

type CkVersionSectionRow = {
  form_version_id: string;
  section_id: string;
  is_required: boolean | null;
  is_active: boolean | null;
};

type CkAreaLeaderRow = {
  form_id: string;
  area_code: string | null;
  user_id: string;
};

type CkPermissionRow = {
  form_id: string;
  section_id: string;
  can_submit: boolean | null;
};

type CkReportRow = {
  id: string;
  form_id: string;
  report_number: string | null;
  status: string | null;
  business_date: string;
  created_at: string | null;
};

type CkReportSectionRow = {
  id: string;
  report_id: string;
  section_id: string;
  status: string | null;
  submitted_by: string | null;
};

type CkIssueRow = {
  id: string;
  report_section_id: string | null;
};


export type FastCkReportActivity = {
  id: string;
  reportNumber: string;
  formCode: string;
  status: string;
};


export type FastCkDashboardData = {
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  notSubmittedCount: number;
  issueCount: number;
  productionLeaderMode: boolean;
  reports: FastCkReportActivity[];
};


function rows<T>(
  value: unknown
): T[] {
  return Array.isArray(
    value
  )
    ? value as T[]
    : [];
}


function activityStatus(
  value: unknown
): string {
  const status =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "completed",
      "submitted",
      "reviewed",
    ].includes(
      status
    )
  ) {
    return "COMPLETED";
  }

  if (
    [
      "draft",
      "in_progress",
      "reopened",
      "needs_correction",
    ].includes(
      status
    )
  ) {
    return "IN PROGRESS";
  }

  return "READY";
}


export async function loadFastCkDashboard({
  supabase,
  organizationId,
  outletId,
  userId,
  businessDate,
}: {
  supabase: any;
  organizationId: string;
  outletId: string;
  userId: string;
  businessDate: string;
}): Promise<FastCkDashboardData> {

  // ==========================================================
  // CK FORMS
  // ==========================================================

  const {
    data:
      formData,
    error:
      formError,
  } =
    await supabase
      .from("forms")
      .select(`
        id,
        code
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "code",
        [
          "OPENING_CK",
          "CLOSING_CK",
        ]
      )
      .eq(
        "is_active",
        true
      );


  if (formError) {
    throw formError;
  }


  const forms =
    rows<CkFormRow>(
      formData
    );


  if (!forms.length) {
    return {
      assignedCount: 0,
      completedCount: 0,
      inProgressCount: 0,
      notSubmittedCount: 0,
      issueCount: 0,
      productionLeaderMode: false,
      reports: [],
    };
  }


  const formIds =
    forms.map(
      form =>
        form.id
    );


  const formCodeById =
    new Map<
      string,
      string
    >(
      forms.map(
        form => [
          form.id,
          String(
            form.code ||
            ""
          ),
        ] as [
          string,
          string
        ]
      )
    );


  // ==========================================================
  // ACTIVE FORM VERSIONS
  // ==========================================================

  const {
    data:
      assignmentData,
    error:
      assignmentError,
  } =
    await supabase
      .from(
        "outlet_form_assignments"
      )
      .select(`
        form_id,
        form_version_id
      `)
      .eq(
        "outlet_id",
        outletId
      )
      .in(
        "form_id",
        formIds
      )
      .eq(
        "is_active",
        true
      );


  if (assignmentError) {
    throw assignmentError;
  }


  const assignments =
    rows<CkAssignmentRow>(
      assignmentData
    );


  const versionIds =
    assignments.map(
      item =>
        item.form_version_id
    );


  const formIdByVersion =
    new Map<
      string,
      string
    >(
      assignments.map(
        item => [
          item.form_version_id,
          item.form_id,
        ] as [
          string,
          string
        ]
      )
    );


  // ==========================================================
  // INDEPENDENT CK READS — PARALLEL
  // ==========================================================

  const versionSectionsPromise =
    versionIds.length
      ? supabase
          .from(
            "form_version_sections"
          )
          .select(`
            form_version_id,
            section_id,
            is_required,
            is_active
          `)
          .in(
            "form_version_id",
            versionIds
          )
          .eq(
            "is_active",
            true
          )
          .eq(
            "is_required",
            true
          )
      : Promise.resolve({
          data: [],
          error: null,
        });


  const leaderPromise =
    formIds.length
      ? supabase
          .from(
            "form_area_leaders"
          )
          .select(`
            form_id,
            area_code,
            user_id
          `)
          .eq(
            "outlet_id",
            outletId
          )
          .eq(
            "user_id",
            userId
          )
          .eq(
            "area_code",
            "PRODUCTION"
          )
          .in(
            "form_id",
            formIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        });


  const permissionPromise =
    formIds.length
      ? supabase
          .from(
            "user_section_permissions"
          )
          .select(`
            form_id,
            section_id,
            can_submit
          `)
          .eq(
            "user_id",
            userId
          )
          .eq(
            "outlet_id",
            outletId
          )
          .in(
            "form_id",
            formIds
          )
          .eq(
            "can_submit",
            true
          )
      : Promise.resolve({
          data: [],
          error: null,
        });


  const reportPromise =
    formIds.length
      ? supabase
          .from("reports")
          .select(`
            id,
            form_id,
            report_number,
            status,
            business_date,
            created_at
          `)
          .eq(
            "outlet_id",
            outletId
          )
          .eq(
            "business_date",
            businessDate
          )
          .in(
            "form_id",
            formIds
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
      : Promise.resolve({
          data: [],
          error: null,
        });


  const results:
    any[] =
    await Promise.all([
      versionSectionsPromise,
      leaderPromise,
      permissionPromise,
      reportPromise,
    ]);


  const versionSectionResult =
    results[0];

  const leaderResult =
    results[1];

  const permissionResult =
    results[2];

  const reportResult =
    results[3];


  if (
    versionSectionResult.error
  ) {
    throw (
      versionSectionResult.error
    );
  }

  if (
    leaderResult.error
  ) {
    throw (
      leaderResult.error
    );
  }

  if (
    permissionResult.error
  ) {
    throw (
      permissionResult.error
    );
  }

  if (
    reportResult.error
  ) {
    throw (
      reportResult.error
    );
  }


  const versionSections =
    rows<CkVersionSectionRow>(
      versionSectionResult.data
    );

  const leaderRows =
    rows<CkAreaLeaderRow>(
      leaderResult.data
    );

  const permissionRows =
    rows<CkPermissionRow>(
      permissionResult.data
    );

  const reportRows =
    rows<CkReportRow>(
      reportResult.data
    );


  // ==========================================================
  // REQUIRED ACTIVE SECTIONS
  // ==========================================================

  const activeSectionKeys =
    new Set<string>();


  for (
    const item
    of versionSections
  ) {
    const formId =
      formIdByVersion.get(
        item.form_version_id
      );

    if (!formId) {
      continue;
    }

    activeSectionKeys.add(
      `${formId}:${item.section_id}`
    );
  }


  // ==========================================================
  // CURRENT PIC ASSIGNMENT
  // ==========================================================

  const assignedByKey =
    new Map<
      string,
      CkPermissionRow
    >();


  for (
    const permission
    of permissionRows
  ) {
    const key =
      `${permission.form_id}:${permission.section_id}`;

    if (
      activeSectionKeys.has(
        key
      )
    ) {
      assignedByKey.set(
        key,
        permission
      );
    }
  }


  const assignedSections:
    CkPermissionRow[] =
    Array.from(
      assignedByKey.values()
    );


  const assignedCount =
    assignedSections.length;


  // ==========================================================
  // PRODUCTION LEADER
  //
  // Same authority source as existing dashboard.
  // ==========================================================

  const productionLeaderFormIds =
    new Set<string>(
      leaderRows.map(
        item =>
          item.form_id
      )
    );


  const productionLeaderMode =
    productionLeaderFormIds.size >
    0;


  // ==========================================================
  // TODAY REPORTS
  // ==========================================================

  const reportByFormId =
    new Map<
      string,
      CkReportRow
    >();


  // newest first — preserve first row per form
  for (
    const report
    of reportRows
  ) {
    if (
      reportByFormId.has(
        report.form_id
      )
    ) {
      continue;
    }

    reportByFormId.set(
      report.form_id,
      report
    );
  }


  const reportIds =
    Array.from(
      reportByFormId.values()
    ).map(
      report =>
        report.id
    );


  const assignedSectionIds =
    Array.from(
      new Set<string>(
        assignedSections.map(
          item =>
            item.section_id
        )
      )
    );


  // ==========================================================
  // REPORT SECTION STATUS
  // ==========================================================

  let reportSectionRows:
    CkReportSectionRow[] =
    [];


  if (
    reportIds.length &&
    assignedSectionIds.length
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
          status,
          submitted_by
        `)
        .in(
          "report_id",
          reportIds
        )
        .in(
          "section_id",
          assignedSectionIds
        );


    if (error) {
      throw error;
    }


    reportSectionRows =
      rows<CkReportSectionRow>(
        data
      );
  }


  const reportSectionByKey =
    new Map<
      string,
      CkReportSectionRow
    >(
      reportSectionRows.map(
        item => [
          `${item.report_id}:${item.section_id}`,
          item,
        ] as [
          string,
          CkReportSectionRow
        ]
      )
    );


  let completedCount =
    0;

  let inProgressCount =
    0;

  let notSubmittedCount =
    0;


  const ownedReportSectionIds:
    string[] = [];


  for (
    const assigned
    of assignedSections
  ) {
    const report =
      reportByFormId.get(
        assigned.form_id
      );


    if (!report) {
      notSubmittedCount +=
        1;

      continue;
    }


    const reportSection =
      reportSectionByKey.get(
        `${report.id}:${assigned.section_id}`
      );


    if (!reportSection) {
      notSubmittedCount +=
        1;

      continue;
    }


    const status =
      String(
        reportSection.status ||
        ""
      )
        .trim()
        .toLowerCase();


    const isProductionLeaderSection =
      productionLeaderFormIds.has(
        assigned.form_id
      );


    // Existing dashboard semantics:
    //
    // Regular PIC:
    // completed only when submitted by current PIC.
    //
    // Production Leader:
    // submitted section represents team progress.
    const isCompleted =
      [
        "submitted",
        "reviewed",
        "completed",
      ].includes(
        status
      ) &&
      (
        isProductionLeaderSection ||
        reportSection.submitted_by ===
          userId
      );


    const isInProgress =
      [
        "draft",
        "in_progress",
        "reopened",
      ].includes(
        status
      );


    if (
      isCompleted
    ) {
      completedCount +=
        1;
    } else if (
      isInProgress
    ) {
      inProgressCount +=
        1;
    } else {
      notSubmittedCount +=
        1;
    }


    ownedReportSectionIds.push(
      reportSection.id
    );
  }


  // ==========================================================
  // SECTION ISSUES
  // ==========================================================

  let issueCount =
    0;


  if (
    ownedReportSectionIds.length
  ) {
    const {
      data:
        issueData,
      error:
        issueError,
    } =
      await supabase
        .from("issues")
        .select(`
          id,
          report_section_id
        `)
        .in(
          "report_section_id",
          ownedReportSectionIds
        );


    if (issueError) {
      throw issueError;
    }


    const issues =
      rows<CkIssueRow>(
        issueData
      );


    issueCount =
      issues.length;
  }


  // ==========================================================
  // LIGHTWEIGHT RECENT ACTIVITY
  // ==========================================================

  const activityReports:
    FastCkReportActivity[] =
    Array.from(
      reportByFormId.values()
    )
      .slice(
        0,
        4
      )
      .map(
        report => ({
          id:
            report.id,

          reportNumber:
            String(
              report.report_number ||
              "Central Kitchen Report"
            ),

          formCode:
            String(
              formCodeById.get(
                report.form_id
              ) ||
              "CK"
            ),

          status:
            activityStatus(
              report.status
            ),
        })
      );


  return {
    assignedCount,
    completedCount,
    inProgressCount,
    notSubmittedCount,
    issueCount,
    productionLeaderMode,
    reports:
      activityReports,
  };
}
