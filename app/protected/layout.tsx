import { getActiveOutlet } from "@/lib/active-outlet";
import {
  getAccessContext,
} from "@/lib/admin/require-admin";
import {
  ProtectedHeader,
} from "@/components/protected-header";
import {
  getAppBuildInfo,
} from "@/lib/app-version";

export default async function ProtectedLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const {
    user,
    profile,
    roles,
    isAdmin,
    permissionCodes,
  } =
    await getAccessContext();

  const outlet =
    await getActiveOutlet();

  const role =
    roles[0];

  const isBodRole =
    !isAdmin &&
    String(
      role?.code ?? ""
    )
      .trim()
      .toUpperCase() ===
      "BOD";

  const displayName =
    profile?.full_name ||
    user.email ||
    "Operational User";

  const roleName =
    role?.name ||
    profile?.job_title ||
    "Operational User";

  const showAdministration =
    isAdmin ||
    permissionCodes.includes(
      "admin.access"
    ) ||
    permissionCodes.includes(
      "users.manage"
    ) ||
    permissionCodes.includes(
      "permissions.manage"
    ) ||
    permissionCodes.includes(
      "forms.manage"
    ) ||
    permissionCodes.includes(
      "questions.manage"
    );

  const showTeamStructure =
    isAdmin ||
    permissionCodes.includes(
      "team_structure.manage"
    );


  const showOpening =
    isAdmin ||
    permissionCodes.includes(
      "opening.submit"
    );

  const showClosing =
    isAdmin ||
    permissionCodes.includes(
      "closing.submit"
    );

  const showReports =
    isAdmin ||
    permissionCodes.includes(
      "reports.view"
    );

  const showAuditInput =
    isAdmin ||
    permissionCodes.includes(
      "audit.submit"
    );

  const showAuditManagement =
    isAdmin ||
    permissionCodes.includes(
      "audit.view_management"
    );

  const showTestFood =
    Boolean(
      outlet &&
      !isBodRole &&
      String(
        outlet.code ?? ""
      )
        .trim()
        .toUpperCase() !==
        "CNT"
    );

  const buildInfo =
    getAppBuildInfo();

  return (
    <div className="min-h-svh bg-[#f5f5f3]">
      <ProtectedHeader
        displayName={
          displayName
        }
        roleName={
          roleName
        }
        outletName={
          isBodRole
            ? "All Outlets"
            : outlet?.name ??
              null
        }
        outletContextLabel={
          isBodRole
            ? "Executive Scope"
            : "Active Outlet"
        }
        showAdministration={
          showAdministration
        }
        showTeamStructure={
          showTeamStructure
        }
        showOpening={
          showOpening
        }
        showClosing={
          showClosing
        }
        showReports={
          showReports
        }
        showAuditInput={
          showAuditInput
        }
        showAuditManagement={
          showAuditManagement
        }
        showTestFood={
          showTestFood
        }
        appVersion={
          buildInfo.appVersion
        }
        buildSha={
          buildInfo.buildSha
        }
        environment={
          buildInfo.environment
        }
      />

      <div className="pb-20 md:pb-0">
        {children}
      </div>

      <footer className="hidden border-t border-neutral-200/70 bg-white px-6 py-3 md:block">
        <div className="mx-auto flex max-w-[1480px] items-center justify-center gap-1.5 text-[10px] font-semibold text-neutral-400">
          <span>
            {buildInfo.environment}
          </span>

          <span>·</span>

          <span>
            {buildInfo.appVersion}
          </span>

          <span>·</span>

          <span className="font-mono">
            {buildInfo.buildSha}
          </span>
        </div>
      </footer>
    </div>
  );
}
