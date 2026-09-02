import { getActiveOutlet } from "@/lib/active-outlet";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  ProtectedHeader,
} from "@/components/protected-header";

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
          outlet?.name ??
          null
        }
        showAdministration={
          showAdministration
        }
      />

      {children}

    </div>
  );
}
