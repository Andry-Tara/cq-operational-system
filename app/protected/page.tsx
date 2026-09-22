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

import {
  AutoRefresh,
} from "@/components/auto-refresh";

import ReopenReportButton from "./reports/reopen-report-button";
import SplitOutletOperationsPanel from "@/components/split-outlet-operations-panel";
import {
  OperationalHub,
  type OperationalHubActivity,
  type OperationalHubOperation,
  type OperationalHubQuickLink,
} from "@/components/dashboard/operational-hub";
import {
  CkProgress,
  OutletInsights,
} from "@/components/dashboard/operational-insights";
import { AuditorDashboard } from "@/components/audit/auditor-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  BodExecutiveDashboard,
} from "@/components/dashboard/bod-executive-dashboard";

import {
  ManagementDashboard,
} from "@/components/dashboard/management-dashboard";
import {
  loadSplitOutletOperationCards,
} from "@/lib/operations/load-split-outlet-dashboard";
import {
  loadFastCkDashboard,
} from "@/lib/operations/load-fast-ck-dashboard";


function one(value: any) {
  return Array.isArray(value)
    ? value[0]
    : value;
}


type PosVoidInsight = {
  businessDate:
    string;

  voidItems:
    number;

  voidQty:
    number;

  voidAmount:
    number;

  affectedOrders:
    number;
};


function formatPosMoney(
  value:
    number
) {
  return `Rp${new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Math.abs(
      value
    )
  )}`;
}


async function loadLatestPosVoidInsight(
  admin:
    any,

  organizationId:
    string
): Promise<
  PosVoidInsight |
  null
> {
  const {
    data:
      latestRow,
    error:
      latestError,
  } =
    await admin
      .from(
        "pos_order_items"
      )
      .select(
        "business_date"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "provider",
        "CHONGQING"
      )
      .eq(
        "is_void",
        true
      )
      .order(
        "business_date",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  if (latestError) {
    throw latestError;
  }


  const businessDate =
    String(
      latestRow
        ?.business_date ||
      ""
    );


  if (!businessDate) {
    return null;
  }


  const rows:
    any[] =
    [];

  const pageSize =
    1000;

  const maxRows =
    5000;


  for (
    let from = 0;
    from < maxRows;
    from += pageSize
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "pos_order_items"
        )
        .select(`
          external_order_id,
          qty,
          total_price
        `)
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "provider",
          "CHONGQING"
        )
        .eq(
          "is_void",
          true
        )
        .eq(
          "business_date",
          businessDate
        )
        .range(
          from,
          from +
            pageSize -
            1
        );


    if (error) {
      throw error;
    }


    const current =
      data ??
      [];


    rows.push(
      ...current
    );


    if (
      current.length <
      pageSize
    ) {
      break;
    }
  }


  return {
    businessDate,

    voidItems:
      rows.length,

    voidQty:
      rows.reduce(
        (
          total:
            number,
          row:
            any
        ) =>
          total +
          Math.abs(
            Number(
              row.qty ??
              0
            )
          ),
        0
      ),

    voidAmount:
      rows.reduce(
        (
          total:
            number,
          row:
            any
        ) =>
          total +
          Math.abs(
            Number(
              row.total_price ??
              0
            )
          ),
        0
      ),

    affectedOrders:
      new Set(
        rows.map(
          (
            row:
              any
          ) =>
            String(
              row
                .external_order_id
            )
        )
      ).size,
  };
}


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



function outletTimeLabel(
  timezone:
    string |
    null |
    undefined
) {
  const value =
    String(
      timezone ||
      "Asia/Jakarta"
    );


  if (
    value ===
    "Asia/Makassar"
  ) {
    return "WITA";
  }


  if (
    value ===
    "Asia/Jayapura"
  ) {
    return "WIT";
  }


  if (
    value ===
    "Asia/Jakarta"
  ) {
    return "WIB";
  }


  return value;
}


function shiftDate(
  date: string,
  amount: number
) {
  const value =
    new Date(
      `${date}T12:00:00Z`
    );

  value.setUTCDate(
    value.getUTCDate() +
      amount
  );

  return value
    .toISOString()
    .slice(0, 10);
}


function fullDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}


function shortDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
    }
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}


function normalizeStatus(
  status?: string | null
) {
  const value =
    String(
      status || ""
    ).toLowerCase();

  if (
    value === "completed" ||
    value === "submitted"
  ) {
    return "completed";
  }

  if (
    value === "draft" ||
    value ===
      "in_progress" ||
    value === "reopened"
  ) {
    return "in_progress";
  }

  return "not_submitted";
}


export default async function ProtectedPage({
  searchParams,
}: {
  searchParams?:
    Promise<{
      period?: string;
    }>;
}) {
  const params =
    searchParams
      ? await searchParams
      : {};

  const period =
    params?.period === "30"
      ? 30
      : 7;

  const activeOutletPromise =
    getActiveOutlet();

  const [
    supabase,
    accessContext,
  ] = await Promise.all([
    createClient(),
    requirePermission(
      "dashboard.view"
    ),
  ]);

  const {
    user,
    profile,
    roles,
    isAdmin,
    permissionCodes,
  } = accessContext;

  const canClosing =
    isAdmin ||
    permissionCodes.includes(
      "closing.submit"
    );


  const canOpening =
    isAdmin ||
    permissionCodes.includes(
      "opening.submit"
    );

  const canTeamStructure =
    isAdmin ||
    permissionCodes.includes(
      "team_structure.manage"
    );


  const canReports =
    isAdmin ||
    permissionCodes.includes(
      "reports.view"
    );

  const canReopenReport =
    isAdmin ||
    permissionCodes.includes(
      "reports.reopen"
    );


  const canAuditInput =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit"
    );

  const canAuditManagement =
    isAdmin ||
    permissionCodes.includes(
      "audit.view_management"
    );


  const allOutletAccess =
    isAdmin ||
    permissionCodes.includes(
      "reports.all_outlets"
    );


  // ==========================================================
  // OUTLET SCOPE
  // ==========================================================

  let outlets: any[] = [];

  if (allOutletAccess) {
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
        .order(
          "name"
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
      data ?? [];

  } else {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "user_outlets"
        )
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
      (
        data ?? []
      )
        .map(
          (row: any) =>
            one(
              row.outlets
            )
        )
        .filter(
          (
            outlet: any
          ) =>
            outlet &&
            outlet.is_active !==
              false
        );
  }


  // ==========================================================
  // ACTIVE OUTLET
  // ==========================================================

  const activeOutlet =
    await activeOutletPromise;

  if (!activeOutlet) {
    redirect(
      "/protected/select-outlet"
    );
  }

  if (
    !outlets.length &&
    activeOutlet
  ) {
    outlets = [
      activeOutlet,
    ];
  }


  const timezone =
    outlets.length === 1
      ? outlets[0]
          ?.timezone ||
        "Asia/Jakarta"
      : "Asia/Jakarta";

  const today =
    businessDate(
      timezone
    );

  const firstDate =
    shiftDate(
      today,
      -(period - 1)
    );


  // ==========================================================
  // BOD EXECUTIVE DASHBOARD
  //
  // BOD is intentionally separated from the operational
  // Super User dashboard.
  //
  // BOD:
  //   - organization-wide read only
  //   - Reports Center
  //   - Management Audit
  //   - no operational submit controls
  //
  // ORG_ADMIN / Super User continues below into the existing
  // operational dashboard without behavioral changes.
  // ==========================================================

  const isBodExperience =
    !isAdmin &&
    roles.some(
      (role: any) =>
        String(
          role?.code ?? ""
        )
          .trim()
          .toUpperCase() ===
        "BOD"
    );

  if (isBodExperience) {
    const executiveAdmin =
      createAdminClient();

    const currentMonthStart =
      `${today.slice(0, 7)}-01`;

    const nextMonthStart =
      (() => {
        const [
          year,
          month,
        ] =
          currentMonthStart
            .slice(0, 7)
            .split("-")
            .map(Number);

        return new Date(
          Date.UTC(
            year,
            month,
            1
          )
        )
          .toISOString()
          .slice(0, 10);
      })();

    const [
      reportsResult,
      monthlyScoresResult,
      auditSessionsResult,
    ] =
      await Promise.all([
        executiveAdmin
          .from("reports")
          .select(`
            id,
            status,
            outlet_id
          `)
          .eq(
            "organization_id",
            profile.organization_id
          )
          .eq(
            "business_date",
            today
          ),

        executiveAdmin
          .from(
            "outlet_monthly_scores"
          )
          .select(`
            outlet_id,
            current_score
          `)
          .eq(
            "organization_id",
            profile.organization_id
          )
          .eq(
            "month_start",
            currentMonthStart
          ),

        executiveAdmin
          .from(
            "audit_sessions"
          )
          .select("id")
          .eq(
            "organization_id",
            profile.organization_id
          )
          .eq(
            "status",
            "submitted"
          )
          .gte(
            "audit_date",
            currentMonthStart
          )
          .lt(
            "audit_date",
            nextMonthStart
          ),
      ]);

    if (
      reportsResult.error
    ) {
      throw reportsResult.error;
    }

    if (
      monthlyScoresResult.error
    ) {
      throw monthlyScoresResult.error;
    }

    if (
      auditSessionsResult.error
    ) {
      throw auditSessionsResult.error;
    }

    const todayReports =
      reportsResult.data ??
      [];

    const completedReports =
      todayReports.filter(
        (report: any) =>
          [
            "completed",
            "submitted",
          ].includes(
            String(
              report.status ??
                ""
            )
              .trim()
              .toLowerCase()
          )
      ).length;

    const inProgressReports =
      todayReports.filter(
        (report: any) =>
          [
            "draft",
            "in_progress",
            "reopened",
          ].includes(
            String(
              report.status ??
                ""
            )
              .trim()
              .toLowerCase()
          )
      ).length;

    const scoreRows =
      monthlyScoresResult
        .data ??
      [];

    const validScores =
      scoreRows
        .map(
          (row: any) =>
            Number(
              row.current_score
            )
        )
        .filter(
          (value: number) =>
            Number.isFinite(
              value
            )
        );

    const auditAverage =
      validScores.length
        ? validScores.reduce(
            (
              total: number,
              score: number
            ) =>
              total + score,
            0
          ) /
          validScores.length
        : null;

    const auditSessionIds =
      (
        auditSessionsResult
          .data ?? []
      ).map(
        (session: any) =>
          session.id
      );

    let criticalFindings =
      0;

    if (
      auditSessionIds.length
    ) {
      const {
        count,
        error,
      } =
        await executiveAdmin
          .from(
            "audit_findings"
          )
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .in(
            "audit_session_id",
            auditSessionIds
          )
          .eq(
            "risk_level",
            "critical"
          );

      if (error) {
        throw error;
      }

      criticalFindings =
        count ?? 0;
    }

    const bodPosInsight =
      permissionCodes.includes(
        "pos.view"
      )
        ? await loadLatestPosVoidInsight(
            executiveAdmin,
            profile.organization_id
          )
        : null;


    return (
      <>
        <BodExecutiveDashboard
          executiveName={
            profile.full_name ||
            user.email ||
            "BOD"
          }
          dateLabel={
            fullDate(today)
          }
          outletCount={
            outlets.length
          }
          completedReports={
            completedReports
          }
          inProgressReports={
            inProgressReports
          }
          auditAverage={
            auditAverage
          }
          scoredOutlets={
            validScores.length
          }
          criticalFindings={
            criticalFindings
          }
        />


        {bodPosInsight && (
          <div className="bg-[#F5F5F3] px-4 pb-8 sm:px-5 md:px-8">

            <div className="mx-auto max-w-[1480px]">

              <Link
                href="/protected/pos/void-sales"
                className="group grid gap-5 overflow-hidden rounded-[26px] border border-red-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(50,45,38,0.08)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >

                <div>

                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-700">
                    POS Insights
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#292824]">
                    Void Sales
                  </h2>

                  <p className="mt-2 text-sm font-medium text-neutral-500">
                    {bodPosInsight.voidItems} items
                    {" · "}
                    {bodPosInsight.affectedOrders} affected orders
                    {" · "}
                    {formatPosMoney(
                      bodPosInsight.voidAmount
                    )}
                  </p>

                  <p className="mt-2 text-[10px] font-bold text-neutral-400">
                    Mapped POS Outlets · Jakarta API
                    {" · "}
                    {shortDate(
                      bodPosInsight.businessDate
                    )}
                  </p>

                </div>


                <div className="flex h-11 items-center justify-center rounded-xl bg-[#292824] px-5 text-xs font-black text-white">
                  Review Void Sales →
                </div>

              </Link>

            </div>

          </div>
        )}
      </>
    );
  }

  // ==========================================================
  // OUTLET AUDITOR ACTION DASHBOARD
  // ==========================================================
  //
  // Keep the existing operational dashboard untouched for
  // Opening / Closing / CK / Management roles.
  //
  // An Outlet Auditor gets a task-oriented dashboard instead.
  // ==========================================================

  const isOutletAuditorExperience =
    !isAdmin &&
    permissionCodes.includes("audit.submit") &&
    !canOpening &&
    !canClosing &&
    !canReports;

  if (isOutletAuditorExperience) {
    const auditAdmin =
      createAdminClient();

    const outletIds =
      outlets.map(
        (outlet: any) =>
          outlet.id
      );

    const sinceDate =
      shiftDate(
        today,
        -30
      );

    let auditSessions: any[] = [];

    if (outletIds.length) {
      const {
        data,
        error,
      } =
        await auditAdmin
          .from("audit_sessions")
          .select(`
            id,
            audit_number,
            audit_date,
            status,
            outlet_id,
            started_at,
            submitted_at,
            score,
            scoring_snapshot
          `)
          .eq(
            "organization_id",
            profile.organization_id
          )
          .eq(
            "auditor_user_id",
            user.id
          )
          .in(
            "outlet_id",
            outletIds
          )
          .gte(
            "audit_date",
            sinceDate
          )
          .order(
            "started_at",
            {
              ascending: false,
            }
          )
          .limit(200);

      if (error) {
        throw error;
      }

      auditSessions =
        data ?? [];
    }

    const currentMonthStart =
      `${today.slice(0, 7)}-01`;

    let monthlyScoreRows: any[] = [];

    if (outletIds.length) {
      const {
        data,
        error,
      } =
        await auditAdmin
          .from(
            "outlet_monthly_scores"
          )
          .select(`
            outlet_id,
            base_score,
            total_penalty,
            current_score,
            submitted_audit_count
          `)
          .eq(
            "organization_id",
            profile.organization_id
          )
          .eq(
            "month_start",
            currentMonthStart
          )
          .in(
            "outlet_id",
            outletIds
          );

      if (error) {
        throw error;
      }

      monthlyScoreRows =
        data ?? [];
    }

    const monthlyScoreByOutlet =
      new Map(
        monthlyScoreRows.map(
          (row: any) => [
            row.outlet_id,
            row,
          ]
        )
      );

    const auditSessionIds =
      auditSessions.map(
        (session: any) =>
          session.id
      );

    const findingCountBySession =
      new Map<string, number>();

    if (auditSessionIds.length) {
      const {
        data,
        error,
      } =
        await auditAdmin
          .from(
            "audit_findings"
          )
          .select(
            "audit_session_id"
          )
          .in(
            "audit_session_id",
            auditSessionIds
          );

      if (error) {
        throw error;
      }

      for (
        const finding
        of data ?? []
      ) {
        if (
          !finding
            .audit_session_id
        ) {
          continue;
        }

        findingCountBySession.set(
          finding
            .audit_session_id,
          (
            findingCountBySession
              .get(
                finding
                  .audit_session_id
              ) ?? 0
          ) + 1
        );
      }
    }

    const sessionsByOutlet =
      new Map<
        string,
        any[]
      >();

    for (
      const session
      of auditSessions
    ) {
      const rows =
        sessionsByOutlet.get(
          session.outlet_id
        ) ?? [];

      rows.push(session);

      sessionsByOutlet.set(
        session.outlet_id,
        rows
      );
    }

    const auditorOutletCards =
      outlets.map(
        (outlet: any) => {
          const outletSessions =
            (
              sessionsByOutlet.get(
                outlet.id
              ) ?? []
            ).filter(
              (session: any) =>
                session.audit_date ===
                today
            );

          const draft =
            outletSessions.find(
              (session: any) =>
                session.status ===
                "draft"
            ) ?? null;

          const submittedSessions =
            outletSessions.filter(
              (session: any) =>
                session.status ===
                "submitted"
            );

          const latestSubmitted =
            submittedSessions[0] ??
            null;

          const current =
            draft ??
            latestSubmitted ??
            null;

          const draftFindingCount =
            draft
              ? findingCountBySession.get(
                  draft.id
                ) ?? 0
              : 0;

          const submittedFindingsToday =
            submittedSessions.reduce(
              (
                total: number,
                session: any
              ) =>
                total +
                (
                  findingCountBySession.get(
                    session.id
                  ) ?? 0
                ),
              0
            );

          const todayFindingCount =
            outletSessions.reduce(
              (
                total: number,
                session: any
              ) =>
                total +
                (
                  findingCountBySession.get(
                    session.id
                  ) ?? 0
                ),
              0
            );

          const todayPenalty =
            submittedSessions.reduce(
              (
                total: number,
                session: any
              ) => {
                const snapshot =
                  session.scoring_snapshot &&
                  typeof session.scoring_snapshot ===
                    "object"
                    ? session.scoring_snapshot
                    : {};

                return (
                  total +
                  Number(
                    snapshot.audit_penalty ??
                    0
                  )
                );
              },
              0
            );

          const monthly =
            monthlyScoreByOutlet.get(
              outlet.id
            );

          return {
            id: outlet.id,
            code: outlet.code,
            name: outlet.name,

            status: draft
              ? "draft"
              : latestSubmitted
                ? "submitted"
                : "not_started",

            sessionId:
              current?.id ??
              null,

            latestSubmittedSessionId:
              latestSubmitted?.id ??
              null,

            auditNumber:
              current
                ?.audit_number ??
              null,

            findingCount:
              current
                ? findingCountBySession
                    .get(
                      current.id
                    ) ?? 0
                : 0,

            draftFindingCount,

            todayFindingCount,

            submittedToday:
              submittedSessions.length,

            submittedFindingsToday,

            todayPenalty,

            monthlyScore:
              Number(
                monthly?.current_score ??
                100
              ),

            startedAt:
              current
                ?.started_at ??
              null,

            submittedAt:
              latestSubmitted
                ?.submitted_at ??
              null,
          } as const;
        }
      );


    const outletById =
      new Map(
        outlets.map(
          (outlet: any) => [
            outlet.id,
            outlet,
          ]
        )
      );

    const recentAudits =
      auditSessions
        .filter(
          (session: any) =>
            session.status ===
            "submitted"
        )
        .slice(
          0,
          6
        )
        .map(
          (session: any) => {
            const outlet =
              outletById.get(
                session.outlet_id
              );

            return {
              sessionId:
                session.id,
              auditNumber:
                session
                  .audit_number,
              outletId:
                session
                  .outlet_id,
              outletCode:
                outlet?.code ??
                "",
              outletName:
                outlet?.name ??
                "Outlet",
              findingCount:
                findingCountBySession
                  .get(
                    session.id
                  ) ?? 0,
              submittedAt:
                session
                  .submitted_at ??
                null,
            };
          }
        );

    return (
      <AuditorDashboard
        auditorName={
          profile.full_name ||
          user.email ||
          "Auditor"
        }
        dateLabel={
          fullDate(today)
        }
        outlets={
          auditorOutletCards
        }
        recentAudits={
          recentAudits
        }
      />
    );
  }

  // ==========================================================
  // FAST SPLIT OPERATIONAL DASHBOARD
  //
  // PERFORMANCE:
  // FOH / BOH / Outlet Manager stop here before legacy
  // Opening / Closing analytics, trend, CK KPI and other
  // dashboard queries are executed.
  //
  // CK users intentionally continue through the existing
  // scoped CK logic below.
  // ==========================================================

  const fastDashboardRoleCodes =
    new Set(
      roles.map(
        (role: any) =>
          String(
            role?.code ||
            ""
          )
            .trim()
            .toUpperCase()
      )
    );


  const fastIsOutletManager =
    fastDashboardRoleCodes.has(
      "STORE_MANAGER"
    );

  const fastIsFoh =
    fastDashboardRoleCodes.has(
      "FOH_STAFF"
    );

  const fastIsBoh =
    fastDashboardRoleCodes.has(
      "KITCHEN_STAFF"
    );


  const useFastSplitDashboard =
    !isAdmin &&
    activeOutlet?.id &&
    activeOutlet.code !== "CNT" &&
    (
      fastIsOutletManager ||
      fastIsFoh ||
      fastIsBoh
    );


  if (
    useFastSplitDashboard
  ) {
const fastSplitOperations =
      await loadSplitOutletOperationCards({
        supabase,
        organizationId:
          profile.organization_id,
        outletId:
          activeOutlet.id,
        outletTimezone:
          activeOutlet.timezone ||
          "Asia/Jakarta",
        userId:
          user.id,
        isAdmin,
      });



    // ======================================================
    // FLOOR MAPPING DAILY PROGRESS
    // ======================================================

    const fastFloorMappingAdmin =
      createAdminClient();


    const {
      count:
        fastFloorMappingCountRaw,
      error:
        fastFloorMappingError,
    } =
      await fastFloorMappingAdmin
        .from(
          "floor_mapping_sessions"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "business_date",
          today
        )
        .eq(
          "status",
          "SUBMITTED"
        );



    if (
      fastFloorMappingError
    ) {
      console.error(
        "Floor Mapping dashboard count error:",
        fastFloorMappingError
      );
    }


    const fastFloorMappingCount =
      Math.max(
        0,
        Math.min(
          3,
          fastFloorMappingCountRaw ??
            0
        )
      );


    const fastHubOperations:
      OperationalHubOperation[] =
      fastSplitOperations.map(
        (card) => ({
          key:
            card.formCode,
          eyebrow:
            card.area,
          title:
            card.title,
          description:
            card.description,
          status:
            card.status,
          href:
            card.href,
          action:
            card.status ===
            "COMPLETED"
              ? "View Report"
              : card.status ===
                  "IN PROGRESS"
                ? "Resume"
                : "Start",
          disabled:
            card.status !==
              "COMPLETED" &&
            !card.canFill,
        })
      );


    fastHubOperations.push({
      key:
        "floor-mapping-operation",

      eyebrow:
        "Team Deployment",

      title:
        "Floor Mapping",

      description:
        `FOH map · BOH stations · ${fastFloorMappingCount}/3 sessions`,

      status:
        fastFloorMappingCount >=
        3
          ? "COMPLETED"
          : fastFloorMappingCount >
              0
            ? "IN PROGRESS"
            : "READY",

      href:
        fastFloorMappingCount >=
        3
          ? "/protected/floor-mapping/report"
          : "/protected/floor-mapping",

      action:
        fastFloorMappingCount >=
        3
          ? "View Report"
          : fastFloorMappingCount >
              0
            ? "Continue"
            : "Start",
    });


    // Recent Activity does not need another reports query.
    // The loader already resolved today's exact report for
    // every form visible to this user.

    const fastTestFoodAdmin =
      createAdminClient();


    const {
      data:
        fastTestFoodSessions,
    } =
      await fastTestFoodAdmin
        .from(
          "test_food_sessions"
        )
        .select(`
          id,
          shift,
          result_status
        `)
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "business_date",
          today
        )
        .eq(
          "status",
          "SUBMITTED"
        );



    const fastTestFoodShiftCount =
      new Set(
        (
          fastTestFoodSessions ??
          []
        ).map(
          (
            row: any
          ) =>
            row.shift
        )
      ).size;


    const fastTestFoodSessionIds =
      (
        fastTestFoodSessions ??
        []
      )
        .map(
          (
            row: any
          ) =>
            row.id
        )
        .filter(
          Boolean
        );


    let fastTestFoodUnresolvedCount =
      0;


    if (
      fastTestFoodSessionIds.length
    ) {
      const {
        data:
          fastIssueChecks,
        error:
          fastIssueChecksError,
      } =
        await fastTestFoodAdmin
          .from(
            "test_food_checks"
          )
          .select(`
            id
          `)
          .in(
            "session_id",
            fastTestFoodSessionIds
          )
          .eq(
            "result_status",
            "NEEDS_CORRECTION"
          );


      if (
        fastIssueChecksError
      ) {
        fastTestFoodUnresolvedCount =
          (
            fastTestFoodSessions ??
            []
          ).some(
            (
              row: any
            ) =>
              row.result_status ===
              "NEEDS_CORRECTION"
          )
            ? 1
            : 0;

      } else {
        const issueCheckIds =
          (
            fastIssueChecks ??
            []
          )
            .map(
              (
                row: any
              ) =>
                row.id
            )
            .filter(
              Boolean
            );


        if (
          issueCheckIds.length
        ) {
          const {
            data:
              fastRetests,
          } =
            await fastTestFoodAdmin
              .from(
                "test_food_retests"
              )
              .select(`
                check_id,
                attempt_no,
                result_status
              `)
              .in(
                "check_id",
                issueCheckIds
              )
              .order(
                "attempt_no",
                {
                  ascending:
                    true,
                }
              );


          const latestByCheck =
            new Map<
              string,
              any
            >();


          for (
            const retest of
            fastRetests ??
            []
          ) {
            const current =
              latestByCheck.get(
                retest.check_id
              );

            if (
              !current ||
              Number(
                retest.attempt_no
              ) >
              Number(
                current.attempt_no
              )
            ) {
              latestByCheck.set(
                retest.check_id,
                retest
              );
            }
          }


          fastTestFoodUnresolvedCount =
            issueCheckIds.filter(
              (
                checkId
              ) =>
                latestByCheck.get(
                  checkId
                )?.result_status !==
                "PASS"
            ).length;
        }
      }
    }



    const fastTestFoodStatus =
      fastTestFoodShiftCount >=
      2
        ? fastTestFoodUnresolvedCount >
            0
          ? "NEEDS CORRECTION"
          : "COMPLETED"
        : fastTestFoodShiftCount >
            0
          ? "IN PROGRESS"
          : "READY";


    fastHubOperations.push({
      key:
        "test-food-operation",
      eyebrow:
        "Food Quality",
      title:
        "Test Food",
      description:
        `Morning & afternoon quality check · ${fastTestFoodShiftCount}/2 shifts${
          fastTestFoodUnresolvedCount >
          0
            ? ` · ${fastTestFoodUnresolvedCount} ${
                fastTestFoodUnresolvedCount ===
                1
                  ? "item"
                  : "items"
              } needs correction`
            : ""
        }`,
      status:
        fastTestFoodStatus,
      href:
        fastTestFoodShiftCount >=
        2
          ? "/protected/test-food/report"
          : "/protected/test-food",
      action:
        fastTestFoodShiftCount >=
        2
          ? fastTestFoodUnresolvedCount >
              0
            ? "Follow Up"
            : "View Report"
          : fastTestFoodShiftCount >
              0
            ? "Continue"
            : "Start",
      disabled:
        false,
    });



    const {
      data:
        fastBriefingSessions,
      error:
        fastBriefingError,
    } =
      await fastTestFoodAdmin
        .from(
          "briefing_sessions"
        )
        .select(`
          id,
          session_type,
          status
        `)
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "business_date",
          today
        )
        .eq(
          "status",
          "SUBMITTED"
        );



    const fastBriefingCount =
      fastBriefingError
        ? 0
        : new Set(
            (
              fastBriefingSessions ??
              []
            ).map(
              (
                row: any
              ) =>
                row.session_type
            )
          ).size;


    const fastBriefingStatus =
      fastBriefingCount >=
      3
        ? "COMPLETED"
        : fastBriefingCount >
            0
          ? "IN PROGRESS"
          : "READY";


    fastHubOperations.push({
      key:
        "briefing-operation",

      eyebrow:
        "Team Alignment",

      title:
        "Briefing",

      description:
        `Morning · Afternoon · Closing · ${fastBriefingCount}/3 sessions`,

      status:
        fastBriefingStatus,

      href:
        fastBriefingCount >=
        3
          ? "/protected/briefing/report"
          : "/protected/briefing",

      action:
        fastBriefingCount >=
        3
          ? "View Report"
          : fastBriefingCount >
              0
            ? "Continue"
            : "Start",

      disabled:
        false,
    });


    // ========================================================
    // RECENT ACTIVITY
    //
    // Today's Operations uses today's outlet business date.
    // Recent Activity intentionally spans previous business
    // dates so it does not disappear at midnight.
    // ========================================================

    const fastActivityAdmin:
      any =
      createAdminClient();


    const {
      data:
        fastRecentReportRows,
      error:
        fastRecentReportsError,
    } =
      await fastActivityAdmin
        .from(
          "reports"
        )
        .select(`
          id,
          report_number,
          business_date,
          status,
          created_at,
          completed_at
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .order(
          "completed_at",
          {
            ascending:
              false,
            nullsFirst:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          4
        );



    if (
      fastRecentReportsError
    ) {
      console.error(
        "Dashboard recent activity error:",
        fastRecentReportsError
      );
    }


    const fastHubActivities:
      OperationalHubActivity[] =
      (
        fastRecentReportRows ??
        []
      ).map(
        (
          report: any
        ) => {
          const normalizedStatus =
            String(
              report.status ||
              ""
            )
              .trim()
              .toLowerCase();


          const isCompleted =
            [
              "completed",
              "submitted",
              "reviewed",
              "verified",
              "closed",
            ].includes(
              normalizedStatus
            );


          return {
            key:
              report.id,

            title:
              report.report_number ||
              "Operational Report",

            meta:
              `Operational Report · ${report.business_date}`,

            status:
              report.status ||
              "in_progress",

            href:
              isCompleted
                ? `/api/reports/${report.id}/pdf`
                : "/protected/reports",
          };
        }
      );


    const fastQuickLinks:
      OperationalHubQuickLink[] =
      [];


    fastQuickLinks.push({
      key:
        "test-food",
      label:
        "Test Food",
      description:
        "Morning & afternoon food quality check",
      href:
        "/protected/test-food",
    });


    if (
      canReports
    ) {
      fastQuickLinks.push({
        key:
          "reports",
        label:
          "Reports Center",
        description:
          "Operational report history",
        href:
          "/protected/reports",
      });
    }


    fastQuickLinks.push({
      key:
        "change-outlet",
      label:
        "Change Outlet",
      description:
        "Switch active operating outlet",
      href:
        "/protected/select-outlet",
    });


    // Only Outlet Manager needs the issue KPI.
    // Staff do not pay for this query.
    let fastIssueCount =
      0;


    if (
      fastIsOutletManager
    ) {
      const fastReportIds =
        fastSplitOperations
          .map(
            (card) =>
              card.reportId
          )
          .filter(
            (
              id
            ): id is string =>
              Boolean(
                id
              )
          );


      if (
        fastReportIds.length
      ) {
        const {
          data:
            fastIssueRows,
        } =
          await supabase
            .from("issues")
            .select(`
              id,
              report_id
            `)
            .in(
              "report_id",
              fastReportIds
            );


        fastIssueCount =
          fastIssueRows?.length ??
          0;
      }
    }



    const fastAssigned =
      fastHubOperations.length;

    const fastCompleted =
      fastHubOperations.filter(
        (operation) =>
          operation.status ===
          "COMPLETED"
      ).length;

    const fastActive =
      fastHubOperations.filter(
        (operation) =>
          operation.status ===
          "IN PROGRESS"
      ).length;

    const fastRemaining =
      Math.max(
        0,
        fastAssigned -
        fastCompleted
      );


    return (
      <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
        <AutoRefresh
          intervalMs={
            60000
          }
        />

        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">
          <header>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Operational Overview
            </p>

            <h1 className="mt-1.5 text-[28px] font-black tracking-tight md:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {
                fullDate(
                  today
                )
              }
            </p>
          </header>


          <OperationalHub
            outletName={
              activeOutlet.name
            }
            dateLabel={
              `${fullDate(
                today
              )} · ${outletTimeLabel(
                activeOutlet.timezone
              )}`
            }
            operations={
              fastHubOperations
            }
            activities={
              fastHubActivities
            }
            quickLinks={
              fastQuickLinks
            }
          />


          {fastIsOutletManager && (
            <OutletInsights
              outletName={
                activeOutlet.name
              }
              assigned={
                fastAssigned
              }
              completed={
                fastCompleted
              }
              active={
                fastActive
              }
              remaining={
                fastRemaining
              }
              issues={
                fastIssueCount
              }
            />
          )}
        </div>
      </main>
    );
  }


  // ==========================================================
  // FAST CK OPERATIONAL DASHBOARD
  //
  // CK Staff / CK Leader stop before legacy outlet analytics.
  // ==========================================================

  const fastCkRoleCodes =
    new Set(
      roles.map(
        (role: any) =>
          String(
            role?.code ||
            ""
          )
            .trim()
            .toUpperCase()
      )
    );


  const fastIsCkLeader =
    fastCkRoleCodes.has(
      "CK_MANAGER"
    );

  const fastIsCkStaff =
    fastCkRoleCodes.has(
      "CK_STAFF"
    );


  const fastCkOutletId =
    activeOutlet?.id ||
    "";


  const useFastCkDashboard =
    !isAdmin &&
    Boolean(
      fastCkOutletId
    ) &&
    activeOutlet?.code ===
      "CNT" &&
    (
      fastIsCkLeader ||
      fastIsCkStaff
    );


  if (
    useFastCkDashboard
  ) {
    let fastCkData:
      Awaited<
        ReturnType<
          typeof loadFastCkDashboard
        >
      >;


    try {
      fastCkData =
        await loadFastCkDashboard({
          supabase,

          organizationId:
            profile.organization_id,

          outletId:
            fastCkOutletId,

          userId:
            user.id,

          businessDate:
            today,
        });
    } catch (
      error
    ) {
      return (
        <ErrorState
          message={
            error instanceof
            Error
              ? error.message
              : "Unable to load Central Kitchen dashboard."
          }
        />
      );
    }


    const fastCkStatus =
      fastCkData.assignedCount >
        0 &&
      fastCkData.completedCount >=
        fastCkData.assignedCount
        ? "COMPLETED"
        : fastCkData.completedCount >
              0 ||
            fastCkData.inProgressCount >
              0
          ? "IN PROGRESS"
          : "READY";


    const fastCkOperations:
      OperationalHubOperation[] =
      fastCkData.assignedCount >
      0
        ? [
            {
              key:
                "central-kitchen",

              eyebrow:
                "Central Kitchen",

              title:
                "Opening CK / Closing CK",

              description:
                "Continue sections assigned to you and follow area finalization progress.",

              status:
                fastCkStatus,

              href:
                "/protected/central-kitchen",

              action:
                fastCkStatus ===
                "IN PROGRESS"
                  ? "Continue Central Kitchen"
                  : "Open Central Kitchen",
            },
          ]
        : [];


    const fastCkActivities:
      OperationalHubActivity[] =
      fastCkData.reports.map(
        report => ({
          key:
            report.id,

          title:
            report.reportNumber,

          meta:
            `${report.formCode} · ${today}`,

          status:
            report.status,

          href:
            "/protected/central-kitchen",
        })
      );


    const fastCkQuickLinks:
      OperationalHubQuickLink[] =
      [];


    if (
      canReports
    ) {
      fastCkQuickLinks.push({
        key:
          "reports",

        label:
          "Reports Center",

        description:
          "Operational report history",

        href:
          "/protected/reports",
      });
    }


    fastCkQuickLinks.push({
      key:
        "change-outlet",

      label:
        "Change Outlet",

      description:
        "Switch active operating outlet",

      href:
        "/protected/select-outlet",
    });


    return (
      <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
        <AutoRefresh
          intervalMs={
            60000
          }
        />

        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">
          <header>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Operational Overview
            </p>

            <h1 className="mt-1.5 text-[28px] font-black tracking-tight md:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {
                fullDate(
                  today
                )
              }
            </p>
          </header>


          <OperationalHub
            outletName={
              activeOutlet?.name ||
              "CQ Central"
            }

            dateLabel={
              fullDate(
                today
              )
            }

            operations={
              fastCkOperations
            }

            activities={
              fastCkActivities
            }

            quickLinks={
              fastCkQuickLinks
            }
          />


          {fastIsCkLeader && (
            <CkProgress
              outletName={
                activeOutlet?.name ||
                "CQ Central"
              }

              assigned={
                fastCkData.assignedCount
              }

              completed={
                fastCkData.completedCount
              }

              active={
                fastCkData.inProgressCount
              }

              pending={
                fastCkData.notSubmittedCount
              }

              issues={
                fastCkData.issueCount
              }
            />
          )}
        </div>
      </main>
    );
  }



  const splitOutletOperationsPromise =
    activeOutlet?.id &&
    activeOutlet.code !== "CNT"
      ? loadSplitOutletOperationCards({
          supabase,
          organizationId:
            profile.organization_id,
          outletId:
            activeOutlet.id,
          outletTimezone:
            activeOutlet.timezone ||
            "Asia/Jakarta",
          userId:
            user.id,
          isAdmin,
        })
      : Promise.resolve([]);

  const openingFormPromise =
    supabase
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
        "code",
        "OPENING"
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

  const closingFormPromise =
    supabase
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
        "code",
        "CLOSING"
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

  const splitDashboardFormCodes = [
    "OPENING_FOH",
    "OPENING_BOH",
    "CLOSING_FOH",
    "CLOSING_BOH",
  ];

  const splitDashboardFormsPromise =
    supabase
      .from("forms")
      .select(`
        id,
        code
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .in(
        "code",
        splitDashboardFormCodes
      );

  // ==========================================================
  // CLOSING FORM
  // ==========================================================
  // OPENING - ACTIVE OUTLET
  //
  // Kept separate from Closing dashboard analytics.
  // This prevents existing Closing trend / outlet status logic
  // from changing while Opening is introduced.
  // ==========================================================

  const {
    data:
      openingForm,
  } =
    await openingFormPromise;


  let openingAssignment:
    any = null;

  if (
    openingForm?.id &&
    activeOutlet?.id
  ) {
    const {
      data,
    } =
      await supabase
        .from(
          "outlet_form_assignments"
        )
        .select(`
          id,
          form_version_id,
          effective_from,
          effective_until,
          is_active
        `)
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "form_id",
          openingForm.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "effective_from",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    openingAssignment =
      data;
  }


  const openingBusinessDate =
    activeOutlet
      ? businessDate(
          activeOutlet.timezone ||
            "Asia/Jakarta"
        )
      : today;


  let openingReport:
    any = null;

  if (
    openingForm?.id &&
    activeOutlet?.id
  ) {
    const {
      data,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          report_number,
          status,
          business_date,
          created_at,
          completed_at,
          pdf_storage_path
        `)
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "form_id",
          openingForm.id
        )
        .eq(
          "business_date",
          openingBusinessDate
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    openingReport =
      data;
  }


  const openingRawStatus =
    String(
      openingReport?.status ||
        ""
    )
      .trim()
      .toLowerCase();


  const openingIsCompleted =
    [
      "completed",
      "submitted",
    ].includes(
      openingRawStatus
    );


  const openingIsInProgress =
    [
      "draft",
      "in_progress",
      "reopened",
    ].includes(
      openingRawStatus
    );


  const openingAvailable =
    Boolean(
      openingForm?.id &&
        openingAssignment?.id
    );


  const openingStatus =
    !openingAvailable
      ? "UNAVAILABLE"
      : openingIsCompleted
        ? "COMPLETED"
        : openingIsInProgress
          ? "IN PROGRESS"
          : "NOT STARTED";


  const openingHref =
    openingIsCompleted
      ? openingReport
          ?.pdf_storage_path
        ? `/api/reports/${openingReport.id}/pdf`
        : "/protected/reports"
      : "/protected/operations/OPENING/KITCHEN";


  const openingCTA =
    openingIsCompleted
      ? "View Report"
      : openingIsInProgress
        ? "Resume Opening"
        : "Start Opening";


  // ==========================================================

  const splitOutletOperations =
    await splitOutletOperationsPromise;


  const {
    data:
      closingForm,
  } =
    await closingFormPromise;


  // ==========================================================
  // REPORTS FOR DASHBOARD PERIOD
  // ==========================================================

  const outletIds =
    outlets.map(
      (
        outlet: any
      ) =>
        outlet.id
    );

  let reports: any[] =
    [];

  if (
    outletIds.length &&
    closingForm?.id
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          outlet_id,
          report_number,
          status,
          business_date,
          created_at,
          completed_at,
          pdf_storage_path
        `)
        .eq(
          "form_id",
          closingForm.id
        )
        .in(
          "outlet_id",
          outletIds
        )
        .gte(
          "business_date",
          firstDate
        )
        .lte(
          "business_date",
          today
        )
        .order(
          "business_date",
          {
            ascending:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
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

    reports =
      data ?? [];
  }


  // ==========================================================
  // SPLIT OUTLET REPORTS FOR DASHBOARD PERIOD
  //
  // The legacy reports[] array above remains the fallback for
  // outlets that still use legacy OPENING / CLOSING.
  //
  // Once an outlet has retired both legacy assignments, its
  // KPI + trend are derived from the split forms assigned for
  // each business date.
  // ==========================================================

  const {
    data: splitDashboardFormsData,
    error: splitDashboardFormsError,
  } =
    await splitDashboardFormsPromise;

  if (splitDashboardFormsError) {
    return (
      <ErrorState
        message={
          splitDashboardFormsError.message
        }
      />
    );
  }

  const splitDashboardForms =
    splitDashboardFormsData ?? [];

  const splitDashboardFormIds =
    splitDashboardForms.map(
      (form: any) =>
        form.id
    );

  let splitDashboardAssignments:
    any[] = [];

  if (
    outletIds.length &&
    splitDashboardFormIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "outlet_form_assignments"
        )
        .select(`
          outlet_id,
          form_id,
          form_version_id,
          effective_from,
          effective_until,
          is_active
        `)
        .in(
          "outlet_id",
          outletIds
        )
        .in(
          "form_id",
          splitDashboardFormIds
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

    splitDashboardAssignments =
      data ?? [];
  }

  let splitDashboardReports:
    any[] = [];

  if (
    outletIds.length &&
    splitDashboardFormIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("reports")
        .select(`
          id,
          outlet_id,
          form_id,
          report_number,
          status,
          business_date,
          created_at,
          completed_at,
          pdf_storage_path
        `)
        .in(
          "form_id",
          splitDashboardFormIds
        )
        .in(
          "outlet_id",
          outletIds
        )
        .gte(
          "business_date",
          firstDate
        )
        .lte(
          "business_date",
          today
        )
        .order(
          "business_date",
          {
            ascending:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
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

    splitDashboardReports =
      data ?? [];
  }

  // If a legacy assignment is still active for an outlet,
  // that outlet remains on legacy KPI/trend semantics.
  // This prevents partial split pilots at other outlets from
  // being treated as a completed rollout.

  const legacyDashboardFormIds =
    [
      openingForm?.id,
      closingForm?.id,
    ].filter(
      Boolean
    ) as string[];

  let activeLegacyDashboardAssignments:
    any[] = [];

  if (
    outletIds.length &&
    legacyDashboardFormIds.length
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "outlet_form_assignments"
        )
        .select(`
          outlet_id,
          form_id
        `)
        .in(
          "outlet_id",
          outletIds
        )
        .in(
          "form_id",
          legacyDashboardFormIds
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

    activeLegacyDashboardAssignments =
      data ?? [];
  }

  const activeLegacyOutletIds =
    new Set(
      activeLegacyDashboardAssignments.map(
        (assignment: any) =>
          assignment.outlet_id
      )
    );



  // ==========================================================
  // ISSUES
  // ==========================================================

  const reportIds =
    Array.from(
      new Set(
        [
          ...reports,
          ...splitDashboardReports,
        ].map(
          (
            report: any
          ) =>
            report.id
        )
      )
    );

  let issues: any[] =
    [];

  if (
    reportIds.length
  ) {
    const {
      data,
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

    issues =
      data ?? [];
  }


  const issueCountByReport =
    new Map<
      string,
      number
    >();

  for (
    const issue
    of issues
  ) {
    if (
      !issue.report_id
    ) {
      continue;
    }

    issueCountByReport.set(
      issue.report_id,
      (
        issueCountByReport.get(
          issue.report_id
        ) ?? 0
      ) + 1
    );
  }


  // ==========================================================
  // SPLIT OUTLET DAILY SUMMARY
  // ==========================================================

  const outletById =
    new Map<string, any>(
      outlets.map(
        (outlet: any) => [
          outlet.id,
          outlet,
        ]
      )
    );

  const dateForTimestamp = (
    value:
      string | null | undefined,
    outletTimezone: string
  ) => {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          outletTimezone ||
          "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(
      new Date(value)
    );
  };

  const splitReportByKey =
    new Map<string, any>();

  for (
    const report
    of splitDashboardReports
  ) {
    const key =
      `${report.outlet_id}|${report.business_date}|${report.form_id}`;

    if (
      !splitReportByKey.has(
        key
      )
    ) {
      splitReportByKey.set(
        key,
        report
      );
    }
  }

  const splitExpectedFormIdsForDate =
    (
      outletId: string,
      date: string
    ) => {
      if (
        activeLegacyOutletIds.has(
          outletId
        )
      ) {
        return [];
      }

      const outlet =
        outletById.get(
          outletId
        );

      if (!outlet) {
        return [];
      }

      const outletTimezone =
        outlet.timezone ||
        "Asia/Jakarta";

      return Array.from(
        new Set(
          splitDashboardAssignments
            .filter(
              (
                assignment:
                  any
              ) => {
                if (
                  assignment.outlet_id !==
                  outletId
                ) {
                  return false;
                }

                const startDate =
                  dateForTimestamp(
                    assignment.effective_from,
                    outletTimezone
                  );

                const endDate =
                  dateForTimestamp(
                    assignment.effective_until,
                    outletTimezone
                  );

                if (
                  startDate &&
                  date <
                    startDate
                ) {
                  return false;
                }

                if (
                  endDate &&
                  date >
                    endDate
                ) {
                  return false;
                }

                return true;
              }
            )
            .map(
              (
                assignment:
                  any
              ) =>
                assignment.form_id
            )
        )
      );
    };

  const splitSummaryForOutletDate =
    (
      outletId: string,
      date: string
    ) => {
      const expectedFormIds =
        splitExpectedFormIdsForDate(
          outletId,
          date
        );

      if (
        !expectedFormIds.length
      ) {
        return null;
      }

      const dateReports =
        expectedFormIds
          .map(
            (
              formId
            ) =>
              splitReportByKey.get(
                `${outletId}|${date}|${formId}`
              ) ??
              null
          )
          .filter(
            Boolean
          );

      const completedCount =
        dateReports.filter(
          (
            report: any
          ) =>
            normalizeStatus(
              report.status
            ) ===
            "completed"
        ).length;

      const status =
        completedCount ===
        expectedFormIds.length
          ? "completed"
          : dateReports.length >
              0
            ? "in_progress"
            : "not_submitted";

      const issueCount =
        dateReports.reduce(
          (
            total:
              number,
            report: any
          ) =>
            total +
            (
              issueCountByReport.get(
                report.id
              ) ?? 0
            ),
          0
        );

      return {
        status,
        issueCount,
        completedCount,
        expectedCount:
          expectedFormIds.length,
      };
    };


  // ==========================================================
  // TODAY
  // ==========================================================

  // ==========================================================
  // CENTRAL KITCHEN PIC KPI
  //
  // For CQ Central PIC users, dashboard metrics are based on
  // CK sections assigned to the current user.
  // ==========================================================

  let ckAssignedCount =
    0;

  let ckCompletedCount =
    0;

  let ckInProgressCount =
    0;

  let ckNotSubmittedCount =
    0;

  let ckIssueCount =
    0;

  // CK PRODUCTION LEADER KPI
  //
  // Section PIC:
  //   completion belongs to current submitted_by user.
  //
  // Production Leader:
  //   completion reflects the whole Production team.
  //
  let ckProductionLeaderMode =
    false;


  if (
    activeOutlet?.code ===
    "CNT"
  ) {

    // ----------------------------------------------------------
    // CK FORMS
    // ----------------------------------------------------------

    const {
      data: ckForms,
      error: ckFormsError,
    } =
      await supabase
        .from("forms")
        .select(`
          id,
          code
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


    if (ckFormsError) {

      return (
        <ErrorState
          message={
            ckFormsError.message
          }
        />
      );

    }


    const ckFormRows =
      ckForms ?? [];

    const ckFormIds =
      ckFormRows.map(
        (item: any) =>
          item.id
      );


    // ----------------------------------------------------------
    // ACTIVE CK FORM VERSIONS
    // ----------------------------------------------------------

    const {
      data: ckAssignments,
      error: ckAssignmentsError,
    } =
      ckFormIds.length
        ? await supabase
            .from(
              "outlet_form_assignments"
            )
            .select(`
              form_id,
              form_version_id
            `)
            .eq(
              "outlet_id",
              activeOutlet.id
            )
            .in(
              "form_id",
              ckFormIds
            )
            .eq(
              "is_active",
              true
            )
        : {
            data: [],
            error: null,
          };


    if (ckAssignmentsError) {

      return (
        <ErrorState
          message={
            ckAssignmentsError.message
          }
        />
      );

    }


    const ckAssignmentRows =
      ckAssignments ?? [];

    const ckVersionIds =
      ckAssignmentRows.map(
        (item: any) =>
          item.form_version_id
      );


    // ----------------------------------------------------------
    // REQUIRED ACTIVE CK SECTIONS
    // ----------------------------------------------------------

    const {
      data: ckVersionSections,
      error: ckVersionSectionsError,
    } =
      ckVersionIds.length
        ? await supabase
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
              ckVersionIds
            )
            .eq(
              "is_active",
              true
            )
            .eq(
              "is_required",
              true
            )
        : {
            data: [],
            error: null,
          };


    if (ckVersionSectionsError) {

      return (
        <ErrorState
          message={
            ckVersionSectionsError.message
          }
        />
      );

    }


    const ckFormIdByVersion =
      new Map(
        ckAssignmentRows.map(
          (item: any) => [
            item.form_version_id,
            item.form_id,
          ]
        )
      );


    const ckActiveSectionKeys =
      new Set(
        (
          ckVersionSections ??
          []
        )
          .map(
            (item: any) => {

              const formId =
                ckFormIdByVersion.get(
                  item.form_version_id
                );

              return formId
                ? `${formId}:${item.section_id}`
                : null;

            }
          )
          .filter(
            Boolean
          )
      );


    // ----------------------------------------------------------
    // PRODUCTION LEADER
    //
    // Do not infer leader authority from can_review/can_submit.
    // Final authority comes from form_area_leaders.
    // ----------------------------------------------------------

    const {
      data: ckAreaLeaderRows,
      error: ckAreaLeaderError,
    } =
      ckFormIds.length
        ? await supabase
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
              activeOutlet.id
            )
            .eq(
              "user_id",
              user.id
            )
            .eq(
              "area_code",
              "PRODUCTION"
            )
            .in(
              "form_id",
              ckFormIds
            )
        : {
            data: [],
            error: null,
          };

    if (ckAreaLeaderError) {
      return (
        <ErrorState
          message={
            ckAreaLeaderError.message
          }
        />
      );
    }

    const ckProductionLeaderFormIds =
      new Set(
        (
          ckAreaLeaderRows ??
          []
        ).map(
          (item: any) =>
            item.form_id
        )
      );

    ckProductionLeaderMode =
      ckProductionLeaderFormIds.size >
      0;


    // ----------------------------------------------------------
    // CURRENT PIC ASSIGNMENT
    // ----------------------------------------------------------

    const {
      data: ckPermissions,
      error: ckPermissionsError,
    } =
      ckFormIds.length
        ? await supabase
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
              user.id
            )
            .eq(
              "outlet_id",
              activeOutlet.id
            )
            .in(
              "form_id",
              ckFormIds
            )
            .eq(
              "can_submit",
              true
            )
        : {
            data: [],
            error: null,
          };


    if (ckPermissionsError) {

      return (
        <ErrorState
          message={
            ckPermissionsError.message
          }
        />
      );

    }


    const ckAssignedByKey =
      new Map<string, any>();


    for (
      const permission of
      ckPermissions ?? []
    ) {

      const key =
        `${permission.form_id}:${permission.section_id}`;

      if (
        ckActiveSectionKeys.has(
          key
        )
      ) {

        ckAssignedByKey.set(
          key,
          permission
        );

      }

    }


    const ckAssignedSections =
      Array.from(
        ckAssignedByKey.values()
      );


    ckAssignedCount =
      ckAssignedSections.length;


    // ----------------------------------------------------------
    // TODAY CK REPORTS
    // ----------------------------------------------------------

    const {
      data: ckReports,
      error: ckReportsError,
    } =
      ckFormIds.length
        ? await supabase
            .from("reports")
            .select(`
              id,
              form_id,
              status,
              business_date
            `)
            .eq(
              "outlet_id",
              activeOutlet.id
            )
            .in(
              "form_id",
              ckFormIds
            )
            .eq(
              "business_date",
              today
            )
        : {
            data: [],
            error: null,
          };


    if (ckReportsError) {

      return (
        <ErrorState
          message={
            ckReportsError.message
          }
        />
      );

    }


    const ckReportRows =
      ckReports ?? [];

    const ckReportByFormId =
      new Map(
        ckReportRows.map(
          (item: any) => [
            item.form_id,
            item,
          ]
        )
      );

    const ckReportIds =
      ckReportRows.map(
        (item: any) =>
          item.id
      );

    const ckAssignedSectionIds =
      Array.from(
        new Set(
          ckAssignedSections.map(
            (item: any) =>
              item.section_id
          )
        )
      );


    // ----------------------------------------------------------
    // SECTION STATUS
    // ----------------------------------------------------------

    const {
      data: ckReportSections,
      error: ckReportSectionsError,
    } =
      ckReportIds.length &&
      ckAssignedSectionIds.length
        ? await supabase
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
              ckReportIds
            )
            .in(
              "section_id",
              ckAssignedSectionIds
            )
        : {
            data: [],
            error: null,
          };


    if (ckReportSectionsError) {

      return (
        <ErrorState
          message={
            ckReportSectionsError.message
          }
        />
      );

    }


    const ckReportSectionRows =
      ckReportSections ?? [];

    const ckReportSectionByKey =
      new Map(
        ckReportSectionRows.map(
          (item: any) => [
            `${item.report_id}:${item.section_id}`,
            item,
          ]
        )
      );


    const ckOwnedReportSectionIds:
      string[] = [];


    for (
      const assigned of
      ckAssignedSections
    ) {

      const report =
        ckReportByFormId.get(
          assigned.form_id
        );


      if (!report) {

        ckNotSubmittedCount +=
          1;

        continue;

      }


      const reportSection =
        ckReportSectionByKey.get(
          `${report.id}:${assigned.section_id}`
        );


      if (!reportSection) {

        ckNotSubmittedCount +=
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
        ckProductionLeaderFormIds.has(
          assigned.form_id
        );

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
            user.id
        );


      const isInProgress =
        [
          "draft",
          "in_progress",
          "reopened",
        ].includes(
          status
        );


      if (isCompleted) {

        ckCompletedCount +=
          1;

      } else if (
        isInProgress
      ) {

        ckInProgressCount +=
          1;

      } else {

        ckNotSubmittedCount +=
          1;

      }


      ckOwnedReportSectionIds.push(
        reportSection.id
      );

    }


    // ----------------------------------------------------------
    // PIC SECTION ISSUES
    // ----------------------------------------------------------

    if (
      ckOwnedReportSectionIds.length
    ) {

      const {
        data: ckIssues,
        error: ckIssuesError,
      } =
        await supabase
          .from("issues")
          .select(`
            id,
            report_section_id
          `)
          .in(
            "report_section_id",
            ckOwnedReportSectionIds
          );


      if (ckIssuesError) {

        return (
          <ErrorState
            message={
              ckIssuesError.message
            }
          />
        );

      }


      ckIssueCount =
        (
          ckIssues ??
          []
        ).length;

    }

  }


  const useCkPicSummary =
    activeOutlet?.code ===
      "CNT" &&
    ckAssignedCount > 0;


  const todayRows =
    outlets.map(
      (
        outlet: any
      ) => {
        const splitSummary =
          splitSummaryForOutletDate(
            outlet.id,
            today
          );

        if (splitSummary) {
          return {
            outlet,
            report: null,
            status:
              splitSummary.status,
            issueCount:
              splitSummary.issueCount,
          };
        }

        const report =
          reports.find(
            (
              item: any
            ) =>
              item.outlet_id ===
                outlet.id &&
              item.business_date ===
                today
          ) ?? null;

        return {
          outlet,
          report,
          status:
            report
              ? normalizeStatus(
                  report.status
                )
              : "not_submitted",
          issueCount:
            report
              ? issueCountByReport.get(
                  report.id
                ) ?? 0
              : 0,
        };
      }
    );


  const completed =
    todayRows.filter(
      (row) =>
        row.status ===
        "completed"
    ).length;

  const inProgress =
    todayRows.filter(
      (row) =>
        row.status ===
        "in_progress"
    ).length;

  const notSubmitted =
    todayRows.filter(
      (row) =>
        row.status ===
        "not_submitted"
    ).length;

  const todayIssues =
    todayRows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.issueCount,
      0
    );


  // ==========================================================
  // TREND
  // ==========================================================

  const trend =
    Array.from(
      {
        length:
          period,
      },
      (_, index) => {
        const date =
          shiftDate(
            firstDate,
            index
          );

        const dateRows =
          outlets.map(
            (
              outlet: any
            ) => {
              const splitSummary =
                splitSummaryForOutletDate(
                  outlet.id,
                  date
                );

              if (
                splitSummary
              ) {
                return {
                  status:
                    splitSummary.status,
                  issueCount:
                    splitSummary.issueCount,
                };
              }

              const report =
                reports.find(
                  (
                    item:
                      any
                  ) =>
                    item.outlet_id ===
                      outlet.id &&
                    item.business_date ===
                      date
                ) ?? null;

              return {
                status:
                  report
                    ? normalizeStatus(
                        report.status
                      )
                    : "not_submitted",
                issueCount:
                  report
                    ? issueCountByReport.get(
                        report.id
                      ) ?? 0
                    : 0,
              };
            }
          );

        const completedCount =
          dateRows.filter(
            (
              row
            ) =>
              row.status ===
              "completed"
          ).length;

        const issueCount =
          dateRows.reduce(
            (
              total:
                number,
              row
            ) =>
              total +
              row.issueCount,
            0
          );

        const rate =
          outlets.length
            ? Math.round(
                (
                  completedCount /
                  outlets.length
                ) *
                  100
              )
            : 0;

        return {
          date,
          completed:
            completedCount,
          issues:
            issueCount,
          rate,
        };
      }
    );


  // ==========================================================
  // ACTIVE OUTLET STATUS
  // ==========================================================

  const activeReport =
    activeOutlet
      ? reports.find(
          (
            report: any
          ) =>
            report.outlet_id ===
              activeOutlet.id &&
            report.business_date ===
              today
        ) ?? null
      : null;

  const useSplitOutletSummary =
    !useCkPicSummary &&
    activeOutlet?.code !== "CNT" &&
    splitOutletOperations.length > 0;

  const splitCompletedCount =
    splitOutletOperations.filter(
      (card) =>
        card.status === "COMPLETED"
    ).length;

  const splitInProgressCard =
    splitOutletOperations.find(
      (card) =>
        card.status === "IN PROGRESS"
    ) ?? null;

  const splitNotStartedCard =
    splitOutletOperations.find(
      (card) =>
        card.status === "NOT STARTED"
    ) ?? null;

  const activeStatus =
    useCkPicSummary
      ? (
          ckAssignedCount > 0 &&
          ckCompletedCount >=
            ckAssignedCount
            ? "completed"
            : ckCompletedCount > 0 ||
                ckInProgressCount > 0
              ? "in_progress"
              : "not_submitted"
        )
      : useSplitOutletSummary
        ? splitCompletedCount ===
            splitOutletOperations.length
          ? "completed"
          : splitInProgressCard ||
              splitCompletedCount > 0
            ? "in_progress"
            : "not_submitted"
        : activeReport
          ? normalizeStatus(
              activeReport.status
            )
          : "not_submitted";

  const activeAction =
    useSplitOutletSummary
      ? activeStatus === "completed"
        ? "/protected/reports"
        : (
            splitInProgressCard ??
            splitNotStartedCard
          )?.href ??
          "/protected"
      : activeStatus === "completed"
        ? activeReport
            ?.pdf_storage_path
          ? `/api/reports/${activeReport.id}/pdf`
          : "/protected/reports"
        : "/protected/closing/kitchen";

  const activeActionText =
    useSplitOutletSummary
      ? activeStatus === "completed"
        ? "View Reports"
        : splitInProgressCard
          ? `Resume ${splitInProgressCard.title}`
          : splitNotStartedCard
            ? `Start ${splitNotStartedCard.title}`
            : "View Operations"
      : activeStatus === "completed"
        ? "View Report"
        : activeStatus ===
            "in_progress"
          ? "Resume Closing"
          : "Start Closing";


  const scopeLabel =
    allOutletAccess
      ? "All Outlets"
      : outlets.length >
          1
        ? "Assigned Outlets"
        : outlets[0]
            ?.name ||
          "Outlet";


  const recentReports =
    [
      ...reports,
    ]
      .sort(
        (
          a: any,
          b: any
        ) =>
          String(
            b.business_date
          ).localeCompare(
            String(
              a.business_date
            )
          )
      )
      .slice(
        0,
        6
      );


  // ==========================================================
  // OPERATIONAL HUB
  //
  // Navigation layer only.
  // Existing dashboard metrics / CK / reports remain unchanged.
  // ==========================================================

  const hubOperations:
    OperationalHubOperation[] =
    [];


  // ----------------------------------------------------------
  // CENTRAL KITCHEN
  // ----------------------------------------------------------

  if (
    useCkPicSummary
  ) {
    hubOperations.push({
      key:
        "central-kitchen",
      eyebrow:
        "Central Kitchen",
      title:
        "Opening CK / Closing CK",
      description:
        "Continue sections assigned to you and follow area finalization progress.",
      status:
        activeStatus ===
        "completed"
          ? "COMPLETED"
          : activeStatus ===
              "in_progress"
            ? "IN PROGRESS"
            : "READY",
      href:
        "/protected/central-kitchen",
      action:
        activeStatus ===
        "in_progress"
          ? "Continue Central Kitchen"
          : "Open Central Kitchen",
    });
  }


  // ----------------------------------------------------------
  // SPLIT OUTLET
  // ----------------------------------------------------------

  else if (
    useSplitOutletSummary
  ) {
    for (
      const card
      of splitOutletOperations
    ) {
      const completed =
        card.status ===
        "COMPLETED";

      const canOpen =
        completed ||
        card.canFill;

      hubOperations.push({
        key:
          card.formCode,
        eyebrow:
          card.area,
        title:
          card.title,
        description:
          card.description,
        status:
          card.status,
        href:
          canOpen
            ? card.href
            : "",
        action:
          completed
            ? "View Report"
            : card.status ===
                "IN PROGRESS"
              ? "Resume"
              : "Start",
        disabled:
          !canOpen,
      });
    }
  }


  // ----------------------------------------------------------
  // LEGACY OUTLET
  // ----------------------------------------------------------

  else {
    if (
      canOpening &&
      openingStatus !==
        "UNAVAILABLE"
    ) {
      hubOperations.push({
        key:
          "opening",
        eyebrow:
          "Opening",
        title:
          "Opening Outlet",
        description:
          "Daily opening readiness checklist for the active outlet.",
        status:
          openingStatus,
        href:
          openingHref,
        action:
          openingCTA,
      });
    }

    if (
      canClosing
    ) {
      hubOperations.push({
        key:
          "closing",
        eyebrow:
          "Closing",
        title:
          "Closing Outlet",
        description:
          "Daily closing checklist and operational report.",
        status:
          activeStatus ===
          "completed"
            ? "COMPLETED"
            : activeStatus ===
                "in_progress"
              ? "IN PROGRESS"
              : "NOT STARTED",
        href:
          activeAction,
        action:
          activeActionText,
      });
    }
  }



  // ----------------------------------------------------------
  // AUDIT
  // ----------------------------------------------------------

  if (
    canAuditInput
  ) {
    hubOperations.push({
      key:
        "outlet-audit",
      eyebrow:
        "Audit",
      title:
        "Outlet Audit",
      description:
        "Record findings and submit the outlet audit.",
      status:
        "READY",
      href:
        "/protected/audit",
      action:
        "Open Audit",
    });
  }


  // ==========================================================
  // RECENT ACTIVITY
  // ==========================================================

  const hubActivities:
    OperationalHubActivity[] =
    [];


  const hubReportMap =
    new Map<
      string,
      any
    >();

  for (
    const report
    of [
      ...recentReports,
      ...splitDashboardReports,
    ]
  ) {
    if (
      report?.id &&
      !hubReportMap.has(
        report.id
      )
    ) {
      hubReportMap.set(
        report.id,
        report
      );
    }
  }

  const hubRecentReports =
    Array.from(
      hubReportMap.values()
    )
      .sort(
        (
          a: any,
          b: any
        ) => {
          const dateCompare =
            String(
              b.business_date ||
              ""
            ).localeCompare(
              String(
                a.business_date ||
                ""
              )
            );

          if (
            dateCompare !== 0
          ) {
            return dateCompare;
          }

          return String(
            b.created_at ||
            ""
          ).localeCompare(
            String(
              a.created_at ||
              ""
            )
          );
        }
      )
      .slice(
        0,
        4
      );


  for (
    const report
    of hubRecentReports
  ) {
    hubActivities.push({
      key:
        `report-${report.id}`,
      title:
        report.report_number ||
        "Operational Report",
      meta:
        `Operational Report · ${
          report.business_date ||
          today
        }`,
      status:
        String(
          report.status ||
          "completed"
        )
          .replace(
            /_/g,
            " "
          )
          .toUpperCase(),
      href:
        report.pdf_storage_path
          ? `/api/reports/${report.id}/pdf`
          : "/protected/reports",
    });
  }



  // Latest Audit for users who also have audit access.
  if (
    activeOutlet?.id &&
    (
      canAuditInput ||
      canAuditManagement
    )
  ) {
    const auditAdmin =
      createAdminClient();

    let latestAuditQuery =
      auditAdmin
        .from(
          "audit_sessions"
        )
        .select(`
          id,
          audit_number,
          audit_date,
          status,
          auditor_user_id,
          submitted_at
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "outlet_id",
          activeOutlet.id
        )
        .eq(
          "status",
          "submitted"
        );

    if (
      !isAdmin &&
      !canAuditManagement
    ) {
      latestAuditQuery =
        latestAuditQuery.eq(
          "auditor_user_id",
          user.id
        );
    }

    const {
      data:
        latestAudit,
      error:
        latestAuditError,
    } =
      await latestAuditQuery
        .order(
          "submitted_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (
      latestAuditError
    ) {
      throw latestAuditError;
    }

    if (
      latestAudit
    ) {
      hubActivities.unshift({
        key:
          `audit-${latestAudit.id}`,
        title:
          latestAudit.audit_number ||
          "Outlet Audit",
        meta:
          `Outlet Audit · ${
            latestAudit.audit_date
          }`,
        status:
          "SUBMITTED",
        href:
          `/protected/audit/${latestAudit.id}/report`,
      });
    }
  }


  const visibleHubActivities =
    hubActivities.slice(
      0,
      5
    );


  // ==========================================================
  // QUICK ACCESS
  // ==========================================================

  const hubQuickLinks:
    OperationalHubQuickLink[] =
    [];

  if (
    canTeamStructure
  ) {
    hubQuickLinks.push({
      key:
        "team-structure",

      label:
        "Team Structure",

      description:
        "Staff, positions & outlet assignments",

      href:
        "/protected/team-structure",
    });
  }


  if (
    activeOutlet.code !==
    "CNT"
  ) {
    hubQuickLinks.push({
      key:
        "test-food",
      label:
        "Test Food",
      description:
        "Morning & afternoon food quality check",
      href:
        "/protected/test-food",
    });
  }


  if (
    canReports
  ) {
    hubQuickLinks.push({
      key:
        "reports",
      label:
        "Reports Center",
      description:
        "Operational report history",
      href:
        "/protected/reports",
    });
  }

  if (
    canAuditInput
  ) {
    hubQuickLinks.push({
      key:
        "audit-history",
      label:
        "Audit History",
      description:
        "Submitted outlet audits",
      href:
        "/protected/audit/history",
    });
  }

  if (
    canAuditManagement
  ) {
    hubQuickLinks.push({
      key:
        "audit-management",
      label:
        "Audit Management",
      description:
        "Scores, findings and outlet trends",
      href:
        "/protected/audit/management",
    });
  }


  if (
    canAuditManagement
  ) {
    hubQuickLinks.push({
      key:
        "exception-center",
      label:
        "Exception Center",
      description:
        "Issues, findings and follow-up",
      href:
        "/protected/exceptions",
    });
  }

  if (
    isAdmin
  ) {
    hubQuickLinks.push({
      key:
        "admin",
      label:
        "Administration",
      description:
        "Users, forms and permissions",
      href:
        "/protected/admin",
    });
  }

  hubQuickLinks.push({
    key:
      "change-outlet",
    label:
      "Change Outlet",
    description:
      "Switch active operating outlet",
    href:
      "/protected/select-outlet",
  });


  // ==========================================================
  // FOCUSED OPERATIONAL DASHBOARD
  //
  // FOH / BOH / CK STAFF
  //   -> Operational Hub only.
  //
  // STORE MANAGER
  //   -> Operational Hub + Outlet Insights.
  //
  // CK MANAGER
  //   -> Operational Hub + CK Progress.
  //
  // Other management / admin roles continue to the existing
  // analytics render below.
  // ==========================================================


  const dashboardRoleCodes =
    new Set(
      roles.map(
        (role: any) =>
          String(
            role?.code ||
            ""
          )
            .trim()
            .toUpperCase()
      )
    );


  const isManagementDashboard =
    !isAdmin &&
    (
      dashboardRoleCodes.has(
        "MANAGEMENT"
      ) ||
      roles.some(
        (
          role: any
        ) =>
          String(
            role?.name ||
            ""
          )
            .trim()
            .toUpperCase() ===
          "MANAGEMENT"
      )
    );


  const isOutletManagerDashboard =
    dashboardRoleCodes.has(
      "STORE_MANAGER"
    );

  const isCkLeaderDashboard =
    dashboardRoleCodes.has(
      "CK_MANAGER"
    );

  const isCkStaffDashboard =
    dashboardRoleCodes.has(
      "CK_STAFF"
    );

  const isFohDashboard =
    dashboardRoleCodes.has(
      "FOH_STAFF"
    );

  const isBohDashboard =
    dashboardRoleCodes.has(
      "KITCHEN_STAFF"
    );


  // ==========================================================
  // MANAGEMENT DASHBOARD EARLY RETURN
  //
  // Management is an oversight role, not a daily input role.
  // Do not continue into the legacy outlet analytics/cards
  // below this point.
  // ==========================================================

  if (
    isManagementDashboard
  ) {
    const managementAdmin =
      createAdminClient();


    const managementPosInsight =
      permissionCodes.includes(
        "pos.view"
      )
        ? await loadLatestPosVoidInsight(
            managementAdmin,
            profile.organization_id
          )
        : null;


    const managementQuickLinks =
      [
        ...hubQuickLinks,
      ];


    if (
      managementPosInsight &&
      !managementQuickLinks.some(
        item =>
          item.key ===
          "pos-void-sales"
      )
    ) {
      managementQuickLinks.unshift({
        key:
          "pos-void-sales",

        label:
          "Void Sales",

        description:
          `${managementPosInsight.voidItems} items · ${formatPosMoney(
            managementPosInsight.voidAmount
          )} · ${shortDate(
            managementPosInsight.businessDate
          )} · Mapped POS / Jakarta API`,

        href:
          "/protected/pos/void-sales",
      });
    }


    return (
      <>
        <AutoRefresh
          intervalMs={
            60000
          }
        />

        <ManagementDashboard
          outletName={
            activeOutlet.name
          }
          dateLabel={
            fullDate(
              today
            )
          }
          quickLinks={
            managementQuickLinks
          }
          activities={
            hubActivities
          }
        />
      </>
    );
  }


  const useFocusedOperationalDashboard =
    !isAdmin &&
    (
      isOutletManagerDashboard ||
      isCkLeaderDashboard ||
      isCkStaffDashboard ||
      isFohDashboard ||
      isBohDashboard
    );


  if (
    useFocusedOperationalDashboard
  ) {
    const focusedAssigned =
      hubOperations.length;

    const focusedCompleted =
      hubOperations.filter(
        operation =>
          operation.status ===
          "COMPLETED"
      ).length;

    const focusedActive =
      hubOperations.filter(
        operation =>
          operation.status ===
          "IN PROGRESS"
      ).length;

    const focusedRemaining =
      Math.max(
        0,
        focusedAssigned -
        focusedCompleted
      );

    return (
      <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">
        <AutoRefresh
          intervalMs={
            60000
          }
        />

        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">
          <header>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Operational Overview
            </p>

            <h1 className="mt-1.5 text-[28px] font-black tracking-tight md:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {
                fullDate(
                  today
                )
              }
            </p>
          </header>


          <OperationalHub
            outletName={
              activeOutlet.name
            }
            dateLabel={
              fullDate(
                today
              )
            }
            operations={
              hubOperations
            }
            activities={
              visibleHubActivities
            }
            quickLinks={
              hubQuickLinks
            }
          />


          {isOutletManagerDashboard && (
            <OutletInsights
              outletName={
                activeOutlet.name
              }
              assigned={
                focusedAssigned
              }
              completed={
                focusedCompleted
              }
              active={
                focusedActive
              }
              remaining={
                focusedRemaining
              }
              issues={
                todayIssues
              }
            />
          )}


          {isCkLeaderDashboard && (
            <CkProgress
              outletName={
                activeOutlet.name
              }
              assigned={
                ckAssignedCount
              }
              completed={
                ckCompletedCount
              }
              active={
                ckInProgressCount
              }
              pending={
                ckNotSubmittedCount
              }
              issues={
                ckIssueCount
              }
            />
          )}
        </div>
      </main>
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-neutral-900">

      <AutoRefresh
        intervalMs={
          60000
        }
      />

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">

        {/* TITLE */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-700">
              Operational Overview
            </p>

            <h1 className="mt-1.5 text-[28px] font-black tracking-tight md:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {fullDate(
                today
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                Report Scope
              </p>

              <p className="mt-1 text-sm font-bold text-neutral-800">
                {scopeLabel}
              </p>
            </div>

            {canReports && (
              <Link
                href="/protected/reports"
                className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-4 text-xs font-bold text-white transition hover:bg-black"
              >
                Reports →
              </Link>
            )}

          </div>

        </div>


        <OperationalHub
          outletName={
            activeOutlet.name
          }
          dateLabel={
            fullDate(
              today
            )
          }
          operations={
            hubOperations
          }
          activities={
            visibleHubActivities
          }
          quickLinks={
            hubQuickLinks
          }
        />


        {/* SUMMARY */}
        <section className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">

          <Metric
            label={
              useCkPicSummary
                ? "Assigned"
                : "Outlets"
            }
            tone="info"
            value={
              useCkPicSummary
                ? ckAssignedCount
                : outlets.length
            }
            sub={
              useCkPicSummary
                ? "CK Sections"
                : scopeLabel
            }
          />

          <Metric
            label={
              useCkPicSummary &&
              ckProductionLeaderMode
                ? "Submitted"
                : "Completed"
            }
            value={
              useCkPicSummary
                ? ckCompletedCount
                : completed
            }
            sub="Today"
            tone="success"
          />

          <Metric
            label="In Progress"
            value={
              useCkPicSummary
                ? ckInProgressCount
                : inProgress
            }
            sub="Today"
            tone="warning"
          />

          <Metric
            label="Not Submitted"
            value={
              useCkPicSummary
                ? ckNotSubmittedCount
                : notSubmitted
            }
            sub="Today"
          />

          <Metric
            label="Issues"
            value={
              useCkPicSummary
                ? ckIssueCount
                : todayIssues
            }
            sub="Today"
            tone="danger"
          />

        </section>


        {/* TREND + ACTIVE OUTLET */}
        <section className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_.7fr]">

          <div className="rounded-[18px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[22px] md:p-6">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Outlet Completion Trend
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {scopeLabel}
                </h2>
              </div>

              <div className="flex rounded-xl bg-neutral-100 p-1">

                <Link
                  href="/protected?period=7"
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    period === 7
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400"
                  }`}
                >
                  7 Days
                </Link>

                <Link
                  href="/protected?period=30"
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    period === 30
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400"
                  }`}
                >
                  30 Days
                </Link>

              </div>

            </div>


            <div className="mt-5 flex h-[160px] items-end gap-1.5 border-b border-neutral-200 md:mt-7 md:h-[200px]">

              {trend.map(
                (
                  item,
                  index
                ) => {
                  const showLabel =
                    period ===
                      7 ||
                    index %
                      5 ===
                      0 ||
                    index ===
                      trend.length -
                        1;

                  return (
                    <div
                      key={
                        item.date
                      }
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${item.date} · ${item.rate}% completed · ${item.issues} issues`}
                    >

                      <div className="flex h-[115px] items-end md:h-[150px]">

                        <div
                          className={`w-full rounded-t-md ${
                            item.rate ===
                            100
                              ? "bg-emerald-500"
                              : item.rate >
                                  0
                                ? "bg-red-600"
                                : "bg-neutral-200"
                          }`}
                          style={{
                            height:
                              `${Math.max(
                                5,
                                item.rate
                              )}%`,
                          }}
                        />

                      </div>

                      <div className="h-9 pt-2 text-center">

                        {showLabel && (
                          <span className="text-[9px] font-semibold text-neutral-400">
                            {shortDate(
                              item.date
                            )}
                          </span>
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-neutral-400">
              <span>
                Outlet completion reaches 100% only when all required daily operations for the outlet are completed.
              </span>

              <span>
                Today:{" "}
                <strong className="text-neutral-700">
                  {
                    trend[
                      trend.length -
                        1
                    ]?.completed ??
                    0
                  }
                </strong>{" "}
                /{" "}
                <strong className="text-neutral-700">
                  {outlets.length}
                </strong>{" "}
                outlet
                {outlets.length ===
                1
                  ? ""
                  : "s"}{" "}
                completed
                {" "}(
                <strong className="text-neutral-700">
                  {
                    trend[
                      trend.length -
                        1
                    ]?.rate ??
                    0
                  }%
                </strong>
                )
              </span>
            </div>

          </div>


          {/* ACTIVE OUTLET */}
          <div className="rounded-[18px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[22px] md:p-6">

            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Active Outlet
            </p>

            {activeOutlet ? (
              <>
                <div className="mt-4 flex items-center gap-3.5">

                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-red-50 text-xs font-black text-red-700 md:h-14 md:w-14 md:rounded-2xl md:text-sm">
                    {
                      activeOutlet.code
                    }
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black md:text-xl">
                      {
                        activeOutlet.name
                      }
                    </h2>

                    <div className="mt-1">
                      <StatusBadge
                        status={
                          activeStatus
                        }
                      />
                    </div>
                  </div>

                </div>

                <div className="mt-5 md:mt-7">

                  {(
                    canClosing ||
                    activeStatus ===
                      "completed"
                  ) && (
                    <Link
                      href={
                        activeAction
                      }
                      target={
                        activeStatus ===
                          "completed" &&
                        activeReport
                          ?.pdf_storage_path
                          ? "_blank"
                          : undefined
                      }
                      className="flex w-full items-center justify-between rounded-2xl bg-red-700 px-5 py-4 text-sm font-bold text-white transition hover:bg-red-800"
                    >
                      <span>
                        {
                          activeActionText
                        }
                      </span>
                      <span>
                        →
                      </span>
                    </Link>
                  )}

                  <Link
                    href="/protected/select-outlet"
                    className="mt-3 flex w-full items-center justify-center rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Change Outlet
                  </Link>

                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-neutral-500">
                  Select an outlet to start or resume daily operations.
                </p>

                <Link
                  href="/protected/select-outlet"
                  className="mt-6 flex items-center justify-center rounded-2xl bg-red-700 px-5 py-4 text-sm font-bold text-white"
                >
                  Select Outlet
                </Link>
              </>
            )}

          </div>

        </section>



        {/* ====================================================

            CENTRAL KITCHEN OPERATIONS

        ==================================================== */}

        {activeOutlet?.code === "CNT" && (

          <section className="mt-4 overflow-hidden rounded-[18px] border border-red-100 bg-white shadow-sm md:mt-6 md:rounded-[22px]">

            <div className="p-4 sm:p-5 md:p-6">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                <div className="flex min-w-0 items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-xl sm:h-12 sm:w-12">

                    🏭

                  </div>

                  <div className="min-w-0">

                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-700">

                      Daily Operational

                    </p>

                    <h2 className="mt-0.5 text-lg font-black tracking-tight text-neutral-950 sm:text-xl">

                      Central Kitchen Operations

                    </h2>

                    <p className="mt-1.5 text-[13px] leading-5 text-neutral-500 sm:text-sm sm:leading-6">

                      Opening CK dan Closing CK berdasarkan section yang menjadi tanggung jawab Anda.

                    </p>

                  </div>

                </div>


                <span className="shrink-0 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">

                  AVAILABLE

                </span>

              </div>


              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">

                <div className="rounded-2xl bg-neutral-50 px-4 py-4">

                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">

                    Outlet

                  </p>

                  <p className="mt-1 truncate text-sm font-bold text-neutral-900">

                    {activeOutlet.name}

                  </p>

                </div>


                <div className="rounded-2xl bg-neutral-50 px-4 py-4">

                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">

                    Operation

                  </p>

                  <p className="mt-1 text-sm font-bold text-neutral-900">

                    Opening CK / Closing CK

                  </p>

                </div>

              </div>


              <Link
                href="/protected/central-kitchen"
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-red-700 px-5 py-4 text-sm font-black text-white transition hover:bg-red-800"
              >

                <span>
                  Open Central Kitchen
                </span>

                <span>
                  →
                </span>

              </Link>

            </div>

          </section>

        )}


        <SplitOutletOperationsPanel
          cards={
            splitOutletOperations
          }
          outletName={
            activeOutlet?.name ??
            "Outlet"
          }
        />

        {/* ====================================================
            OPENING OUTLET
        ==================================================== */}

        {activeOutlet?.code !== "CNT" &&
        splitOutletOperations.length === 0 && (
          <section className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-sm md:mt-6 md:rounded-[22px]">

            <div className="p-4 sm:p-5 md:p-6">

              <div className="flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-amber-50 text-xl sm:h-12 sm:w-12">

                    ☀️

                  </div>

                  <div className="min-w-0">

                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">

                      Daily Operational

                    </p>

                    <h2 className="mt-0.5 text-lg font-black tracking-tight text-neutral-950 sm:text-xl">

                      Opening Outlet

                    </h2>

                    <p className="mt-1.5 text-[13px] leading-5 text-neutral-500 sm:text-sm sm:leading-6">

                      Kitchen / BOH opening readiness checklist with mandatory photo evidence.

                    </p>

                  </div>

                </div>


                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                    openingStatus ===
                    "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700"
                      : openingStatus ===
                          "IN PROGRESS"
                        ? "bg-amber-50 text-amber-700"
                        : openingStatus ===
                            "NOT STARTED"
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-neutral-100 text-neutral-400"
                  }`}
                >

                  {openingStatus}

                </span>

              </div>


              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">

                <div className="rounded-2xl bg-neutral-50 px-4 py-4">

                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">

                    Outlet

                  </p>

                  <p className="mt-1 truncate text-sm font-bold text-neutral-900">

                    {activeOutlet.name}

                  </p>

                </div>


                <div className="rounded-2xl bg-neutral-50 px-4 py-4">

                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">

                    Section

                  </p>

                  <p className="mt-1 text-sm font-bold text-neutral-900">

                    Kitchen / BOH

                  </p>

                </div>

              </div>


              {openingReport
                ?.report_number && (

                <div className="mt-3 rounded-2xl border border-neutral-100 px-4 py-4">

                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">

                    Today's Report

                  </p>

                  <p className="mt-1 break-all text-sm font-bold text-neutral-900">

                    {
                      openingReport
                        .report_number
                    }

                  </p>

                </div>

              )}

            </div>


            {openingAvailable &&
            (
              canOpening ||
              openingIsCompleted
            ) ? (

              <Link
                href={
                  openingHref
                }
                target={
                  openingIsCompleted &&
                  openingReport
                    ?.pdf_storage_path
                    ? "_blank"
                    : undefined
                }
                className={`flex items-center justify-between border-t px-5 py-4 text-sm font-black transition sm:px-6 md:px-7 ${
                  openingIsCompleted
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >

                <span>

                  {openingCTA}

                </span>

                <span>

                  →

                </span>

              </Link>

            ) : openingAvailable ? (

              <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4 text-sm font-semibold text-neutral-400 sm:px-6 md:px-7">

                You do not have permission to submit Opening.

              </div>

            ) : (

              <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4 text-sm font-semibold text-neutral-400 sm:px-6 md:px-7">

                Opening belum tersedia untuk outlet ini.

              </div>

            )}

          </section>
        )}


        {/* TODAY OUTLETS */}

        <section className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-sm md:mt-6 md:rounded-[22px]">

          <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-4 sm:px-6 sm:py-5">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">

                Today

              </p>

              <h2 className="mt-1 text-lg font-black tracking-tight text-neutral-950 sm:text-xl">

                Outlet Status

              </h2>

            </div>

            <p className="shrink-0 text-xs font-semibold text-neutral-400">

              {outlets.length}{" "}
              outlet
              {outlets.length === 1
                ? ""
                : "s"}

            </p>

          </div>


          {/* ==================================================
              MOBILE / TABLET
          ================================================== */}

          <div className="divide-y divide-neutral-100 lg:hidden">

            {todayRows.map(
              (row) => {

                const normalizedStatus =
                  String(
                    row.status || ""
                  )
                    .trim()
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "_"
                    );

                const isCompletedRow =
                  [
                    "completed",
                    "submitted",
                  ].includes(
                    normalizedStatus
                  );

                return (

                  <div
                    key={row.outlet.id}
                    className="px-4 py-4 sm:px-6 sm:py-5"
                  >

                    {/* TOP */}

                    <div className="flex items-start justify-between gap-3">

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-[11px] font-black text-red-700">

                          {
                            row.outlet.code
                          }

                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-[15px] font-black text-neutral-950">

                            {
                              row.outlet.name
                            }

                          </p>

                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">

                            {
                              row.outlet.code
                            }

                          </p>

                        </div>

                      </div>

                      <div className="shrink-0">

                        <StatusBadge
                          status={
                            row.status
                          }
                        />

                      </div>

                    </div>


                    {/* INFO */}

                    <div className="mt-4 grid grid-cols-2 gap-3">

                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">

                        <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                          Issues

                        </p>

                        {row.issueCount > 0 ? (

                          <p className="mt-1 text-sm font-black text-red-700">

                            {
                              row.issueCount
                            }{" "}
                            Issue
                            {row.issueCount === 1
                              ? ""
                              : "s"}

                          </p>

                        ) : (

                          <p className="mt-1 text-sm font-black text-neutral-700">

                            0

                          </p>

                        )}

                      </div>


                      <div className="min-w-0 rounded-2xl bg-neutral-50 px-4 py-3">

                        <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">

                          Report

                        </p>

                        {row.report ? (

                          <p className="mt-1 truncate text-xs font-bold text-neutral-700">

                            {
                              row.report
                                .report_number
                            }

                          </p>

                        ) : (

                          <p className="mt-1 text-xs font-semibold text-neutral-400">

                            Not submitted

                          </p>

                        )}

                      </div>

                    </div>


                    {/* ACTION */}

                    {row.report && (

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 [&>button]:w-full [&>button]:justify-center">

                        {row.report
                          .pdf_storage_path &&
                        canReports ? (

                          <a
                            href={`/api/reports/${row.report.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-xs font-black text-white transition hover:bg-black"
                          >

                            View Report

                          </a>

                        ) : (

                          <div className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-100 px-4 py-3 text-xs font-bold text-neutral-400">

                            No PDF

                          </div>

                        )}


                        {canReopenReport &&
                          isCompletedRow && (

                            <ReopenReportButton
                              reportId={
                                row.report.id
                              }
                              reportNumber={
                                row.report
                                  .report_number
                              }
                            />

                          )}

                      </div>

                    )}

                  </div>

                );

              }
            )}

          </div>


          {/* ==================================================
              DESKTOP
          ================================================== */}

          <div className="hidden lg:block">

            <div className="grid grid-cols-[1.45fr_.75fr_.6fr_1fr_1fr] gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">

              <div>
                Outlet
              </div>

              <div>
                Status
              </div>

              <div>
                Issues
              </div>

              <div>
                Report
              </div>

              <div>
                Action
              </div>

            </div>


            {todayRows.map(
              (row) => {

                const normalizedStatus =
                  String(
                    row.status || ""
                  )
                    .trim()
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "_"
                    );

                const isCompletedRow =
                  [
                    "completed",
                    "submitted",
                  ].includes(
                    normalizedStatus
                  );

                return (

                  <div
                    key={row.outlet.id}
                    className="grid grid-cols-[1.45fr_.75fr_.6fr_1fr_1fr] items-center gap-4 border-b border-neutral-100 px-6 py-5 last:border-b-0"
                  >

                    {/* OUTLET */}

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[10px] font-black text-red-700">

                        {
                          row.outlet.code
                        }

                      </div>

                      <div className="min-w-0">

                        <p className="truncate font-bold text-neutral-950">

                          {
                            row.outlet.name
                          }

                        </p>

                        <p className="mt-0.5 text-[10px] text-neutral-400">

                          {
                            row.outlet.code
                          }

                        </p>

                      </div>

                    </div>


                    {/* STATUS */}

                    <div>

                      <StatusBadge
                        status={
                          row.status
                        }
                      />

                    </div>


                    {/* ISSUES */}

                    <div>

                      {row.issueCount > 0 ? (

                        <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">

                          {
                            row.issueCount
                          }{" "}
                          Issue
                          {row.issueCount ===
                          1
                            ? ""
                            : "s"}

                        </span>

                      ) : (

                        <span className="text-sm font-semibold text-neutral-400">

                          0

                        </span>

                      )}

                    </div>


                    {/* REPORT */}

                    <div className="min-w-0">

                      {row.report ? (

                        <p className="truncate text-xs font-semibold text-neutral-600">

                          {
                            row.report
                              .report_number
                          }

                        </p>

                      ) : (

                        <span className="text-xs text-neutral-300">

                          -

                        </span>

                      )}

                    </div>


                    {/* ACTION */}

                    <div>

                      {row.report ? (

                        <div className="flex flex-wrap items-center gap-2">

                          {row.report
                            .pdf_storage_path &&
                          canReports && (

                            <a
                              href={`/api/reports/${row.report.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-xl bg-neutral-900 px-3.5 py-2.5 text-[11px] font-black text-white transition hover:bg-black"
                            >

                              View Report

                            </a>

                          )}


                          {canReopenReport &&
                            isCompletedRow && (

                              <ReopenReportButton
                                reportId={
                                  row.report.id
                                }
                                reportNumber={
                                  row.report
                                    .report_number
                                }
                              />

                            )}

                        </div>

                      ) : (

                        <span className="text-xs text-neutral-300">

                          -

                        </span>

                      )}

                    </div>

                  </div>

                );

              }
            )}

          </div>

        </section>


{/* RECENT */}
        {canReports && (
          <section className="mt-6 rounded-[26px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  History
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Recent Reports
                </h2>
              </div>

              <Link
                href="/protected/reports"
                className="text-xs font-bold text-red-700"
              >
                View All →
              </Link>

            </div>

            <div className="mt-5 divide-y divide-neutral-100">

              {!recentReports.length ? (
                <p className="py-8 text-sm text-neutral-400">
                  No reports available yet.
                </p>
              ) : (
                recentReports.map(
                  (
                    report: any
                  ) => {
                    const outlet =
                      outlets.find(
                        (
                          item: any
                        ) =>
                          item.id ===
                          report.outlet_id
                      );

                    return (
                      <div
                        key={
                          report.id
                        }
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >

                        <div>
                          <p className="text-sm font-bold">
                            {
                              outlet
                                ?.name ||
                              "Outlet"
                            }
                          </p>

                          <p className="mt-1 text-xs text-neutral-400">
                            {
                              report.report_number
                            }
                          </p>
                        </div>

                        <div className="flex items-center gap-4">

                          <p className="text-xs text-neutral-400">
                            {shortDate(
                              report.business_date
                            )}
                          </p>

                          <StatusBadge
                            status={
                              normalizeStatus(
                                report.status
                              )
                            }
                          />

                          {report
                            .pdf_storage_path && (
                            <a
                              href={`/api/reports/${report.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-red-700"
                            >
                              PDF →
                            </a>
                          )}

                        </div>

                      </div>
                    );
                  }
                )
              )}

            </div>

          </section>
        )}


        <footer className="mt-10 border-t border-neutral-200 py-6 text-xs text-neutral-400">
          Resto Operational System · Operational Overview
        </footer>

      </div>

    </main>
  );
}


function Metric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: number;
  sub: string;
  tone?:
    | "info"
    | "neutral"
    | "success"
    | "warning"
    | "danger";
}) {
  const styles = {
    info: {
      shell: "border-sky-100 bg-sky-50/80",
      icon: "bg-sky-100 text-sky-700",
      value: "text-sky-800",
      symbol: "⌂",
    },
    neutral: {
      shell: "border-slate-200 bg-slate-50",
      icon: "bg-slate-200/70 text-slate-600",
      value: "text-slate-800",
      symbol: "○",
    },
    success: {
      shell: "border-emerald-100 bg-emerald-50/80",
      icon: "bg-emerald-100 text-emerald-700",
      value: "text-emerald-800",
      symbol: "✓",
    },
    warning: {
      shell: "border-amber-100 bg-amber-50/80",
      icon: "bg-amber-100 text-amber-700",
      value: "text-amber-800",
      symbol: "◷",
    },
    danger: {
      shell: "border-red-100 bg-red-50/80",
      icon: "bg-red-100 text-red-700",
      value: "text-red-800",
      symbol: "!",
    },
  };

  const style = styles[tone];

  return (
    <div
      className={`rounded-[16px] border p-3 shadow-sm ${style.shell}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </p>

        <span
          className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black ${style.icon}`}
        >
          {style.symbol}
        </span>
      </div>

      <p
        className={`mt-1.5 text-[25px] font-black leading-none tracking-tight ${style.value}`}
      >
        {value}
      </p>

      <p className="mt-1 truncate text-[9px] font-semibold text-neutral-500">
        {sub}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    "completed"
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">
        Completed
      </span>
    );
  }

  if (
    status ===
    "in_progress"
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700">
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-500">
      Not Submitted
    </span>
  );
}


function ErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">

      <div className="w-full max-w-lg rounded-[26px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

        <p className="text-3xl">
          ⚠️
        </p>

        <h1 className="mt-5 text-xl font-bold">
          Unable to Load Dashboard
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          {message}
        </p>

      </div>

    </main>
  );
}
