import Link from "next/link";
import { requirePermission } from "@/lib/admin/require-admin";

const menus = [
  {
    href: "/protected/admin/users",
    icon: "01",
    title: "Users",
    description:
      "Create users, assign roles and manage outlet access.",
    status: "MANAGE",
  },
  {
    href: "/protected/admin/permissions",
    icon: "02",
    title: "Permissions",
    description:
      "Manage operational roles and administrator access.",
    status: "MANAGE",
  },
  {
    href: "/protected/admin/forms",
    icon: "03",
    title: "Forms",
    description:
      "Review forms, versions and outlet assignments.",
    status: "REVIEW",
  },
  {
    href: "/protected/admin/questions",
    icon: "04",
    title: "Questions",
    description:
      "Review checklist questions, groups and validation rules.",
    status: "REVIEW",
  },
];

export default async function AdminPage() {
  await requirePermission("admin.access");

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 md:px-8 md:py-12">
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">
          System Administration
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Manage system users, access permissions and operational form configuration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="group rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-xs font-black text-red-700">
                {menu.icon}
              </div>

              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
                {menu.status}
              </span>
            </div>

            <h2 className="mt-6 text-xl font-bold text-neutral-900 group-hover:text-red-700">
              {menu.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {menu.description}
            </p>

            <p className="mt-6 text-xs font-bold text-red-700">
              Open administration →
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
