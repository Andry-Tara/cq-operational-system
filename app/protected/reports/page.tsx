import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  isOperationalPhotoRequired,
} from "@/lib/operations/evidence";

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


function reportAnswerScalarValue(
  answerValue: any
) {
  if (
    answerValue &&
    typeof answerValue === "object" &&
    !Array.isArray(
      answerValue
    ) &&
    "value" in answerValue
  ) {
    return answerValue.value;
  }

  return answerValue;
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

  // ==========================================================
  // REPORT CENTER ACCESS SCOPE
  //
  // Priority:
  //
  // 1. Administrator
  //    -> full report visibility.
  //
  // 2. Area Leader
  //    -> only sections owned by that area.
  //
  //    STORE      = Warehouse
  //    PRODUCTION = Production
  //
  // 3. Section PIC / reviewer
  //    -> only explicitly assigned sections.
  //
  // 4. Existing outlet-level management access
  //    -> full report visibility inside accessible outlets.
  //
  // IMPORTANT:
  // If a user already has CK scoped access at an outlet,
  // another CK form without an explicit assignment FAILS CLOSED.
  //
  // This prevents:
  //
  // Wahyu -> seeing Warehouse
  // Muzza -> seeing Production
  // PIC   -> seeing another PIC section
  // ==========================================================

  const isAdministrator =
    role?.is_admin ===
    true;

  const ckFormIds =
    new Set(
      forms
        .filter(
          (
            form: any
          ) =>
            [
              "OPENING_CK",
              "CLOSING_CK",
            ].includes(
              String(
                form.code ||
                ""
              )
                .trim()
                .toUpperCase()
            )
        )
        .map(
          (
            form: any
          ) =>
            form.id
        )
    );


  let areaLeaderRows:
    any[] = [];

  let sectionPermissionRows:
    any[] = [];


  if (
    !isAdministrator &&
    outletIds.length &&
    formIds.length
  ) {
    const [
      leaderResult,
      permissionResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "form_area_leaders"
          )
          .select(`
            outlet_id,
            form_id,
            area_code,
            user_id
          `)
          .eq(
            "user_id",
            user.id
          )
          .in(
            "outlet_id",
            outletIds
          )
          .in(
            "form_id",
            formIds
          ),

        supabase
          .from(
            "user_section_permissions"
          )
          .select(`
            outlet_id,
            form_id,
            section_id,
            can_view,
            can_submit,
            can_review
          `)
          .eq(
            "user_id",
            user.id
          )
          .in(
            "outlet_id",
            outletIds
          )
          .in(
            "form_id",
            formIds
          ),
      ]);


    if (
      leaderResult.error
    ) {
      return (
        <ErrorState
          message={
            leaderResult
              .error
              .message
          }
        />
      );
    }


    if (
      permissionResult.error
    ) {
      return (
        <ErrorState
          message={
            permissionResult
              .error
              .message
          }
        />
      );
    }


    areaLeaderRows =
      leaderResult.data ??
      [];

    sectionPermissionRows =
      (
        permissionResult.data ??
        []
      ).filter(
        (
          row: any
        ) =>
          row.can_view ===
            true ||
          row.can_submit ===
            true ||
          row.can_review ===
            true
      );
  }


  function accessKey(
    outletId: string,
    formId: string
  ) {
    return (
      `${outletId}:${formId}`
    );
  }


  const leaderAreasByKey =
    new Map<
      string,
      Set<string>
    >();


  for (
    const row of
    areaLeaderRows
  ) {
    const key =
      accessKey(
        row.outlet_id,
        row.form_id
      );

    const areas =
      leaderAreasByKey.get(
        key
      ) ??
      new Set<string>();

    const area =
      String(
        row.area_code ||
        ""
      )
        .trim()
        .toUpperCase();

    if (area) {
      areas.add(
        area
      );
    }

    leaderAreasByKey.set(
      key,
      areas
    );
  }


  const permissionSectionsByKey =
    new Map<
      string,
      Set<string>
    >();


  for (
    const row of
    sectionPermissionRows
  ) {
    const key =
      accessKey(
        row.outlet_id,
        row.form_id
      );

    const sectionIds =
      permissionSectionsByKey.get(
        key
      ) ??
      new Set<string>();

    if (
      row.section_id
    ) {
      sectionIds.add(
        row.section_id
      );
    }

    permissionSectionsByKey.set(
      key,
      sectionIds
    );
  }


  // A CK scoped user must not fall back to full CK visibility
  // merely because they also have outlet access.
  const scopedCkOutletIds =
    new Set<string>();


  for (
    const row of
    areaLeaderRows
  ) {
    if (
      ckFormIds.has(
        row.form_id
      )
    ) {
      scopedCkOutletIds.add(
        row.outlet_id
      );
    }
  }


  for (
    const row of
    sectionPermissionRows
  ) {
    if (
      ckFormIds.has(
        row.form_id
      )
    ) {
      scopedCkOutletIds.add(
        row.outlet_id
      );
    }
  }


  function getReportScope(
    outletId: string,
    formId: string
  ) {
    if (
      isAdministrator
    ) {
      return {
        kind:
          "FULL" as const,
      };
    }


    const key =
      accessKey(
        outletId,
        formId
      );


    const leaderAreas =
      leaderAreasByKey.get(
        key
      );

    if (
      leaderAreas &&
      leaderAreas.size
    ) {
      return {
        kind:
          "AREA" as const,

        areas:
          leaderAreas,
      };
    }


    const sectionIds =
      permissionSectionsByKey.get(
        key
      );

    if (
      sectionIds &&
      sectionIds.size
    ) {
      return {
        kind:
          "SECTION" as const,

        sectionIds,
      };
    }


    if (
      ckFormIds.has(
        formId
      ) &&
      scopedCkOutletIds.has(
        outletId
      )
    ) {
      return {
        kind:
          "NONE" as const,
      };
    }


    return {
      kind:
        "FULL" as const,
    };
  }


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

  const visibleAssignments =
    assignments.filter(
      (
        assignment: any
      ) =>
        getReportScope(
          assignment.outlet_id,
          assignment.form_id
        ).kind !==
        "NONE"
    );


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
          name,
            area_code
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

  const reportByIdForScope =
    new Map(
      reports.map(
        (
          report: any
        ) => [
          report.id,
          report,
        ]
      )
    );


  const sectionByIdForScope =
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


  reportSections =
    reportSections.filter(
      (
        reportSection: any
      ) => {
        const report =
          reportByIdForScope.get(
            reportSection.report_id
          );

        if (!report) {
          return false;
        }


        const scope =
          getReportScope(
            report.outlet_id,
            report.form_id
          );


        if (
          scope.kind ===
          "FULL"
        ) {
          return true;
        }


        if (
          scope.kind ===
          "NONE"
        ) {
          return false;
        }


        if (
          scope.kind ===
          "SECTION"
        ) {
          return scope
            .sectionIds
            .has(
              reportSection.section_id
            );
        }


        const definition =
          sectionByIdForScope.get(
            reportSection.section_id
          );

        const areaCode =
          String(
            definition
              ?.area_code ||
            ""
          )
            .trim()
            .toUpperCase();


        return (
          Boolean(
            areaCode
          ) &&
          scope
            .areas
            .has(
              areaCode
            )
        );
      }
    );


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
          version_section_id,
          question_type,
          min_value,
          max_value,
          config
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
          report_section_id,
          question_id,
          answer_value
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
          report_section_id,
          answer_id
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
    reportSectionIds.length
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
            report_section_id,
          status
        `)
        .in(
          "report_section_id",
          reportSectionIds
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
  // AREA FINALIZATIONS
  //
  // AREA scoped CK reports are considered complete only after
  // the corresponding area leader explicitly finalizes them.
  //
  // STORE      = Warehouse
  // PRODUCTION = Production
  // ==========================================================

  let areaFinalizationRows:
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
          "report_area_finalizations"
        )
        .select(`
          id,
          report_id,
          area_code,
          finalized_at,
          pdf_storage_path,
          pdf_generated_at
        `)
        .in(
          "report_id",
          reportIds
        );


    if (error) {
      console.error(
        "Unable to load report area finalizations:",
        error
      );
    } else {
      areaFinalizationRows =
        data ?? [];
    }
  }


  const areaFinalizationByKey =
    new Map<
      string,
      any
    >();


  for (
    const finalization of
    areaFinalizationRows
  ) {
    const areaCode =
      String(
        finalization.area_code ||
        ""
      )
        .trim()
        .toUpperCase();


    if (!areaCode) {
      continue;
    }


    areaFinalizationByKey.set(
      `${finalization.report_id}:${areaCode}`,
      finalization
    );
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


  const questionsByVersionSection =
    new Map<
      string,
      any[]
    >();

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

    const currentQuestions =
      questionsByVersionSection.get(
        key
      ) ?? [];

    currentQuestions.push(
      question
    );

    questionsByVersionSection.set(
      key,
      currentQuestions
    );

    questionCountByVersionSection.set(
      key,
      (
        questionCountByVersionSection.get(
          key
        ) ?? 0
      ) + 1
    );
  }


  const answerBySectionQuestion =
    new Map<
      string,
      any
    >();

  const answerCountBySection =
    new Map<
      string,
      number
    >();

  for (
    const answer of
    answerRows
  ) {
    answerBySectionQuestion.set(
      `${answer.report_section_id}:${answer.question_id}`,
      answer
    );

    answerCountBySection.set(
      answer.report_section_id,
      (
        answerCountBySection.get(
          answer.report_section_id
        ) ?? 0
      ) + 1
    );
  }


  const photoAnswerIds =
    new Set<
      string
    >();

  const photoCountBySection =
    new Map<
      string,
      number
    >();

  for (
    const photo of
    photoRows
  ) {
    if (
      photo.answer_id
    ) {
      photoAnswerIds.add(
        photo.answer_id
      );
    }

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

    const sectionQuestions =
      questionsByVersionSection.get(
        reportSection.version_section_id
      ) ?? [];

    let requiredPhotoCount =
      0;

    let requiredPhotoCompleteCount =
      0;

    for (
      const question of
      sectionQuestions
    ) {
      const answer =
        answerBySectionQuestion.get(
          `${reportSection.id}:${question.id}`
        );

      const photoRequired =
        isOperationalPhotoRequired(
          question,
          answer
            ? {
                value:
                  reportAnswerScalarValue(
                    answer.answer_value
                  ),
              }
            : null
        );

      if (
        !photoRequired
      ) {
        continue;
      }

      requiredPhotoCount +=
        1;

      if (
        answer?.id &&
        photoAnswerIds.has(
          answer.id
        )
      ) {
        requiredPhotoCompleteCount +=
          1;
      }
    }

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

      required_photo_count:
        requiredPhotoCount,

      required_photo_complete_count:
        requiredPhotoCompleteCount,
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
    reports
      .filter(
        (
          report: any
        ) =>
          getReportScope(
            report.outlet_id,
            report.form_id
          ).kind !==
          "NONE"
      )
      .map(
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

        const requiredPhotoCount =
          sections.reduce(
            (
              total,
              section
            ) =>
              total +
              (
                section.required_photo_count ??
                0
              ),
            0
          );

        const requiredPhotoCompleteCount =
          sections.reduce(
            (
              total,
              section
            ) =>
              total +
              (
                section.required_photo_complete_count ??
                0
              ),
            0
          );


        // ------------------------------------------------------
        // REPORT CENTER SCOPED STATUS
        //
        // Parent CK report status cannot represent Warehouse
        // and Production independently.
        // ------------------------------------------------------

        const reportScope =
          getReportScope(
            report.outlet_id,
            report.form_id
          );


        const completedSectionStatuses =
          new Set([
            "completed",
            "submitted",
            "reviewed",
          ]);


        const hasVisibleSections =
          sections.length >
          0;


        const visibleSectionsCompleted =
          hasVisibleSections &&
          sections.every(
            (
              section: any
            ) =>
              completedSectionStatuses.has(
                String(
                  section.status ||
                  ""
                )
                  .trim()
                  .toLowerCase()
              )
          );


        let scopedStatus =
          report.status;


        let scopedCompletedAt:
          string | null =
          report.completed_at ??
          null;


        // ------------------------------------------------------
        // AREA LEADER
        //
        // Finalization is the source of truth.
        //
        // Muzza:
        // STORE only.
        //
        // Wahyu:
        // PRODUCTION only.
        // ------------------------------------------------------

        if (
          reportScope.kind ===
          "AREA"
        ) {
          const areaCodes =
            Array.from(
              reportScope.areas
            );


          const scopedFinalizations =
            areaCodes
              .map(
                (
                  areaCode
                ) =>
                  areaFinalizationByKey.get(
                    `${report.id}:${areaCode}`
                  )
              )
              .filter(
                Boolean
              );


          const allAreasFinalized =
            areaCodes.length >
              0 &&
            scopedFinalizations.length ===
              areaCodes.length &&
            scopedFinalizations.every(
              (
                finalization: any
              ) =>
                Boolean(
                  finalization
                    ?.finalized_at
                )
            );


          if (
            allAreasFinalized
          ) {
            const finalizedDates =
              scopedFinalizations
                .map(
                  (
                    finalization:
                      any
                  ) =>
                    String(
                      finalization
                        .finalized_at
                    )
                )
                .filter(
                  Boolean
                )
                .sort();


            scopedCompletedAt =
              finalizedDates.length
                ? finalizedDates[
                    finalizedDates.length -
                    1
                  ]
                : null;


            scopedStatus =
              "completed";

          } else {
            scopedCompletedAt =
              null;

            scopedStatus =
              hasVisibleSections
                ? "in_progress"
                : "not_submitted";
          }
        }


        // ------------------------------------------------------
        // SECTION PIC
        //
        // PIC responsibility ends after submit / review.
        // Area finalization belongs to the Area Leader.
        // ------------------------------------------------------

        if (
          reportScope.kind ===
          "SECTION"
        ) {
          scopedCompletedAt =
            null;

          scopedStatus =
            visibleSectionsCompleted
              ? "completed"
              : hasVisibleSections
                ? "in_progress"
                : "not_submitted";
        }


        const isScopedReport =
          reportScope.kind !==
          "FULL";


        return {
          ...report,

          status:
            scopedStatus,

          completed_at:
            isScopedReport
              ? scopedCompletedAt
              : report.completed_at,

          // Generic parent PDF can contain multiple CK areas.
          // Scoped users must use their area/PIC PDF flow.
          pdf_storage_path:
            isScopedReport
              ? null
              : report.pdf_storage_path,


          form_code:
            form?.code ??
            "FORM",

          form_name:
            form?.name ??
            form?.code ??
            "Operational Form",

          created_by_email:
            isScopedReport
              ? null
              : (
                  report.created_by_email ??
                  null
                ),

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
                  "reviewed",
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

          required_photo_count:
            requiredPhotoCount,

          required_photo_complete_count:
            requiredPhotoCompleteCount,

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
        visibleAssignments
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
