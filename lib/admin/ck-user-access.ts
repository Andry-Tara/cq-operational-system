export type CkAreaCode =
  | "STORE"
  | "PRODUCTION";

export type CkSectionAssignment = {
  outletId: string;
  formId: string;
  sectionId: string;
};

export type CkLeaderAssignment = {
  outletId: string;
  formId: string;
  areaCode: CkAreaCode;
};

export type CkAccessPayload = {
  provided: boolean;
  sectionAssignments: CkSectionAssignment[];
  leaderAssignments: CkLeaderAssignment[];
};

const CK_FORM_CODES = [
  "OPENING_CK",
  "CLOSING_CK",
];

function uniqueBy<T>(
  rows: T[],
  getKey: (row: T) => string
) {
  const map = new Map<string, T>();

  for (const row of rows) {
    map.set(getKey(row), row);
  }

  return [...map.values()];
}

export function parseCkAccessPayload(
  body: any
): CkAccessPayload {
  const sectionProvided =
    Object.prototype.hasOwnProperty.call(
      body ?? {},
      "ckSectionAssignments"
    );

  const leaderProvided =
    Object.prototype.hasOwnProperty.call(
      body ?? {},
      "ckLeaderAssignments"
    );

  const rawSections =
    Array.isArray(
      body?.ckSectionAssignments
    )
      ? body.ckSectionAssignments
      : [];

  const rawLeaders =
    Array.isArray(
      body?.ckLeaderAssignments
    )
      ? body.ckLeaderAssignments
      : [];

  const sectionAssignments =
    uniqueBy(
      rawSections
        .map((item: any) => ({
          outletId: String(
            item?.outletId ?? ""
          ).trim(),
          formId: String(
            item?.formId ?? ""
          ).trim(),
          sectionId: String(
            item?.sectionId ?? ""
          ).trim(),
        }))
        .filter(
          (
            item: CkSectionAssignment
          ) =>
            item.outletId &&
            item.formId &&
            item.sectionId
        ),
      (
        item: CkSectionAssignment
      ) =>
        [
          item.outletId,
          item.formId,
          item.sectionId,
        ].join(":")
    );

  const leaderAssignments =
    uniqueBy(
      rawLeaders
        .map((item: any) => {
          const areaCode =
            String(
              item?.areaCode ?? ""
            )
              .trim()
              .toUpperCase();

          return {
            outletId: String(
              item?.outletId ?? ""
            ).trim(),
            formId: String(
              item?.formId ?? ""
            ).trim(),
            areaCode,
          };
        })
        .filter(
          (item: any) =>
            item.outletId &&
            item.formId &&
            (
              item.areaCode ===
                "STORE" ||
              item.areaCode ===
                "PRODUCTION"
            )
        ) as CkLeaderAssignment[],
      (
        item: CkLeaderAssignment
      ) =>
        [
          item.outletId,
          item.formId,
          item.areaCode,
        ].join(":")
    );

  return {
    provided:
      sectionProvided ||
      leaderProvided,
    sectionAssignments,
    leaderAssignments,
  };
}

export async function saveCkUserAccess({
  admin,
  organizationId,
  userId,
  roleId,
  outletIds,
  payload,
}: {
  admin: any;
  organizationId: string;
  userId: string;
  roleId: string;
  outletIds: string[];
  payload: CkAccessPayload;
}) {
  if (!payload.provided) {
    return;
  }

  const {
    data: role,
    error: roleError,
  } = await admin
    .from("roles")
    .select("id, code")
    .eq("id", roleId)
    .eq(
      "organization_id",
      organizationId
    )
    .maybeSingle();

  if (roleError) {
    throw roleError;
  }

  if (!role) {
    throw new Error(
      "Invalid role for CK access."
    );
  }

  const {
    data: ckForms,
    error: formError,
  } = await admin
    .from("forms")
    .select("id, code")
    .eq(
      "organization_id",
      organizationId
    )
    .in("code", CK_FORM_CODES);

  if (formError) {
    throw formError;
  }

  const ckFormIds = (
    ckForms ?? []
  ).map((item: any) => item.id);

  if (ckFormIds.length === 0) {
    if (
      payload.sectionAssignments
        .length > 0 ||
      payload.leaderAssignments
        .length > 0
    ) {
      throw new Error(
        "Central Kitchen forms are not configured."
      );
    }

    return;
  }

  const ckRole =
    role.code === "CK_STAFF" ||
    role.code === "CK_MANAGER";

  const canLead =
    role.code === "CK_MANAGER";

  const selectedOutlets =
    new Set(outletIds);

  const ckFormsSet =
    new Set(ckFormIds);

  const desiredSections =
    ckRole
      ? payload.sectionAssignments
      : [];

  const desiredLeaders =
    canLead
      ? payload.leaderAssignments
      : [];

  for (
    const item of desiredSections
  ) {
    if (
      !selectedOutlets.has(
        item.outletId
      )
    ) {
      throw new Error(
        "CK section assignment references an outlet not assigned to the user."
      );
    }

    if (
      !ckFormsSet.has(item.formId)
    ) {
      throw new Error(
        "Invalid Central Kitchen form in section assignment."
      );
    }
  }

  for (
    const item of desiredLeaders
  ) {
    if (
      !selectedOutlets.has(
        item.outletId
      )
    ) {
      throw new Error(
        "CK leader assignment references an outlet not assigned to the user."
      );
    }

    if (
      !ckFormsSet.has(item.formId)
    ) {
      throw new Error(
        "Invalid Central Kitchen form in leader assignment."
      );
    }
  }

  const referencedPairs =
    uniqueBy(
      [
        ...desiredSections.map(
          (item) => ({
            outletId:
              item.outletId,
            formId:
              item.formId,
          })
        ),
        ...desiredLeaders.map(
          (item) => ({
            outletId:
              item.outletId,
            formId:
              item.formId,
          })
        ),
      ],
      (item) =>
        `${item.outletId}:${item.formId}`
    );

  if (
    referencedPairs.length > 0
  ) {
    const referencedOutletIds =
      [
        ...new Set(
          referencedPairs.map(
            (item) =>
              item.outletId
          )
        ),
      ];

    const referencedFormIds =
      [
        ...new Set(
          referencedPairs.map(
            (item) =>
              item.formId
          )
        ),
      ];

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
      .in(
        "outlet_id",
        referencedOutletIds
      )
      .in(
        "form_id",
        referencedFormIds
      )
      .order(
        "effective_from",
        {
          ascending: false,
        }
      );

    if (assignmentError) {
      throw assignmentError;
    }

    const activeAssignmentMap =
      new Map<string, any>();

    for (
      const row of
        assignmentRows ?? []
    ) {
      const key =
        `${row.outlet_id}:${row.form_id}`;

      if (
        !activeAssignmentMap.has(
          key
        )
      ) {
        activeAssignmentMap.set(
          key,
          row
        );
      }
    }

    for (
      const pair of
        referencedPairs
    ) {
      const key =
        `${pair.outletId}:${pair.formId}`;

      if (
        !activeAssignmentMap.has(
          key
        )
      ) {
        throw new Error(
          "No active CK form version exists for one of the selected outlet/form assignments."
        );
      }
    }

    if (
      desiredSections.length > 0
    ) {
      const versionIds =
        [
          ...new Set(
            desiredSections.map(
              (item) =>
                activeAssignmentMap.get(
                  `${item.outletId}:${item.formId}`
                )
                  .form_version_id
            )
          ),
        ];

      const sectionIds =
        [
          ...new Set(
            desiredSections.map(
              (item) =>
                item.sectionId
            )
          ),
        ];

      const {
        data:
          versionSectionRows,
        error:
          versionSectionError,
      } = await admin
        .from(
          "form_version_sections"
        )
        .select(
          "form_version_id, section_id"
        )
        .in(
          "form_version_id",
          versionIds
        )
        .in(
          "section_id",
          sectionIds
        );

      if (
        versionSectionError
      ) {
        throw versionSectionError;
      }

      const allowed =
        new Set(
          (
            versionSectionRows ??
            []
          ).map(
            (row: any) =>
              `${row.form_version_id}:${row.section_id}`
          )
        );

      for (
        const item of
          desiredSections
      ) {
        const assignment =
          activeAssignmentMap.get(
            `${item.outletId}:${item.formId}`
          );

        const key =
          `${assignment.form_version_id}:${item.sectionId}`;

        if (
          !allowed.has(key)
        ) {
          throw new Error(
            "Selected section is not part of the active CK form version."
          );
        }
      }
    }
  }

  const {
    data:
      currentSectionRows,
    error:
      currentSectionError,
  } = await admin
    .from(
      "user_section_permissions"
    )
    .select(`
      id,
      outlet_id,
      form_id,
      section_id
    `)
    .eq("user_id", userId)
    .in("form_id", ckFormIds);

  if (currentSectionError) {
    throw currentSectionError;
  }

  const desiredSectionKeys =
    new Set(
      desiredSections.map(
        (item) =>
          [
            item.outletId,
            item.formId,
            item.sectionId,
          ].join(":")
      )
    );

  if (
    desiredSections.length > 0
  ) {
    const {
      error: upsertError,
    } = await admin
      .from(
        "user_section_permissions"
      )
      .upsert(
        desiredSections.map(
          (item) => ({
            user_id: userId,
            outlet_id:
              item.outletId,
            form_id:
              item.formId,
            section_id:
              item.sectionId,
            can_view: true,
            can_fill: true,
            can_submit: true,
            can_review: false,
          })
        ),
        {
          onConflict:
            "user_id,outlet_id,form_id,section_id",
        }
      );

    if (upsertError) {
      throw upsertError;
    }
  }

  const staleSectionIds =
    (
      currentSectionRows ?? []
    )
      .filter(
        (row: any) =>
          !desiredSectionKeys.has(
            [
              row.outlet_id,
              row.form_id,
              row.section_id,
            ].join(":")
          )
      )
      .map(
        (row: any) => row.id
      );

  if (
    staleSectionIds.length > 0
  ) {
    const {
      error: deleteError,
    } = await admin
      .from(
        "user_section_permissions"
      )
      .delete()
      .in(
        "id",
        staleSectionIds
      );

    if (deleteError) {
      throw deleteError;
    }
  }

  const {
    data:
      currentLeaderRows,
    error:
      currentLeaderError,
  } = await admin
    .from("form_area_leaders")
    .select(`
      id,
      outlet_id,
      form_id,
      area_code
    `)
    .eq("user_id", userId)
    .in("form_id", ckFormIds);

  if (currentLeaderError) {
    throw currentLeaderError;
  }

  const desiredLeaderKeys =
    new Set(
      desiredLeaders.map(
        (item) =>
          [
            item.outletId,
            item.formId,
            item.areaCode,
          ].join(":")
      )
    );

  if (
    desiredLeaders.length > 0
  ) {
    const {
      error:
        leaderUpsertError,
    } = await admin
      .from(
        "form_area_leaders"
      )
      .upsert(
        desiredLeaders.map(
          (item) => ({
            outlet_id:
              item.outletId,
            form_id:
              item.formId,
            area_code:
              item.areaCode,
            user_id: userId,
          })
        ),
        {
          onConflict:
            "outlet_id,form_id,area_code,user_id",
        }
      );

    if (
      leaderUpsertError
    ) {
      throw leaderUpsertError;
    }
  }

  const staleLeaderIds =
    (
      currentLeaderRows ?? []
    )
      .filter(
        (row: any) =>
          !desiredLeaderKeys.has(
            [
              row.outlet_id,
              row.form_id,
              row.area_code,
            ].join(":")
          )
      )
      .map(
        (row: any) => row.id
      );

  if (
    staleLeaderIds.length > 0
  ) {
    const {
      error:
        leaderDeleteError,
    } = await admin
      .from(
        "form_area_leaders"
      )
      .delete()
      .in(
        "id",
        staleLeaderIds
      );

    if (
      leaderDeleteError
    ) {
      throw leaderDeleteError;
    }
  }
}
