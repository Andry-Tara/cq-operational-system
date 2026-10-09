export const QA_CRITERIA = [
  {
    key: "visual",
    label: "Visual / Presentation",
    status: "visual_status",
    note: "visual_note",
  },
  {
    key: "serving_method",
    label: "Serving Method",
    status: "serving_method_status",
    note: "serving_method_note",
  },
  {
    key: "plating",
    label: "Plating & Garnish",
    status: "plating_status",
    note: "plating_note",
  },
  {
    key: "aroma",
    label: "Aroma",
    status: "aroma_status",
    note: "aroma_note",
  },
  {
    key: "ingredients",
    label: "Ingredients",
    status: "ingredients_status",
    note: "ingredients_note",
  },
  {
    key: "portion",
    label: "Portion",
    status: "portion_status",
    note: "portion_note",
  },
  {
    key: "temperature",
    label: "Temperature",
    status: "temperature_status",
    note: "temperature_note",
  },
  {
    key: "taste",
    label: "Taste",
    status: "taste_status",
    note: "taste_note",
  },
  {
    key: "texture",
    label: "Texture",
    status: "texture_status",
    note: "texture_note",
  },
] as const;


function one<T>(
  value: T | T[] | null | undefined,
): T | null {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}


function normalize(
  value: unknown,
) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function point(
  value: unknown,
) {
  return String(value) === "STANDARD"
    ? 1
    : 0;
}


export async function loadQaFoodReportData(
  admin: any,
  sessionId: string,
  organizationId: string,
) {
  const {
    data: session,
    error: sessionError,
  } =
    await admin
      .from("qa_food_sessions")
      .select(`
        id,
        organization_id,
        outlet_id,
        business_date,
        status,
        target_menu_count,
        result_status,
        qa_number,
        score,
        max_score,
        scoring_snapshot,
        created_by,
        auditor_name_snapshot,
        started_at,
        finalized_at,
        created_at
      `)
      .eq(
        "id",
        sessionId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }


  const [
    outletResult,
    itemResult,
    assignmentResult,
  ] =
    await Promise.all([
      admin
        .from("outlets")
        .select(`
          id,
          code,
          name,
          timezone
        `)
        .eq(
          "id",
          session.outlet_id,
        )
        .maybeSingle(),

      admin
        .from("qa_food_session_items")
        .select(`
          id,
          menu_id,
          round_no,
          sequence_no,
          state,
          menu_name_snapshot,
          category_snapshot,
          service_standard_seconds,
          selected_at,
          started_at,
          served_at,
          service_seconds,
          service_status
        `)
        .eq(
          "session_id",
          session.id,
        )
        .neq(
          "state",
          "VOIDED",
        )
        .order(
          "sequence_no",
        ),

      admin
        .from("team_staff_assignments")
        .select(`
          id,
          staff_id,
          position_id,
          is_primary,
          effective_from,
          effective_to,
          team_staff (
            id,
            full_name,
            is_active
          ),
          staff_positions (
            id,
            name,
            category,
            area,
            is_active
          )
        `)
        .eq(
          "organization_id",
          session.organization_id,
        )
        .eq(
          "outlet_id",
          session.outlet_id,
        )
        .lte(
          "effective_from",
          session.business_date,
        )
        .or(
          `effective_to.is.null,effective_to.gte.${session.business_date}`,
        )
        .order(
          "is_primary",
          {
            ascending: false,
          },
        )
        .order(
          "effective_from",
          {
            ascending: false,
          },
        ),
    ]);


  if (
    outletResult.error ||
    !outletResult.data
  ) {
    throw (
      outletResult.error ||
      new Error(
        "QA Food outlet not found.",
      )
    );
  }

  if (itemResult.error) {
    throw itemResult.error;
  }

  if (assignmentResult.error) {
    throw assignmentResult.error;
  }


  const items =
    itemResult.data ?? [];

  const itemIds =
    items.map(
      (item: any) =>
        item.id,
    );


  let assessments: any[] =
    [];

  let evidence: any[] =
    [];


  if (itemIds.length) {
    const [
      assessmentResult,
      evidenceResult,
    ] =
      await Promise.all([
        admin
          .from("qa_food_assessments")
          .select(`
            id,
            item_id,

            visual_status,
            visual_note,

            serving_method_status,
            serving_method_note,

            plating_status,
            plating_note,

            aroma_status,
            aroma_note,

            ingredients_status,
            ingredients_note,

            portion_status,
            portion_note,

            temperature_status,
            temperature_note,

            taste_status,
            taste_note,

            texture_status,
            texture_note,

            weight_grams,
            serving_temperature_c,

            result_status,
            assessed_at
          `)
          .in(
            "item_id",
            itemIds,
          ),

        admin
          .from("qa_food_evidence")
          .select(`
            id,
            item_id,
            storage_bucket,
            storage_path,
            original_filename,
            mime_type,
            file_size,
            sort_order,
            captured_at,
            uploaded_at,
            capture_source,
            location_status,
            location_accuracy_m,
            distance_from_outlet_m
          `)
          .in(
            "item_id",
            itemIds,
          )
          .order(
            "sort_order",
          ),
      ]);

    if (assessmentResult.error) {
      throw assessmentResult.error;
    }

    if (evidenceResult.error) {
      throw evidenceResult.error;
    }

    assessments =
      assessmentResult.data ?? [];

    evidence =
      evidenceResult.data ?? [];
  }


  const assessmentByItem =
    new Map(
      assessments.map(
        (row: any) => [
          row.item_id,
          row,
        ],
      ),
    );


  const evidenceByItem =
    new Map<string, any[]>();


  for (const row of evidence) {
    const current =
      evidenceByItem.get(
        row.item_id,
      ) ?? [];

    current.push(row);

    evidenceByItem.set(
      row.item_id,
      current,
    );
  }


  const snapshot =
    session.scoring_snapshot &&
    typeof session.scoring_snapshot === "object"
      ? session.scoring_snapshot
      : {};


  const menuScores =
    Array.isArray(
      snapshot.menu_scores,
    )
      ? snapshot.menu_scores
      : [];


  const menuScoreByItem =
    new Map<
      string,
      any
    >(
      menuScores.map(
        (row: any) => [
          String(
            row.item_id,
          ),
          row,
        ],
      ),
    );


  const reportItems =
    items.map(
      (item: any) => {
        const assessment =
          assessmentByItem.get(
            item.id,
          ) ?? null;

        const snapshotScore =
          menuScoreByItem.get(
            item.id,
          );

        const calculatedScore =
          point(
            item.service_status,
          ) +
          QA_CRITERIA.reduce(
            (
              total,
              criterion,
            ) =>
              total +
              point(
                assessment?.[
                  criterion.status
                ],
              ),
            0,
          );

        const score =
          Number(
            snapshotScore?.score ??
            calculatedScore,
          );

        return {
          ...item,

          assessment,

          evidence:
            evidenceByItem.get(
              item.id,
            ) ?? [],

          score,

          max_score:
            10,

          points_lost:
            Math.max(
              0,
              10 - score,
            ),

          result_status:
            score === 10
              ? "PASS"
              : "NEEDS_CORRECTION",
        };
      },
    );


  const assignments =
    (assignmentResult.data ?? [])
      .map(
        (row: any) => ({
          ...row,

          staff:
            one<any>(
              row.team_staff,
            ),

          position:
            one<any>(
              row.staff_positions,
            ),
        }),
      )
      .filter(
        (row: any) =>
          row.staff &&
          row.position &&
          row.staff.is_active !== false &&
          row.position.is_active !== false,
      );


  function signerFor(
    names: string[],
  ) {
    const found =
      assignments.find(
        (row: any) =>
          names.includes(
            normalize(
              row.position?.name,
            ),
          ),
      );

    return (
      found?.staff?.full_name ||
      ""
    );
  }


  void signerFor;

  return {
    session,

    outlet:
      outletResult.data,

    scoring:
      snapshot,

    items:
      reportItems,

    signatures: {
      auditor:
        session.auditor_name_snapshot ||
        "",

      // Shift PIC names are intentionally blank.
      leaderFoh:
        "",

      leaderBoh:
        "",

      manager:
        "",
    },
  };
}
