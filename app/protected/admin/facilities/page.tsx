import {
  requirePermission,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  FacilitiesClient,
} from "./facilities-client";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const UNFINISHED_STATUSES = [
  "draft",
  "in_progress",
  "reopened",
  "needs_correction",
];

function facilityKeyFromQuestion(
  question: any
) {
  const applicability =
    question?.config
      ?.applicability;

  if (
    applicability?.type !==
    "facility"
  ) {
    return null;
  }

  const key =
    String(
      applicability
        ?.facility_key ??
        ""
    )
      .trim()
      .toUpperCase();

  return key || null;
}

export default async function FacilitiesPage() {
  const {
    profile,
  } =
    await requirePermission(
      "admin.access"
    );

  const organizationId =
    profile.organization_id;

  const admin =
    createAdminClient();

  const [
    outletsResult,
    facilitiesResult,
  ] =
    await Promise.all([
      admin
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
          organizationId
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "code"
        ),

      admin
        .from(
          "facility_definitions"
        )
        .select(`
          id,
          code,
          name,
          description,
          is_active
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "code"
        ),
    ]);

  if (
    outletsResult.error
  ) {
    throw new Error(
      `Unable to load outlets: ${outletsResult.error.message}`
    );
  }

  if (
    facilitiesResult.error
  ) {
    throw new Error(
      `Unable to load facilities: ${facilitiesResult.error.message}`
    );
  }

  const outlets =
    outletsResult.data ??
    [];

  const facilities =
    facilitiesResult.data ??
    [];

  const outletIds =
    outlets.map(
      (row) => row.id
    );

  const facilityIds =
    facilities.map(
      (row) => row.id
    );

  const [
    assignmentsResult,
    reportsResult,
    configurationsResult,
  ] =
    outletIds.length
      ? await Promise.all([
          admin
            .from(
              "outlet_form_assignments"
            )
            .select(`
              outlet_id,
              form_id,
              form_version_id,
              is_active
            `)
            .in(
              "outlet_id",
              outletIds
            )
            .eq(
              "is_active",
              true
            ),

          admin
            .from("reports")
            .select(`
              id,
              outlet_id,
              form_version_id,
              report_number,
              status,
              created_at
            `)
            .in(
              "outlet_id",
              outletIds
            )
            .in(
              "status",
              UNFINISHED_STATUSES
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            ),

          facilityIds.length
            ? admin
                .from(
                  "outlet_facilities"
                )
                .select(`
                  id,
                  outlet_id,
                  facility_id,
                  is_available,
                  notes,
                  updated_at
                `)
                .in(
                  "outlet_id",
                  outletIds
                )
                .in(
                  "facility_id",
                  facilityIds
                )
            : Promise.resolve({
                data:
                  [] as any[],
                error:
                  null,
              }),
        ])
      : [
          {
            data:
              [] as any[],
            error:
              null,
          },
          {
            data:
              [] as any[],
            error:
              null,
          },
          {
            data:
              [] as any[],
            error:
              null,
          },
        ];

  if (
    assignmentsResult.error
  ) {
    throw new Error(
      `Unable to load active form assignments: ${assignmentsResult.error.message}`
    );
  }

  if (
    reportsResult.error
  ) {
    throw new Error(
      `Unable to load unfinished reports: ${reportsResult.error.message}`
    );
  }

  if (
    configurationsResult.error
  ) {
    throw new Error(
      `Unable to load outlet facilities: ${configurationsResult.error.message}`
    );
  }

  const assignments =
    assignmentsResult.data ??
    [];

  const openReports =
    reportsResult.data ??
    [];

  const configurations =
    (
      configurationsResult.data ??
      []
    ).map(
      (row: any) => ({
        id:
          row.id,
        outletId:
          row.outlet_id,
        facilityId:
          row.facility_id,
        isAvailable:
          row.is_available ===
          true,
        updatedAt:
          row.updated_at,
      })
    );

  const versionIds =
    Array.from(
      new Set(
        [
          ...assignments.map(
            (row: any) =>
              row.form_version_id
          ),
          ...openReports.map(
            (row: any) =>
              row.form_version_id
          ),
        ].filter(
          Boolean
        )
      )
    );

  let versionSections:
    any[] = [];

  if (
    versionIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "form_version_sections"
        )
        .select(`
          id,
          form_version_id,
          is_active
        `)
        .in(
          "form_version_id",
          versionIds
        )
        .eq(
          "is_active",
          true
        );

    if (error) {
      throw new Error(
        `Unable to load form version sections: ${error.message}`
      );
    }

    versionSections =
      data ?? [];
  }

  const sectionIds =
    versionSections.map(
      (row) => row.id
    );

  let questions:
    any[] = [];

  if (
    sectionIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "questions"
        )
        .select(`
          id,
          version_section_id,
          code,
          config,
          is_active
        `)
        .in(
          "version_section_id",
          sectionIds
        )
        .eq(
          "is_active",
          true
        );

    if (error) {
      throw new Error(
        `Unable to load facility applicability questions: ${error.message}`
      );
    }

    questions =
      data ?? [];
  }

  const openReportIds =
    openReports.map(
      (row: any) =>
        row.id
    );

  let reportSections:
    any[] = [];

  if (
    openReportIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "report_sections"
        )
        .select(`
          id,
          report_id,
          version_section_id
        `)
        .in(
          "report_id",
          openReportIds
        );

    if (error) {
      throw new Error(
        `Unable to load unfinished report sections: ${error.message}`
      );
    }

    reportSections =
      data ?? [];
  }

  const reportSectionIds =
    reportSections.map(
      (row) => row.id
    );

  let applicabilityRows:
    any[] = [];

  if (
    reportSectionIds.length
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "report_question_applicability"
        )
        .select(`
          report_section_id,
          question_id,
          source_type,
          source_key
        `)
        .in(
          "report_section_id",
          reportSectionIds
        );

    if (error) {
      throw new Error(
        `Unable to load applicability snapshots: ${error.message}`
      );
    }

    applicabilityRows =
      data ?? [];
  }

  const versionBySectionId =
    new Map<
      string,
      string
    >(
      versionSections.map(
        (row) => [
          row.id,
          row.form_version_id,
        ]
      )
    );

  const facilityCodesByVersion =
    new Map<
      string,
      Set<string>
    >();

  const facilitySectionsByVersionCode =
    new Map<
      string,
      Map<
        string,
        string[]
      >
    >();

  for (
    const question
    of questions
  ) {
    const facilityCode =
      facilityKeyFromQuestion(
        question
      );

    if (
      !facilityCode
    ) {
      continue;
    }

    const versionId =
      versionBySectionId.get(
        question.version_section_id
      );

    if (
      !versionId
    ) {
      continue;
    }

    if (
      !facilityCodesByVersion.has(
        versionId
      )
    ) {
      facilityCodesByVersion.set(
        versionId,
        new Set()
      );
    }

    facilityCodesByVersion
      .get(
        versionId
      )!
      .add(
        facilityCode
      );

    const versionFacilityKey =
      `${versionId}:${facilityCode}`;

    if (
      !facilitySectionsByVersionCode.has(
        versionFacilityKey
      )
    ) {
      facilitySectionsByVersionCode.set(
        versionFacilityKey,
        new Map()
      );
    }

    const sectionMap =
      facilitySectionsByVersionCode.get(
        versionFacilityKey
      )!;

    const questionIds =
      sectionMap.get(
        question.version_section_id
      ) ??
      [];

    questionIds.push(
      String(
        question.id
      )
    );

    sectionMap.set(
      question.version_section_id,
      questionIds
    );
  }

  const facilityByCode =
    new Map<
      string,
      any
    >(
      facilities.map(
        (facility) => [
          String(
            facility.code
          )
            .trim()
            .toUpperCase(),
          facility,
        ]
      )
    );

  let requiredCells:
    Array<{
      outletId: string;
      facilityCode: string;
    }> = [];

  if (
    outletIds.length
  ) {
    const {
      data:
        requirementRows,
      error:
        requirementError,
    } =
      await admin
        .from(
          "active_outlet_facility_requirements"
        )
        .select(`
          outlet_id,
          facility_id,
          facility_code
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "outlet_id",
          outletIds
        );

    if (
      requirementError
    ) {
      throw new Error(
        `Unable to load active facility requirements: ${requirementError.message}`
      );
    }

    requiredCells =
      Array.from(
        new Map(
          (
            requirementRows ??
            []
          ).map(
            (row: any) => {
              const outletId =
                String(
                  row.outlet_id
                );

              const facilityCode =
                String(
                  row.facility_code ??
                    ""
                )
                  .trim()
                  .toUpperCase();

              return [
                `${outletId}:${facilityCode}`,
                {
                  outletId,
                  facilityCode,
                },
              ];
            }
          )
        ).values()
      );
  }

  const reportSectionByReportVersionSection =
    new Map<
      string,
      any
    >();

  for (
    const section
    of reportSections
  ) {
    reportSectionByReportVersionSection.set(
      `${section.report_id}:${section.version_section_id}`,
      section
    );
  }

  const facilitySnapshotSet =
    new Set<string>();

  for (
    const row
    of applicabilityRows
  ) {
    if (
      String(
        row.source_type ??
          ""
      )
        .trim()
        .toLowerCase() !==
      "facility"
    ) {
      continue;
    }

    const sourceKey =
      String(
        row.source_key ??
          ""
      )
        .trim()
        .toUpperCase();

    facilitySnapshotSet.add(
      `${row.report_section_id}:${row.question_id}:${sourceKey}`
    );
  }

  const blockerMap =
    new Map<
      string,
      {
        key: string;
        reports: string[];
      }
    >();

  for (
    const report
    of openReports
  ) {
    const codes =
      facilityCodesByVersion.get(
        report.form_version_id
      );

    if (!codes) {
      continue;
    }

    for (
      const code
      of codes
    ) {
      const facility =
        facilityByCode.get(
          code
        );

      if (
        !facility
      ) {
        continue;
      }

      const versionFacilityKey =
        `${report.form_version_id}:${code}`;

      const sectionMap =
        facilitySectionsByVersionCode.get(
          versionFacilityKey
        );

      if (
        !sectionMap ||
        sectionMap.size ===
          0
      ) {
        continue;
      }

      let blockerReason:
        string | null =
        null;

      for (
        const [
          versionSectionId,
          questionIds,
        ]
        of sectionMap.entries()
      ) {
        const reportSection =
          reportSectionByReportVersionSection.get(
            `${report.id}:${versionSectionId}`
          );

        if (
          !reportSection
        ) {
          blockerReason =
            "section not started";
          break;
        }

        const incomplete =
          questionIds.some(
            (
              questionId
            ) =>
              !facilitySnapshotSet.has(
                `${reportSection.id}:${questionId}:${code}`
              )
          );

        if (
          incomplete
        ) {
          blockerReason =
            "snapshot incomplete";
          break;
        }
      }

      if (
        !blockerReason
      ) {
        continue;
      }

      const key =
        `${report.outlet_id}:${facility.id}`;

      const label =
        `${report.report_number} (${report.status}; ${blockerReason})`;

      const existing =
        blockerMap.get(
          key
        );

      if (
        existing
      ) {
        if (
          !existing.reports.includes(
            label
          )
        ) {
          existing.reports.push(
            label
          );
        }
      } else {
        blockerMap.set(
          key,
          {
            key,
            reports: [
              label,
            ],
          }
        );
      }
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 md:px-8 md:py-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">
          Outlet Facilities
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
          Manage facility availability per outlet.
          Required status follows each outlet&apos;s active
          form versions. Unused facilities are not counted
          as configuration errors.
        </p>
      </div>

      <FacilitiesClient
        outlets={
          outlets
        }
        facilities={
          facilities
        }
        initialConfigurations={
          configurations
        }
        key={
          requiredCells
            .map(
              (cell) =>
                `${cell.outletId}:${cell.facilityCode}`
            )
            .sort()
            .join("|")
        }
        requiredCells={
          requiredCells
        }
        blockers={
          Array.from(
            blockerMap.values()
          )
        }
      />
    </main>
  );
}
