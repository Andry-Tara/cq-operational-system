import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
};


const LINK_VALIDITY_MS =
  7 *
  24 *
  60 *
  60 *
  1000;


export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const finalizationId =
      String(
        id ||
        ""
      ).trim();


    if (
      !finalizationId
    ) {
      return new NextResponse(
        "Report link is invalid.",
        {
          status:
            400,
        }
      );
    }


    const admin =
      createAdminClient();


    const {
      data:
        finalization,
      error:
        finalizationError,
    } =
      await admin
        .from(
          "report_area_finalizations"
        )
        .select(`
          id,
          area_code,
          finalized_at,
          pdf_storage_path
        `)
        .eq(
          "id",
          finalizationId
        )
        .eq(
          "area_code",
          "PRODUCTION"
        )
        .maybeSingle();


    if (
      finalizationError
    ) {
      console.error(
        "Public Production report lookup failed:",
        finalizationError
      );

      return new NextResponse(
        "Unable to open report.",
        {
          status:
            500,
        }
      );
    }


    if (
      !finalization ||
      !finalization
        .pdf_storage_path ||
      !finalization
        .finalized_at
    ) {
      return new NextResponse(
        "Report not found.",
        {
          status:
            404,
        }
      );
    }


    const finalizedAt =
      new Date(
        finalization
          .finalized_at
      );

    const expiresAt =
      finalizedAt
        .getTime() +
      LINK_VALIDITY_MS;


    if (
      Number.isNaN(
        finalizedAt
          .getTime()
      ) ||
      Date.now() >
        expiresAt
    ) {
      return new NextResponse(
        "This report link has expired.",
        {
          status:
            410,
        }
      );
    }


    // Short-lived Storage token.
    //
    // The public /r/p/... URL remains stable for seven days,
    // while the underlying Supabase JWT is never exposed in
    // copied WhatsApp summaries.
    const {
      data:
        signed,
      error:
        signedError,
    } =
      await admin
        .storage
        .from(
          "operational-reports"
        )
        .createSignedUrl(
          finalization
            .pdf_storage_path,
          60 * 10
        );


    if (
      signedError ||
      !signed?.signedUrl
    ) {
      console.error(
        "Public Production report signing failed:",
        signedError
      );

      return new NextResponse(
        "Unable to open report PDF.",
        {
          status:
            500,
        }
      );
    }


    return NextResponse.redirect(
      signed.signedUrl,
      307
    );

  } catch (
    error
  ) {
    console.error(
      "Public Production report route failed:",
      error
    );

    return new NextResponse(
      "Unable to open report.",
      {
        status:
          500,
      }
    );
  }
}
