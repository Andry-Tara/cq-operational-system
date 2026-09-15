export type SplitOutletOperationCard = {
  formId: string;
  formCode:
    | "OPENING_FOH"
    | "OPENING_BOH"
    | "CLOSING_FOH"
    | "CLOSING_BOH";
  title: string;
  area: string;
  description: string;
  href: string;
  status:
    | "NOT STARTED"
    | "IN PROGRESS"
    | "COMPLETED";
  reportNumber: string | null;
  reportId: string | null;
  hasPdf: boolean;
  canFill: boolean;
  canSubmit: boolean;
};

const DEFINITIONS = [
  {
    formCode: "OPENING_FOH",
    sectionCode: "FOH",
    title: "Opening FOH",
    area: "Front of House",
    description:
      "Guest area and FOH opening readiness checklist.",
  },
  {
    formCode: "OPENING_BOH",
    sectionCode: "BOH",
    title: "Opening BOH",
    area: "BOH / Kitchen",
    description:
      "Kitchen and BOH opening readiness checklist.",
  },
  {
    formCode: "CLOSING_FOH",
    sectionCode: "FOH",
    title: "Closing FOH",
    area: "Front of House",
    description:
      "Guest area and FOH closing checklist.",
  },
  {
    formCode: "CLOSING_BOH",
    sectionCode: "BOH",
    title: "Closing BOH",
    area: "BOH / Kitchen",
    description:
      "Kitchen and BOH closing checklist.",
  },
] as const;

function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function normalizedStatus(
  rawStatus: unknown
): SplitOutletOperationCard["status"] {
  const status =
    String(rawStatus || "")
      .trim()
      .toLowerCase();

  if (
    [
      "completed",
      "submitted",
      "reviewed",
    ].includes(status)
  ) {
    return "COMPLETED";
  }

  if (
    [
      "draft",
      "in_progress",
      "reopened",
      "needs_correction",
    ].includes(status)
  ) {
    return "IN PROGRESS";
  }

  return "NOT STARTED";
}

export async function loadSplitOutletOperationCards({
  supabase,
  organizationId,
  outletId,
  outletTimezone,
  userId,
  isAdmin,
}: {
  supabase: any;
  organizationId: string;
  outletId: string;
  outletTimezone: string;
  userId: string;
  isAdmin: boolean;
}): Promise<SplitOutletOperationCard[]> {
  const formCodes =
    DEFINITIONS.map(
      item => item.formCode
    );

  const {
    data: formsData,
    error: formsError,
  } = await supabase
    .from("forms")
    .select(`
      id,
      code,
      name
    `)
    .eq(
      "organization_id",
      organizationId
    )
    .eq("is_active", true)
    .in("code", formCodes);

  if (formsError) {
    throw formsError;
  }

  const forms =
    formsData ?? [];

  if (!forms.length) {
    return [];
  }

  const formIds =
    forms.map(
      (form: any) =>
        form.id
    );

  const {
    data: assignmentsData,
    error: assignmentsError,
  } = await supabase
    .from("outlet_form_assignments")
    .select(`
      id,
      form_id,
      form_version_id,
      is_active,
      effective_from,
      effective_until
    `)
    .eq(
      "outlet_id",
      outletId
    )
    .eq(
      "is_active",
      true
    )
    .in(
      "form_id",
      formIds
    );

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignments =
    assignmentsData ?? [];

  if (!assignments.length) {
    return [];
  }

  const assignedFormIds =
    assignments.map(
      (item: any) =>
        item.form_id
    );

  let permissionRows: any[] = [];

  if (!isAdmin) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "user_form_permissions"
      )
      .select(`
        form_id,
        can_fill,
        can_submit,
        can_review,
        can_override
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
        assignedFormIds
      );

    if (error) {
      throw error;
    }

    permissionRows =
      data ?? [];
  }

  const date =
    businessDate(
      outletTimezone ||
      "Asia/Jakarta"
    );

  const {
    data: reportsData,
    error: reportsError,
  } = await supabase
    .from("reports")
    .select(`
      id,
      form_id,
      report_number,
      status,
      business_date,
      created_at,
      pdf_storage_path
    `)
    .eq(
      "outlet_id",
      outletId
    )
    .eq(
      "business_date",
      date
    )
    .in(
      "form_id",
      assignedFormIds
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (reportsError) {
    throw reportsError;
  }

  const reports =
    reportsData ?? [];

  const formByCode =
    new Map<string, any>(
      forms.map(
        (form: any) => [
          String(
            form.code ||
            ""
          ).toUpperCase(),
          form,
        ]
      )
    );

  const assignmentByFormId =
    new Map<string, any>(
      assignments.map(
        (item: any) => [
          item.form_id,
          item,
        ]
      )
    );

  const permissionByFormId =
    new Map<string, any>(
      permissionRows.map(
        (item: any) => [
          item.form_id,
          item,
        ]
      )
    );

  const reportByFormId =
    new Map<string, any>();

  for (const report of reports) {
    if (
      !reportByFormId.has(
        report.form_id
      )
    ) {
      reportByFormId.set(
        report.form_id,
        report
      );
    }
  }

  const cards:
    SplitOutletOperationCard[] = [];

  for (
    const definition of DEFINITIONS
  ) {
    const form =
      formByCode.get(
        definition.formCode
      );

    if (!form) {
      continue;
    }

    const assignment =
      assignmentByFormId.get(
        form.id
      );

    if (!assignment) {
      continue;
    }

    const permission =
      permissionByFormId.get(
        form.id
      );

    const canFill =
      isAdmin ||
      permission?.can_fill ===
        true;

    const canSubmit =
      isAdmin ||
      permission?.can_submit ===
        true;

    const canSee =
      isAdmin ||
      canFill ||
      canSubmit ||
      permission?.can_review ===
        true ||
      permission?.can_override ===
        true;

    if (!canSee) {
      continue;
    }

    const report =
      reportByFormId.get(
        form.id
      );

    const status =
      normalizedStatus(
        report?.status
      );

    const hasPdf =
      Boolean(
        report
          ?.pdf_storage_path
      );

    const href =
      status === "COMPLETED"
        ? hasPdf &&
          report?.id
          ? `/api/reports/${report.id}/pdf`
          : "/protected/reports"
        : `/protected/operations/${definition.formCode}/${definition.sectionCode}`;

    cards.push({
      formId:
        form.id,
      formCode:
        definition.formCode,
      title:
        definition.title,
      area:
        definition.area,
      description:
        definition.description,
      href,
      status,
      reportNumber:
        report
          ?.report_number ??
        null,
      reportId:
        report?.id ??
        null,
      hasPdf,
      canFill,
      canSubmit,
    });
  }

  return cards;
}
