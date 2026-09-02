import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function getActiveOutlet() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const cookieStore = await cookies();

  const activeOutletId =
    cookieStore.get(
      "cq_active_outlet"
    )?.value;

  // ==========================================================
  // User has all outlet access?
  // ==========================================================

  const { data: hasAllAccess } =
    await supabase.rpc(
      "has_all_outlet_access"
    );

  // ==========================================================
  // If cookie exists, validate permission
  // ==========================================================

  if (activeOutletId) {
    let allowed =
      hasAllAccess === true;

    if (!allowed) {
      const { data: assignment } =
        await supabase
          .from("user_outlets")
          .select("outlet_id")
          .eq("user_id", user.id)
          .eq(
            "outlet_id",
            activeOutletId
          )
          .eq("is_active", true)
          .maybeSingle();

      allowed = Boolean(assignment);
    }

    if (allowed) {
      const { data: outlet } =
        await supabase
          .from("outlets")
          .select(`
            id,
            code,
            name,
            timezone
          `)
          .eq("id", activeOutletId)
          .eq("is_active", true)
          .maybeSingle();

      if (outlet) {
        return outlet;
      }
    }
  }

  // ==========================================================
  // No cookie:
  // Auto-select only when user has exactly ONE outlet
  // ==========================================================

  if (hasAllAccess !== true) {
    const { data: assignments } =
      await supabase
        .from("user_outlets")
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
        .eq("user_id", user.id)
        .eq("is_active", true);

    const outlets =
      (assignments ?? [])
        .map((row: any) => {
          const raw = row.outlets;

          return Array.isArray(raw)
            ? raw[0]
            : raw;
        })
        .filter(
          (outlet: any) =>
            outlet &&
            outlet.is_active === true
        );

    if (outlets.length === 1) {
      return outlets[0];
    }
  }

  return null;
}
