import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";


export default async function ReportsLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();


  if (!user) {
    redirect(
      "/auth/login"
    );
  }


  // ==========================================================
  // STANDARD REPORT PERMISSION
  // ==========================================================

  const {
    data:
      canViewReports,
    error:
      permissionError,
  } =
    await supabase.rpc(
      "has_permission",
      {
        p_permission_code:
          "reports.view",
      }
    );


  if (
    permissionError
  ) {
    console.error(
      "Unable to check reports.view:",
      permissionError
    );
  }


  if (
    canViewReports ===
    true
  ) {
    return children;
  }


  // ==========================================================
  // EXPLICIT AREA LEADER ACCESS
  //
  // Allows:
  //
  // Muzza -> STORE / Warehouse
  // Wahyu -> PRODUCTION
  //
  // This does NOT grant reports.all_outlets.
  //
  // Actual report contents remain restricted by the
  // server-side scope resolver in reports/page.tsx.
  // ==========================================================

  const {
    data:
      leaderRows,
    error:
      leaderError,
  } =
    await supabase
      .from(
        "form_area_leaders"
      )
      .select("id")
      .eq(
        "user_id",
        user.id
      )
      .limit(1);


  if (
    leaderError
  ) {
    console.error(
      "Unable to check Report Center area leader access:",
      leaderError
    );
  }


  const hasAreaLeaderAccess =
    (
      leaderRows ??
      []
    ).length >
    0;


  if (
    !hasAreaLeaderAccess
  ) {
    redirect(
      "/protected"
    );
  }


  return children;
}
