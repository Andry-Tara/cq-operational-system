import Link from "next/link";
import { requirePermission } from "@/lib/admin/require-admin";

const menus = [
  {
    href: "/protected/admin/users",
    icon: "01",
    title: "Users",
    description: "User, role and outlet access.",
    status: "MANAGE",
    tile: "border-sky-100 bg-sky-50 text-sky-700",
  },
  {
    href: "/protected/admin/permissions",
    icon: "02",
    title: "Permissions",
    description: "Roles and system permissions.",
    status: "MANAGE",
    tile: "border-violet-100 bg-violet-50 text-violet-700",
  },
  {
    href: "/protected/admin/forms",
    icon: "03",
    title: "Forms",
    description: "Forms, versions and assignments.",
    status: "REVIEW",
    tile: "border-amber-100 bg-amber-50 text-amber-700",
  },
  {
    href: "/protected/admin/questions",
    icon: "04",
    title: "Questions",
    description: "Questions, groups and rules.",
    status: "REVIEW",
    tile: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
];

export default async function AdminPage() {
  await requirePermission("admin.access");

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5 sm:px-5 sm:py-7 md:px-8 md:py-10">
      <div className="mb-5 md:mb-7">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-700">
          Administration
        </p>

        <h1 className="mt-1 text-[27px] font-black tracking-tight text-neutral-950 md:text-3xl">
          System Administration
        </h1>

        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-neutral-500 md:text-sm">
          Users, permissions and operational configuration.
        </p>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 md:gap-4">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="group flex items-center gap-3 rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-red-200 hover:shadow-md active:scale-[0.995] md:p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border text-[10px] font-black ${menu.tile}`}
            >
              {menu.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[14px] font-black text-neutral-900 group-hover:text-red-700 md:text-base">
                  {menu.title}
                </h2>

                <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-neutral-400 sm:inline-flex">
                  {menu.status}
                </span>
              </div>

              <p className="mt-0.5 truncate text-[10px] leading-4 text-neutral-500 md:text-xs">
                {menu.description}
              </p>
            </div>

            <span className="text-lg font-light text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-red-600">
              →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
