import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const outletId = String(body?.outletId || "");

  if (!outletId) {
    return NextResponse.json(
      { error: "Outlet belum dipilih." },
      { status: 400 }
    );
  }

  // ----------------------------------------------------------
  // Check whether user has ALL outlet access
  // ----------------------------------------------------------

  const { data: hasAllAccess } = await supabase.rpc(
    "has_all_outlet_access"
  );

  let allowed = hasAllAccess === true;

  // ----------------------------------------------------------
  // Normal user:
  // must exist inside user_outlets
  // ----------------------------------------------------------

  if (!allowed) {
    const { data: assignment } = await supabase
      .from("user_outlets")
      .select("outlet_id")
      .eq("user_id", user.id)
      .eq("outlet_id", outletId)
      .eq("is_active", true)
      .maybeSingle();

    allowed = Boolean(assignment);
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Anda tidak memiliki akses ke outlet tersebut.",
      },
      { status: 403 }
    );
  }

  // ----------------------------------------------------------
  // Make sure outlet exists and is active
  // ----------------------------------------------------------

  const { data: outlet } = await supabase
    .from("outlets")
    .select("id, code, name, timezone")
    .eq("id", outletId)
    .eq("is_active", true)
    .maybeSingle();

  if (!outlet) {
    return NextResponse.json(
      { error: "Outlet tidak ditemukan." },
      { status: 404 }
    );
  }

  const response = NextResponse.json({
    success: true,
    outlet,
  });

  response.cookies.set(
    "cq_active_outlet",
    outlet.id,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    }
  );

  return response;
}
