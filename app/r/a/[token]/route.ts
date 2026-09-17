import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

function hashToken(
  token: string,
) {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function safeFilename(
  value: unknown,
) {
  return String(
    value ||
      "outlet-audit-report",
  )
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "-",
    )
    .replace(
      /-+/g,
      "-",
    );
}

function parseByteRange(
  value: string,
  totalSize: number,
) {
  const match =
    /^bytes=(\d*)-(\d*)$/i.exec(
      value.trim(),
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

  if (!startRaw) {
    const suffixLength =
      Number(endRaw);

    if (
      !Number.isFinite(
        suffixLength,
      ) ||
      suffixLength <= 0
    ) {
      return null;
    }

    const length =
      Math.min(
        suffixLength,
        totalSize,
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
    Number(startRaw);

  const requestedEnd =
    endRaw
      ? Number(endRaw)
      : totalSize - 1;

  if (
    !Number.isFinite(
      start,
    ) ||
    !Number.isFinite(
      requestedEnd,
    ) ||
    start < 0 ||
    requestedEnd <
      start ||
    start >=
      totalSize
  ) {
    return null;
  }

  return {
    start,

    end:
      Math.min(
        requestedEnd,
        totalSize - 1,
      ),
  };
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      token: string;
    }>;
  },
) {
  try {
    const {
      token,
    } =
      await params;

    const rawToken =
      String(
        token || "",
      ).trim();

    if (
      rawToken.length <
      32
    ) {
      return new NextResponse(
        "Report link is invalid.",
        {
          status: 400,
        },
      );
    }

    const admin =
      createAdminClient();

    const tokenHash =
      hashToken(
        rawToken,
      );

    const {
      data: share,
      error:
        shareError,
    } =
      await admin
        .from(
          "audit_report_shares",
        )
        .select(`
          id,
          audit_session_id,
          expires_at,
          revoked_at
        `)
        .eq(
          "token_hash",
          tokenHash,
        )
        .maybeSingle();

    if (
      shareError
    ) {
      console.error(
        "Public audit share lookup failed:",
        shareError,
      );

      return new NextResponse(
        "Unable to open report.",
        {
          status: 500,
        },
      );
    }

    if (!share) {
      return new NextResponse(
        "Report not found.",
        {
          status: 404,
        },
      );
    }

    if (
      share.revoked_at
    ) {
      return new NextResponse(
        "This report link has been revoked.",
        {
          status: 410,
        },
      );
    }

    const expiresAt =
      new Date(
        share.expires_at,
      );

    if (
      Number.isNaN(
        expiresAt.getTime(),
      ) ||
      Date.now() >
        expiresAt.getTime()
    ) {
      return new NextResponse(
        "This report link has expired.",
        {
          status: 410,
        },
      );
    }

    const {
      data: session,
      error:
        sessionError,
    } =
      await admin
        .from(
          "audit_sessions",
        )
        .select(`
          id,
          audit_number,
          status,
          pdf_storage_path
        `)
        .eq(
          "id",
          share.audit_session_id,
        )
        .maybeSingle();

    if (
      sessionError ||
      !session ||
      session.status !==
        "submitted" ||
      !session.pdf_storage_path
    ) {
      return new NextResponse(
        "Report not found.",
        {
          status: 404,
        },
      );
    }

    const {
      data: pdfBlob,
      error:
        downloadError,
    } =
      await admin.storage
        .from(
          "operational-reports",
        )
        .download(
          session.pdf_storage_path,
        );

    if (
      downloadError ||
      !pdfBlob
    ) {
      console.error(
        "Public audit PDF download failed:",
        downloadError,
      );

      return new NextResponse(
        "Unable to open report PDF.",
        {
          status: 500,
        },
      );
    }

    const totalSize =
      pdfBlob.size;

    const filename =
      `${safeFilename(
        session.audit_number,
      )}.pdf`;

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
      request.headers.get(
        "range",
      );

    if (rangeHeader) {
      const range =
        parseByteRange(
          rangeHeader,
          totalSize,
        );

      if (!range) {
        return new NextResponse(
          null,
          {
            status: 416,

            headers: {
              ...baseHeaders,

              "Content-Range":
                `bytes */${totalSize}`,
            },
          },
        );
      }

      const partialBlob =
        pdfBlob.slice(
          range.start,
          range.end + 1,
          "application/pdf",
        );

      const partialBytes =
        await partialBlob
          .arrayBuffer();

      return new NextResponse(
        partialBytes,
        {
          status: 206,

          headers: {
            ...baseHeaders,

            "Content-Length":
              String(
                partialBlob.size,
              ),

            "Content-Range":
              `bytes ${range.start}-${range.end}/${totalSize}`,
          },
        },
      );
    }

    const bytes =
      await pdfBlob
        .arrayBuffer();

    return new NextResponse(
      bytes,
      {
        status: 200,

        headers: {
          ...baseHeaders,

          "Content-Length":
            String(
              bytes.byteLength,
            ),
        },
      },
    );
  } catch (
    error: any
  ) {
    console.error(
      "Public audit report error:",
      error,
    );

    return new NextResponse(
      "Unable to open report.",
      {
        status: 500,
      },
    );
  }
}
