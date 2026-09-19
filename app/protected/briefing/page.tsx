import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import BriefingClient from "./briefing-client";


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


export default async function BriefingPage() {
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


  const outlet =
    await getActiveOutlet();


  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const admin =
    createAdminClient();


  const [
    profileResult,
    outletResult,
    assignmentResult,
  ] =
    await Promise.all([
      admin
        .from(
          "profiles"
        )
        .select(`
          id,
          full_name,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          user.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),

      admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name,
          timezone,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),

      admin
        .from(
          "user_outlets"
        )
        .select(`
          outlet_id
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),
    ]);


  const profile =
    profileResult.data;

  const outletRow =
    outletResult.data;


  if (
    !profile ||
    !outletRow ||
    !assignmentResult.data
  ) {
    redirect(
      "/protected"
    );
  }


  if (
    profile.organization_id !==
    outletRow.organization_id
  ) {
    redirect(
      "/protected"
    );
  }


  if (
    String(
      outletRow.code
    )
      .trim()
      .toUpperCase() ===
    "CNT"
  ) {
    redirect(
      "/protected"
    );
  }


  const date =
    businessDate(
      outletRow.timezone ||
      "Asia/Jakarta"
    );


  const {
    data:
      todaySessions,
    error:
      sessionsError,
  } =
    await admin
      .from(
        "briefing_sessions"
      )
      .select(`
        id,
        session_type,
        title,
        submitted_at
      `)
      .eq(
        "outlet_id",
        outletRow.id
      )
      .eq(
        "business_date",
        date
      )
      .eq(
        "status",
        "SUBMITTED"
      );


  if (sessionsError) {
    throw sessionsError;
  }


  return (
    <BriefingClient
      outletName={
        outletRow.name
      }
      businessDate={
        date
      }
      outletTimezone={
        outletRow.timezone ||
        "Asia/Jakarta"
      }
      picName={
        profile.full_name ||
        user.email ||
        "Outlet PIC"
      }
      submittedSessions={
        todaySessions ??
        []
      }
    />
  );
}
