import Link from "next/link";
import { requirePermission } from "@/lib/admin/require-admin";

const menus = [
  {
    href: "/protected/admin/users",
    icon: "01",
    title: "Users",
    description:
      "User, role and outlet access.",
    status: "MANAGE",
  },
  {
    href: "/protected/admin/permissions",
    icon: "02",
    title: "Permissions",
    description:
      "Roles and system permissions.",
    status: "MANAGE",
  },
  {
    href: "/protected/admin/forms",
    icon: "03",
    title: "Forms",
    description:
      "Forms, versions and assignments.",
    status: "REVIEW",
  },
  {
    href: "/protected/admin/questions",
    icon: "04",
    title: "Questions",
    description:
      "Questions, groups and rules.",
    status: "REVIEW",
  },
];

export default async function AdminPage() {
  await requirePermission(
    "admin.access"
  );

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">
      <div className="mb-5 md:mb-7">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-700 sm:text-[10px]">
          Administration
        </p>

        <h1 className="mt-1.5 text-[28px] font-black tracking-tight text-neutral-950 md:text-3xl">
          System Administration
        </h1>

        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-neutral-500 md:text-sm md:leading-6">
          Manage users, permissions and
          operational configuration.
        </p>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 md:gap-4">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="group flex items-center gap-3.5 rounded-[16px] border border-neutral-200 bg-white p-3.5 shadow-sm transition hover:border-red-200 hover:shadow-md active:scale-[0.995] md:rounded-[18px] md:p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-red-50 text-[10px] font-black text-red-700">
              {menu.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[15px] font-black text-neutral-900 transition group-hover:text-red-700 md:text-base">
                  {menu.title}
                </h2>

                <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400 sm:inline-flex">
                  {menu.status}
                </span>
              </div>

              <p className="mt-0.5 truncate text-[11px] leading-5 text-neutral-500 md:text-xs">
                {menu.description}
              </p>
            </div>

            <span className="shrink-0 text-lg font-light text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-red-600">
              →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
