import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OutletSelectorClient from "./outlet-selector-client";

type Outlet = {
  id: string;
  code: string;
  name: string;
  timezone: string | null;
};

export default async function SelectOutletPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: hasAllAccess } =
    await supabase.rpc("has_all_outlet_access");

  let outlets: Outlet[] = [];

  if (hasAllAccess === true) {
    const { data } = await supabase
      .from("outlets")
      .select("id, code, name, timezone")
      .eq("is_active", true)
      .order("name");

    outlets = data ?? [];
  } else {
    const { data: assignments } = await supabase
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

    outlets =
      (assignments ?? [])
        .map((row: any) => {
          const raw = row.outlets;
          return Array.isArray(raw) ? raw[0] : raw;
        })
        .filter(
          (outlet: any) =>
            outlet &&
            outlet.is_active === true
        )
        .map((outlet: any) => ({
          id: outlet.id,
          code: outlet.code,
          name: outlet.name,
          timezone: outlet.timezone,
        }));
  }

  return (
    <OutletSelectorClient
      outlets={outlets}
      allOutletAccess={hasAllAccess === true}
    />
  );
}
