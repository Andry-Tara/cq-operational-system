import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase =
    await createClient();

  const { data } =
    await supabase.auth.getClaims();

  const user =
    data?.claims;

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-xs font-bold text-white transition hover:bg-red-800"
      >
        Sign in
      </Link>
    );
  }

  const email =
    typeof user.email ===
    "string"
      ? user.email
      : "Authorized User";

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right md:block">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
          Signed In
        </p>

        <p className="mt-0.5 max-w-[220px] truncate text-xs font-semibold text-neutral-700">
          {email}
        </p>
      </div>

      <div className="hidden h-8 w-px bg-neutral-200 md:block" />

      <LogoutButton />
    </div>
  );
}
