import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  requirePermission,
} from "@/lib/admin/require-admin";


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );
}


function normalizeStatus(
  status?: string | null
) {
  const value =
    String(
      status || ""
    )
      .trim()
      .toLowerCase();

  if (
    value === "submitted" ||
    value === "completed"
  ) {
    return "SUBMITTED";
  }

  if (
    value === "reviewed"
  ) {
    return "REVIEWED";
  }

  if (
    value === "in_progress" ||
    value === "draft" ||
    value === "reopened"
  ) {
    return "IN PROGRESS";
  }

  return "NOT STARTED";
}


function statusClass(
  status: string
) {
  if (
    status === "SUBMITTED" ||
    status === "REVIEWED"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    status === "IN PROGRESS"
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-500";
}


export default async function CentralKitchenPage() {
  const {
    user,
    profile,
    isAdmin,
  } =
    await requirePermission(
      "dashboard.view"
    );

  const supabase =
    await createClient();

  const outlet =
    await getActiveOutlet();

  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  if (
    outlet.code !== "CNT"
  ) {
    return (
      <EmptyState
        title="Central Kitchen"
        message="Pilih outlet CQ Central (CNT) untuk membuka operational Central Kitchen."
        showChangeOutlet
      />
    );
  }


  const {
    data: forms,
    error: formsError,
  } = await supabase
    .from("forms")
    .select(`
      id,
      code,
      name,
      is_active
    `)
    .eq(
      "organization_id",
      profile.organization_id
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

  if (formsError) {
    return (
      <EmptyState
        title="Unable to Load Central Kitchen"
        message={
          formsError.message
        }
      />
    );
  }


  const activeForms =
    forms ?? [];

  if (!activeForms.length) {
    return (
      <EmptyState
        title="Central Kitchen"
        message="Central Kitchen masih dalam staging dan belum diaktifkan."
      />
    );
  }


  const formIds =
    activeForms.map(
      (item: any) =>
        item.id
    );


  const {
    data: assignments,
    error: assignmentError,
  } = await supabase
    .from(
      "outlet_form_assignments"
    )
    .select(`
      id,
      form_id,
      form_version_id,
      is_active
    `)
    .eq(
      "outlet_id",
      outlet.id
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
    return (
      <EmptyState
        title="Unable to Load Central Kitchen"
        message={
          assignmentError.message
        }
      />
    );
  }


  const activeAssignments =
    assignments ?? [];

  if (!activeAssignments.length) {
    return (
      <EmptyState
        title="Central Kitchen"
        message="Central Kitchen belum diaktifkan untuk CQ Central."
      />
    );
  }


  const enabledFormIds =
    new Set(
      activeAssignments.map(
        (item: any) =>
          item.form_id
      )
    );

  const enabledForms =
    activeForms.filter(
      (item: any) =>
        enabledFormIds.has(
          item.id
        )
    );

  const versionIds =
    activeAssignments.map(
      (item: any) =>
        item.form_version_id
    );


  const {
    data: versionSections,
    error:
      versionSectionError,
  } = await supabase
    .from(
      "form_version_sections"
    )
    .select(`
      id,
      form_version_id,
      section_id,
      display_name,
      sort_order,
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
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (versionSectionError) {
    return (
      <EmptyState
        title="Unable to Load CK Sections"
        message={
          versionSectionError.message
        }
      />
    );
  }


  const assignmentByVersion =
    new Map(
      activeAssignments.map(
        (item: any) => [
          item.form_version_id,
          item,
        ]
      )
    );

  const sectionIds =
    (
      versionSections ??
      []
    ).map(
      (item: any) =>
        item.section_id
    );


  const {
    data: sections,
    error: sectionsError,
  } = sectionIds.length
    ? await supabase
        .from("sections")
        .select(`
          id,
          form_id,
          code,
          name,
          is_active
        `)
        .in(
          "id",
          sectionIds
        )
        .eq(
          "is_active",
          true
        )
    : {
        data: [],
        error: null,
      };

  if (sectionsError) {
    return (
      <EmptyState
        title="Unable to Load CK Sections"
        message={
          sectionsError.message
        }
      />
    );
  }


  const sectionById =
    new Map(
      (
        sections ??
        []
      ).map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );


  let permissionRows:
    any[] = [];

  if (!isAdmin) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "user_section_permissions"
      )
      .select(`
        form_id,
        section_id,
        can_view,
        can_fill,
        can_submit,
        can_review
      `)
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "outlet_id",
        outlet.id
      )
      .in(
        "form_id",
        enabledForms.map(
          (item: any) =>
            item.id
        )
      );

    if (error) {
      return (
        <EmptyState
          title="Unable to Load CK Access"
          message={
            error.message
          }
        />
      );
    }

    permissionRows =
      data ?? [];
  }


  const permissionByKey =
    new Map(
      permissionRows.map(
        (item: any) => [
          `${item.form_id}:${item.section_id}`,
          item,
        ]
      )
    );


  const today =
    businessDate(
      outlet.timezone ||
      "Asia/Jakarta"
    );


  const {
    data: reports,
  } = await supabase
    .from("reports")
    .select(`
      id,
      form_id,
      report_number,
      status,
      business_date
    `)
    .eq(
      "outlet_id",
      outlet.id
    )
    .in(
      "form_id",
      enabledForms.map(
        (item: any) =>
          item.id
      )
    )
    .eq(
      "business_date",
      today
    );


  const reportRows =
    reports ?? [];

  const reportByForm =
    new Map(
      reportRows.map(
        (item: any) => [
          item.form_id,
          item,
        ]
      )
    );

  const reportIds =
    reportRows.map(
      (item: any) =>
        item.id
    );


  const {
    data: reportSections,
  } = reportIds.length
    ? await supabase
        .from(
          "report_sections"
        )
        .select(`
          id,
          report_id,
          section_id,
          status,
          started_at,
          submitted_at,
          created_by_email
        `)
        .in(
          "report_id",
          reportIds
        )
    : {
        data: [],
      };


  const reportSectionByKey =
    new Map(
      (
        reportSections ??
        []
      ).map(
        (item: any) => [
          `${item.report_id}:${item.section_id}`,
          item,
        ]
      )
    );


  const cards:
    any[] = [];

  for (
    const versionSection of
    versionSections ?? []
  ) {
    const assignment =
      assignmentByVersion.get(
        versionSection.form_version_id
      );

    if (!assignment) {
      continue;
    }

    const form =
      enabledForms.find(
        (item: any) =>
          item.id ===
          assignment.form_id
      );

    const section =
      sectionById.get(
        versionSection.section_id
      );

    if (
      !form ||
      !section
    ) {
      continue;
    }

    const permission =
      isAdmin
        ? {
            can_view:
              true,
            can_fill:
              true,
            can_submit:
              true,
            can_review:
              true,
          }
        : permissionByKey.get(
            `${form.id}:${section.id}`
          );

    if (
      !permission ||
      permission.can_view !==
        true
    ) {
      continue;
    }

    const report =
      reportByForm.get(
        form.id
      );

    const reportSection =
      report
        ? reportSectionByKey.get(
            `${report.id}:${section.id}`
          )
        : null;

    cards.push({
      form,
      section,
      versionSection,
      permission,
      report,
      reportSection,
      status:
        normalizeStatus(
          reportSection?.status
        ),
    });
  }


  if (!cards.length) {
    return (
      <EmptyState
        title="Central Kitchen"
        message="Tidak ada CK section yang diberikan kepada user ini."
      />
    );
  }


  const openingCards =
    cards.filter(
      (item: any) =>
        item.form.code ===
        "OPENING_CK"
    );

  const closingCards =
    cards.filter(
      (item: any) =>
        item.form.code ===
        "CLOSING_CK"
    );

  const canOperate =
    cards.some(
      (item: any) =>
        item.permission
          .can_fill ===
          true ||
        item.permission
          .can_submit ===
          true
    );

  const canReview =
    cards.some(
      (item: any) =>
        item.permission
          .can_review ===
        true
    );


  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-5 md:px-8 md:py-10">

        <section className="overflow-hidden rounded-[24px] border border-red-100 bg-white shadow-sm md:rounded-[28px]">
          <div className="p-5 sm:p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                  🏭
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                    CQ Central · CNT
                  </p>

                  <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                    Central Kitchen
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {canOperate
                      ? "Pilih section yang menjadi tanggung jawab Anda."
                      : canReview
                        ? "Monitoring progress Opening CK dan Closing CK."
                        : "Central Kitchen operational overview."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canReview && (
                  <Link
                    href="/protected/reports"
                    className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black"
                  >
                    Reports Center
                  </Link>
                )}

                <Link
                  href="/protected"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Dashboard
                </Link>
              </div>
            </div>


            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <MetricBox
                label="Assigned"
                value={
                  cards.length
                }
              />

              <MetricBox
                label="Submitted"
                value={
                  cards.filter(
                    (item: any) =>
                      item.status ===
                        "SUBMITTED" ||
                      item.status ===
                        "REVIEWED"
                  ).length
                }
              />

              <MetricBox
                label="In Progress"
                value={
                  cards.filter(
                    (item: any) =>
                      item.status ===
                      "IN PROGRESS"
                  ).length
                }
              />
            </div>
          </div>
        </section>


        <OperationGroup
          title="Opening CK"
          subtitle="Warehouse opening readiness"
          formCode="OPENING_CK"
          items={
            openingCards
          }
        />

        <OperationGroup
          title="Closing CK"
          subtitle="Warehouse and production closing"
          formCode="CLOSING_CK"
          items={
            closingCards
          }
        />

      </div>
    </main>
  );
}


function OperationGroup({
  title,
  subtitle,
  formCode,
  items,
}: {
  title: string;
  subtitle: string;
  formCode: string;
  items: any[];
}) {
  if (!items.length) {
    return null;
  }

  const completed =
    items.filter(
      (item: any) =>
        item.status ===
          "SUBMITTED" ||
        item.status ===
          "REVIEWED"
    ).length;

  return (
    <section className="mt-5 overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
            Daily Operational
          </p>

          <h2 className="mt-1 text-xl font-black">
            {title}
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            {subtitle}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-neutral-600">
          {completed}/{items.length}
        </span>
      </div>


      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {items.map(
          (item: any) => {
            const canOperate =
              item.permission
                .can_fill ===
                true ||
              item.permission
                .can_submit ===
                true;

            const locked =
              item.status ===
                "SUBMITTED" ||
              item.status ===
                "REVIEWED";

            const href =
              `/protected/operations/${formCode}/${item.section.code}`;

            return (
              <div
                key={`${formCode}:${item.section.id}`}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-neutral-950">
                        {
                          item.versionSection
                            .display_name ||
                          item.section.name
                        }
                      </p>

                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {item.section.code.replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>


                  {item.report
                    ?.report_number && (
                    <p className="mt-4 break-all text-[11px] font-semibold text-neutral-400">
                      {
                        item.report
                          .report_number
                      }
                    </p>
                  )}

                  {item.reportSection
                    ?.created_by_email && (
                    <p className="mt-1 truncate text-[11px] text-neutral-400">
                      PIC: {
                        item.reportSection
                          .created_by_email
                      }
                    </p>
                  )}
                </div>


                {canOperate &&
                !locked ? (
                  <Link
                    href={
                      href
                    }
                    className="flex items-center justify-between border-t border-red-100 bg-red-50 px-4 py-3.5 text-xs font-black text-red-700 transition hover:bg-red-100"
                  >
                    <span>
                      {item.status ===
                        "IN PROGRESS"
                        ? "Resume Section"
                        : "Start Section"}
                    </span>

                    <span>→</span>
                  </Link>
                ) : canOperate ? (
                  <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-3.5 text-xs font-black text-emerald-700">
                    Section submitted ✓
                  </div>
                ) : (
                  <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3.5 text-xs font-semibold text-neutral-500">
                    Monitoring only
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}


function MetricBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:px-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-black">
        {value}
      </p>
    </div>
  );
}


function EmptyState({
  title,
  message,
  showChangeOutlet = false,
}: {
  title: string;
  message: string;
  showChangeOutlet?: boolean;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f5f5f3] px-5 py-10">
      <div className="w-full max-w-xl rounded-[26px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">
          🏭
        </div>

        <h1 className="mt-5 text-2xl font-black">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
          {message}
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {showChangeOutlet && (
            <Link
              href="/protected/select-outlet"
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white"
            >
              Change Outlet
            </Link>
          )}

          <Link
            href="/protected"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
