import { NextResponse } from "next/server";
import { checkAdminApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const CK_FORM_CODES = [
  "OPENING_CK",
  "CLOSING_CK",
];

export async function GET(
  request: Request
) {
  const access =
    await checkAdminApi();

  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
      },
      {
        status: access.status,
      }
    );
  }

  try {
    const admin =
      createAdminClient();

    const organizationId =
      access.profile.organization_id;

    const url =
      new URL(request.url);

    const userId =
      String(
        url.searchParams.get(
          "userId"
        ) ?? ""
      ).trim();

    if (userId) {
      const {
        data: profile,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        return NextResponse.json(
          {
            error:
              "User not found.",
          },
          {
            status: 404,
          }
        );
      }
    }

    const [
      formsResult,
      outletsResult,
    ] =
      await Promise.all([
        admin
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
          .in(
            "code",
            CK_FORM_CODES
          ),
        admin
          .from("outlets")
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
          .order("name"),
      ]);

    if (formsResult.error) {
      throw formsResult.error;
    }

    if (outletsResult.error) {
      throw outletsResult.error;
    }

    const forms =
      formsResult.data ?? [];

    const outlets =
      outletsResult.data ?? [];

    const formIds =
      forms.map(
        (item: any) =>
          item.id
      );

    const outletIds =
      outlets.map(
        (item: any) =>
          item.id
      );

    if (
      formIds.length === 0 ||
      outletIds.length === 0
    ) {
      return NextResponse.json({
        success: true,
        assignments: [],
        sectionAssignments: [],
        leaderAssignments: [],
      });
    }

    const {
      data: assignmentRows,
      error: assignmentError,
    } = await admin
      .from(
        "outlet_form_assignments"
      )
      .select(`
        outlet_id,
        form_id,
        form_version_id,
        effective_from
      `)
      .eq("is_active", true)
      .in("form_id", formIds)
      .in("outlet_id", outletIds)
      .order(
        "effective_from",
        {
          ascending: false,
        }
      );

    if (assignmentError) {
      throw assignmentError;
    }

    /*
     * Runtime also uses the latest
     * active assignment by
     * effective_from.
     */
    const activeAssignments =
      new Map<string, any>();

    for (
      const row of
        assignmentRows ?? []
    ) {
      const key =
        `${row.outlet_id}:${row.form_id}`;

      if (
        !activeAssignments.has(
          key
        )
      ) {
        activeAssignments.set(
          key,
          row
        );
      }
    }

    const activeRows =
      [
        ...activeAssignments
          .values(),
      ];

    const versionIds =
      [
        ...new Set(
          activeRows.map(
            (row: any) =>
              row.form_version_id
          )
        ),
      ];

    let versionSectionRows:
      any[] = [];

    if (
      versionIds.length > 0
    ) {
      const {
        data,
        error,
      } = await admin
        .from(
          "form_version_sections"
        )
        .select(`
          form_version_id,
          section_id
        `)
        .in(
          "form_version_id",
          versionIds
        );

      if (error) {
        throw error;
      }

      versionSectionRows =
        data ?? [];
    }

    const sectionIds =
      [
        ...new Set(
          versionSectionRows.map(
            (row: any) =>
              row.section_id
          )
        ),
      ];

    let sectionRows:
      any[] = [];

    if (
      sectionIds.length > 0
    ) {
      const {
        data,
        error,
      } = await admin
        .from("sections")
        .select(`
          id,
          code,
          name,
          area_code
        `)
        .in("id", sectionIds);

      if (error) {
        throw error;
      }

      sectionRows =
        data ?? [];
    }

    const formMap =
      new Map(
        forms.map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const outletMap =
      new Map(
        outlets.map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const sectionMap =
      new Map(
        sectionRows.map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const sectionIdsByVersion =
      new Map<
        string,
        string[]
      >();

    for (
      const row of
        versionSectionRows
    ) {
      const current =
        sectionIdsByVersion.get(
          row.form_version_id
        ) ?? [];

      current.push(
        row.section_id
      );

      sectionIdsByVersion.set(
        row.form_version_id,
        current
      );
    }

    const assignments =
      activeRows
        .map((row: any) => {
          const form =
            formMap.get(
              row.form_id
            );

          const outlet =
            outletMap.get(
              row.outlet_id
            );

          if (
            !form ||
            !outlet
          ) {
            return null;
          }

          const sections =
            (
              sectionIdsByVersion.get(
                row.form_version_id
              ) ?? []
            )
              .map(
                (sectionId) =>
                  sectionMap.get(
                    sectionId
                  )
              )
              .filter(Boolean)
              .filter(
                (section: any) =>
                  section.area_code ===
                    "STORE" ||
                  section.area_code ===
                    "PRODUCTION"
              )
              .sort(
                (
                  a: any,
                  b: any
                ) =>
                  String(
                    a.name ??
                      a.code ??
                      ""
                  ).localeCompare(
                    String(
                      b.name ??
                        b.code ??
                        ""
                    )
                  )
              )
              .map(
                (section: any) => ({
                  id:
                    section.id,
                  code:
                    section.code,
                  name:
                    section.name,
                  areaCode:
                    section.area_code,
                })
              );

          return {
            outletId:
              row.outlet_id,
            outletCode:
              outlet.code,
            outletName:
              outlet.name,
            formId:
              row.form_id,
            formCode:
              form.code,
            formName:
              form.name,
            formVersionId:
              row.form_version_id,
            sections,
          };
        })
        .filter(Boolean)
        .sort(
          (
            a: any,
            b: any
          ) => {
            const formOrder =
              a.formCode ===
              "OPENING_CK"
                ? 0
                : 1;

            const otherOrder =
              b.formCode ===
              "OPENING_CK"
                ? 0
                : 1;

            if (
              formOrder !==
              otherOrder
            ) {
              return (
                formOrder -
                otherOrder
              );
            }

            return String(
              a.outletName
            ).localeCompare(
              String(
                b.outletName
              )
            );
          }
        );

    let sectionAssignments:
      any[] = [];

    let leaderAssignments:
      any[] = [];

    if (userId) {
      const [
        sectionResult,
        leaderResult,
      ] =
        await Promise.all([
          admin
            .from(
              "user_section_permissions"
            )
            .select(`
              outlet_id,
              form_id,
              section_id
            `)
            .eq(
              "user_id",
              userId
            )
            .eq(
              "can_submit",
              true
            )
            .in(
              "form_id",
              formIds
            ),
          admin
            .from(
              "form_area_leaders"
            )
            .select(`
              outlet_id,
              form_id,
              area_code
            `)
            .eq(
              "user_id",
              userId
            )
            .in(
              "form_id",
              formIds
            ),
        ]);

      if (
        sectionResult.error
      ) {
        throw sectionResult.error;
      }

      if (
        leaderResult.error
      ) {
        throw leaderResult.error;
      }

      sectionAssignments =
        (
          sectionResult.data ??
          []
        ).map(
          (row: any) => ({
            outletId:
              row.outlet_id,
            formId:
              row.form_id,
            sectionId:
              row.section_id,
          })
        );

      leaderAssignments =
        (
          leaderResult.data ??
          []
        ).map(
          (row: any) => ({
            outletId:
              row.outlet_id,
            formId:
              row.form_id,
            areaCode:
              row.area_code,
          })
        );
    }

    return NextResponse.json({
      success: true,
      assignments,
      sectionAssignments,
      leaderAssignments,
    });
  } catch (error: any) {
    console.error(
      "Load CK admin access error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load Central Kitchen access.",
      },
      {
        status: 500,
      }
    );
  }
}
