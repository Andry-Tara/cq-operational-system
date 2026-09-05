import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    // ========================================================
    // AUTH
    // ========================================================

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL("/auth/login", request.url)
      );
    }

    // ========================================================
    // REPORT
    //
    // RLS on reports remains responsible for determining
    // whether this authenticated user may access the report.
    // ========================================================

    const {
      data: report,
      error: reportError,
    } = await supabase
      .from("reports")
      .select(`
        id,
        report_number,
        pdf_storage_path
      `)
      .eq("id", id)
      .maybeSingle();

    if (
      reportError ||
      !report?.pdf_storage_path
    ) {
      return NextResponse.json(
        {
          error:
            reportError?.message ||
            "PDF report tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // DOWNLOAD PRIVATE PDF FROM SUPABASE
    //
    // IMPORTANT:
    // Do not redirect browser to Supabase signed URL.
    // The PDF is proxied through our own application domain.
    // ========================================================

    const {
      data: pdfBlob,
      error: downloadError,
    } = await supabase.storage
      .from("operational-reports")
      .download(
        report.pdf_storage_path
      );

    if (
      downloadError ||
      !pdfBlob
    ) {
      return NextResponse.json(
        {
          error:
            downloadError?.message ||
            "Unable to open PDF.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // SAFE FILENAME
    // ========================================================

    const safeReportNumber =
      String(
        report.report_number ||
          "operational-report"
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        );

    const filename =
      `${safeReportNumber}.pdf`;

    // ========================================================
    // STREAM PDF THROUGH APPLICATION DOMAIN
    // ========================================================

    const arrayBuffer =
      await pdfBlob.arrayBuffer();

    return new NextResponse(
      arrayBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="${filename}"`,

          "Content-Length":
            String(
              arrayBuffer.byteLength
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "Report PDF proxy error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to open PDF.",
      },
      {
        status: 500,
      }
    );
  }
}
