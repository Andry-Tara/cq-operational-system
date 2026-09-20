import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import FloorMappingClient from "./floor-mapping-client";


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


export default async function FloorMappingPage() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    redirect(
      "/login"
    );
  }


  const activeOutlet =
    await getActiveOutlet();


  if (!activeOutlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const supabase =
    await createClient();


  if (
    !context.isAdmin
  ) {
    const {
      data:
        hasOutletAccess,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            activeOutlet.id,
        }
      );


    if (
      hasOutletAccess !==
      true
    ) {
      return (
        <StateCard
          title="Outlet Access Required"
          message="You do not have access to Floor Mapping for the active outlet."
        />
      );
    }
  }


  const admin =
    createAdminClient();


  const {
    data:
      outlet,
    error:
      outletError,
  } =
    await admin
      .from(
        "outlets"
      )
      .select(`
        id,
        code,
        name,
        timezone,
        organization_id,
        is_active
      `)
      .eq(
        "id",
        activeOutlet.id
      )
      .eq(
        "organization_id",
        context.profile
          .organization_id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (
    outletError ||
    !outlet
  ) {
    throw (
      outletError ||
      new Error(
        "Active outlet not found."
      )
    );
  }


  if (
    String(
      outlet.code ||
      ""
    )
      .trim()
      .toUpperCase() ===
    "CNT"
  ) {
    return (
      <StateCard
        title="Floor Mapping Not Available"
        message="Central Kitchen does not use outlet Floor Mapping."
      />
    );
  }


  const {
    data:
      template,
    error:
      templateError,
  } =
    await admin
      .from(
        "floor_mapping_templates"
      )
      .select(`
        id,
        name,
        version_number,
        image_storage_path,
        is_active
      `)
      .eq(
        "outlet_id",
        outlet.id
      )
      .eq(
        "organization_id",
        outlet.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();


  if (
    templateError
  ) {
    throw templateError;
  }


  if (!template) {
    return (
      <StateCard
        title="Floor Plan Required"
        message="No active Floor Mapping template has been configured for this outlet."
      />
    );
  }


  const today =
    businessDate(
      outlet.timezone ||
      "Asia/Jakarta"
    );


  const [
    signedResult,
    zonesResult,
    bohPositionsResult,
    sessionsResult,
  ] =
    await Promise.all([
      admin.storage
        .from(
          "operational-photos"
        )
        .createSignedUrl(
          template
            .image_storage_path,
          3600
        ),

      admin
        .from(
          "floor_mapping_zones"
        )
        .select(`
          id,
          zone_code,
          zone_name,
          zone_type,
          x_pct,
          y_pct,
          shape,
          display_label,
          capacity,
          sort_order
        `)
        .eq(
          "template_id",
          template.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "floor_mapping_boh_positions"
        )
        .select(`
          id,
          position_code,
          position_name,
          default_station,
          sort_order
        `)
        .eq(
          "template_id",
          template.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "floor_mapping_sessions"
        )
        .select(`
          id,
          session_type,
          status,
          general_notes,
          pic_name_snapshot,
          submitted_at
        `)
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "business_date",
          today
        )
        .in(
          "session_type",
          [
            "MORNING",
            "AFTERNOON",
            "CLOSING",
          ]
        ),
    ]);


  if (
    zonesResult.error
  ) {
    throw zonesResult.error;
  }


  if (
    bohPositionsResult.error
  ) {
    throw bohPositionsResult.error;
  }


  if (
    sessionsResult.error
  ) {
    throw sessionsResult.error;
  }


  // ==========================================================
  // TEAM STRUCTURE — FOH STAFF DIRECTORY
  //
  // Floor Mapping does not maintain its own employee master.
  // Current outlet assignment determines:
  //
  // - staff name
  // - operational position
  // - FOH color category
  //
  // Existing submitted Floor Mapping rows remain snapshots.
  // ==========================================================

  const teamDb:
    any =
    admin;


  const {
    data:
      teamAssignmentsData,
    error:
      teamAssignmentsError,
  } =
    await teamDb
      .from(
        "team_staff_assignments"
      )
      .select(`
        id,
        staff_id,
        outlet_id,
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
        outlet.organization_id
      )
      .eq(
        "outlet_id",
        outlet.id
      )
      .eq(
        "is_primary",
        true
      )
      .lte(
        "effective_from",
        today
      )
      .or(
        `effective_to.is.null,effective_to.gte.${today}`
      );


  if (
    teamAssignmentsError
  ) {
    throw teamAssignmentsError;
  }


  const fohStaff =
    (
      teamAssignmentsData ??
      []
    )
      .filter(
        (
          row: any
        ) => {
          const staff =
            row.team_staff;

          const position =
            row.staff_positions;


          if (
            !staff ||
            !position
          ) {
            return false;
          }


          if (
            staff.is_active ===
            false
          ) {
            return false;
          }


          if (
            position.is_active ===
            false
          ) {
            return false;
          }


          return [
            "FOH",
            "BOTH",
          ].includes(
            String(
              position.area ||
              ""
            ).toUpperCase()
          );
        }
      )
      .map(
        (
          row: any
        ) => ({
          staffId:
            row.staff_id,

          fullName:
            String(
              row.team_staff
                ?.full_name ||
              ""
            ).trim(),

          positionId:
            row.position_id,

          positionName:
            String(
              row.staff_positions
                ?.name ||
              ""
            ).trim(),

          category:
            String(
              row.staff_positions
                ?.category ||
              "OTHER"
            )
              .trim()
              .toUpperCase(),

          area:
            String(
              row.staff_positions
                ?.area ||
              "FOH"
            )
              .trim()
              .toUpperCase(),
        })
      )
      .filter(
        (
          row: any
        ) =>
          Boolean(
            row.staffId &&
            row.fullName &&
            row.positionName
          )
      )
      .sort(
        (
          a: any,
          b: any
        ) => {
          const positionCompare =
            a.positionName.localeCompare(
              b.positionName
            );


          if (
            positionCompare !==
            0
          ) {
            return positionCompare;
          }


          return a.fullName.localeCompare(
            b.fullName
          );
        }
      );


  const bohStaff =
    (
      teamAssignmentsData ??
      []
    )
      .filter(
        (
          row: any
        ) => {
          const staff =
            row.team_staff;

          const position =
            row.staff_positions;


          if (
            !staff ||
            !position
          ) {
            return false;
          }


          if (
            staff.is_active ===
            false
          ) {
            return false;
          }


          if (
            position.is_active ===
            false
          ) {
            return false;
          }


          return [
            "BOH",
            "BOTH",
          ].includes(
            String(
              position.area ||
              ""
            ).toUpperCase()
          );
        }
      )
      .map(
        (
          row: any
        ) => ({
          staffId:
            row.staff_id,

          fullName:
            String(
              row.team_staff
                ?.full_name ||
              ""
            ).trim(),

          positionId:
            row.position_id,

          positionName:
            String(
              row.staff_positions
                ?.name ||
              ""
            ).trim(),

          category:
            String(
              row.staff_positions
                ?.category ||
              "OTHER"
            )
              .trim()
              .toUpperCase(),

          area:
            String(
              row.staff_positions
                ?.area ||
              "BOH"
            )
              .trim()
              .toUpperCase(),
        })
      )
      .filter(
        (
          row: any
        ) =>
          Boolean(
            row.staffId &&
            row.fullName &&
            row.positionName
          )
      )
      .sort(
        (
          a: any,
          b: any
        ) => {
          const positionCompare =
            a.positionName.localeCompare(
              b.positionName
            );


          if (
            positionCompare !==
            0
          ) {
            return positionCompare;
          }


          return a.fullName.localeCompare(
            b.fullName
          );
        }
      );


  const sessions =
    sessionsResult.data ??
    [];


  const sessionIds =
    sessions.map(
      (
        item
      ) =>
        item.id
    );


  const [
    staffPinsResult,
    bohAssignmentsResult,
  ] =
    sessionIds.length
      ? await Promise.all([
          admin
            .from(
              "floor_mapping_staff_pins"
            )
            .select(`
              id,
              session_id,
              position_label,
              role_type,
              assigned_names,
              x_pct,
              y_pct,
              notes,
              sort_order
            `)
            .in(
              "session_id",
              sessionIds
            )
            .order(
              "sort_order",
              {
                ascending:
                  true,
              }
            ),

          admin
            .from(
              "floor_mapping_boh_assignments"
            )
            .select(`
              id,
              session_id,
              position_id,
              assigned_names,
              station_note,
              sort_order
            `)
            .in(
              "session_id",
              sessionIds
            )
            .order(
              "sort_order",
              {
                ascending:
                  true,
              }
            ),
        ])
      : [
          {
            data:
              [],
            error:
              null,
          },
          {
            data:
              [],
            error:
              null,
          },
        ];


  if (
    staffPinsResult.error
  ) {
    throw staffPinsResult.error;
  }


  if (
    bohAssignmentsResult.error
  ) {
    throw bohAssignmentsResult.error;
  }


  const staffPins =
    staffPinsResult.data ??
    [];


  const bohAssignments =
    bohAssignmentsResult.data ??
    [];


  const initialSessions =
    Object.fromEntries(
      [
        "MORNING",
        "AFTERNOON",
        "CLOSING",
      ].map(
        (
          sessionType
        ) => {
          const session =
            sessions.find(
              (
                item
              ) =>
                item.session_type ===
                sessionType
            );


          return [
            sessionType,
            {
              id:
                session?.id ||
                null,

              status:
                session?.status ||
                null,

              generalNotes:
                session
                  ?.general_notes ||
                "",

              submittedAt:
                session
                  ?.submitted_at ||
                null,

              staffPins:
                session
                  ? staffPins.filter(
                      (
                        item
                      ) =>
                        item.session_id ===
                        session.id
                    )
                  : [],

              bohAssignments:
                session
                  ? bohAssignments.filter(
                      (
                        item
                      ) =>
                        item.session_id ===
                        session.id
                    )
                  : [],
            },
          ];
        }
      )
    );


  return (
    <FloorMappingClient
      outlet={{
        id:
          outlet.id,

        code:
          outlet.code,

        name:
          outlet.name,

        timezone:
          outlet.timezone ||
          "Asia/Jakarta",
      }}
      businessDate={
        today
      }
      picName={
        context.profile
          ?.full_name ||
        context.user.email ||
        "Operational User"
      }
      template={{
        id:
          template.id,

        name:
          template.name,

        versionNumber:
          template.version_number,

        imageUrl:
          signedResult
            .data
            ?.signedUrl ||
          "",
      }}
      zones={
        zonesResult.data ??
        []
      }
      bohPositions={
        bohPositionsResult.data ??
        []
      }
      fohStaff={
        fohStaff
      }
      bohStaff={
        bohStaff
      }
      initialSessions={
        initialSessions
      }
    />
  );
}


function StateCard({
  title,
  message,
}: {
  title:
    string;

  message:
    string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5">

      <div className="w-full rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Floor Mapping
        </p>

        <h1 className="mt-3 text-2xl font-black text-[#292824]">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          {message}
        </p>

      </div>

    </main>
  );
}
