import { requirePermission } from "@/lib/admin/require-admin";

export default async function ClosingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission(
    "closing.submit"
  );

  return <>{children}</>;
}
