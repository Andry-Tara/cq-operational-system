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


function safeFilename(
  value: unknown
) {
  const filename =
    String(
      value ||
      "production-report.pdf"
    )
      .replace(
        /[\r\n"]/g,
        "_"
      )
      .trim();

  return (
    filename ||
    "production-report.pdf"
  );
}


function parseByteRange(
  value: string,
  totalSize: number
) {
  const match =
    /^bytes=(\d*)-(\d*)$/i
      .exec(
        value.trim()
      );

  if (!match) {
    return null;
  }

  const startRaw =
    match[1];

  const endRaw =
    match[2];

  if (
    !startRaw &&
    !endRaw
  ) {
    return null;
  }


  // bytes=-500
  if (!startRaw) {
    const suffixLength =
      Number(
        endRaw
      );

    if (
      !Number.isFinite(
        suffixLength
      ) ||
      suffixLength <= 0
    ) {
      return null;
    }

    const length =
      Math.min(
        suffixLength,
        totalSize
      );

    return {
      start:
        totalSize -
        length,
      end:
        totalSize -
        1,
    };
  }


  const start =
    Number(
      startRaw
    );

  const requestedEnd =
    endRaw
      ? Number(
          endRaw
        )
      : totalSize - 1;

  if (
    !Number.isFinite(
      start
    ) ||
    !Number.isFinite(
      requestedEnd
    ) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalSize
  ) {
    return null;
  }

  return {
    start,
    end:
      Math.min(
        requestedEnd,
        totalSize - 1
      ),
  };
}


export async function GET(
  request: Request,
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


    // ========================================================
    // SERVER-SIDE PDF PROXY
    //
    // The private Supabase Storage URL is never exposed to
    // the browser. The branded /r/p/... URL stays visible.
    // ========================================================

    const {
      data:
        pdfBlob,
      error:
        downloadError,
    } =
      await admin
        .storage
        .from(
          "operational-reports"
        )
        .download(
          finalization
            .pdf_storage_path
        );


    if (
      downloadError ||
      !pdfBlob
    ) {
      console.error(
        "Public Production PDF download failed:",
        downloadError
      );

      return new NextResponse(
        "Unable to open report PDF.",
        {
          status:
            500,
        }
      );
    }


    const totalSize =
      pdfBlob.size;

    const filename =
      safeFilename(
        finalization
          .pdf_storage_path
          .split("/")
          .pop()
      );


    const baseHeaders = {
      "Content-Type":
        "application/pdf",

      "Content-Disposition":
        `inline; filename="${filename}"`,

      "Cache-Control":
        "private, no-store, max-age=0",

      "Accept-Ranges":
        "bytes",

      "X-Content-Type-Options":
        "nosniff",
    };


    const rangeHeader =
      request.headers
        .get(
          "range"
        );


    if (
      rangeHeader
    ) {
      const range =
        parseByteRange(
          rangeHeader,
          totalSize
        );

      if (!range) {
        return new NextResponse(
          null,
          {
            status:
              416,

            headers: {
              ...baseHeaders,

              "Content-Range":
                `bytes */${totalSize}`,
            },
          }
        );
      }


      const partialBlob =
        pdfBlob.slice(
          range.start,
          range.end + 1,
          "application/pdf"
        );

      const partialBytes =
        await partialBlob
          .arrayBuffer();


      return new NextResponse(
        partialBytes,
        {
          status:
            206,

          headers: {
            ...baseHeaders,

            "Content-Length":
              String(
                partialBlob.size
              ),

            "Content-Range":
              `bytes ${range.start}-${range.end}/${totalSize}`,
          },
        }
      );
    }


    const pdfBytes =
      await pdfBlob
        .arrayBuffer();


    return new NextResponse(
      pdfBytes,
      {
        status:
          200,

        headers: {
          ...baseHeaders,

          "Content-Length":
            String(
              totalSize
            ),
        },
      }
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
