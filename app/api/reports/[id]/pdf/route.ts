import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await context.params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
  }

  const { data: report, error } = await supabase
    .from("reports")
    .select(`
      id,
      pdf_storage_path
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !report?.pdf_storage_path
  ) {
    return NextResponse.json(
      {
        error: "PDF report tidak ditemukan.",
      },
      { status: 404 }
    );
  }

  const {
    data: signed,
    error: signedError,
  } = await supabase.storage
    .from("operational-reports")
    .createSignedUrl(
      report.pdf_storage_path,
      60 * 10
    );

  if (
    signedError ||
    !signed?.signedUrl
  ) {
    return NextResponse.json(
      {
        error:
          signedError?.message ||
          "Unable to open PDF.",
      },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    signed.signedUrl
  );
}
