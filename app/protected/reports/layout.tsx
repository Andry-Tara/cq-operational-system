import { requirePermission } from "@/lib/admin/require-admin";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission(
    "reports.view"
  );

  return <>{children}</>;
}
