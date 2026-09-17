import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

export type AuditPdfPhoto = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  bytes: Uint8Array | null;
};

export type AuditPdfFinding = {
  id: string;
  questionCode: string;
  questionText: string;
  areaName: string;
  categoryName: string;
  risk: string;
  notes: string | null;
  photos: AuditPdfPhoto[];
};

export type AuditPdfInput = {
  auditNumber: string;
  auditDate: string;
  outletName: string;
  outletCode: string;
  auditorName: string;
  startedAt: string | null;
  submittedAt: string | null;

  hasScoring: boolean;
  scoreBefore: number | null;
  auditPenalty: number | null;
  scoreAfter: number | null;

  findings: AuditPdfFinding[];
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 36,
  top: 38,
  bottom: 36,
};

const BRAND = {
  cq: {
    key: "cq",
    logoPath:
      "brand/chongqing-hotpot.png",
    systemName:
      "CHONG QING OPERATIONAL SYSTEM",
  },

  dd: {
    key: "dd",
    logoPath:
      "brand/dingding-hotpot.png",
    systemName:
      "DING DING OPERATIONAL SYSTEM",
  },
} as const;

function resolveBrand(
  outletName: string,
) {
  const normalized =
    String(
      outletName || "",
    )
      .trim()
      .toUpperCase();

  return /^DD(?:\s|$)/.test(
    normalized,
  )
    ? BRAND.dd
    : BRAND.cq;
}

async function loadBrandLogo(
  pdf: PDFDocument,
  logoPath: string,
) {
  try {
    const absolutePath =
      join(
        process.cwd(),
        "public",
        logoPath,
      );

    const bytes =
      await readFile(
        absolutePath,
      );

    try {
      return await pdf.embedPng(
        bytes,
      );
    } catch {
      return await pdf.embedJpg(
        bytes,
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Audit PDF brand logo error:",
      error,
    );

    return null;
  }
}

const COLORS = {
  red: rgb(0.73, 0.08, 0.08),
  redSoft: rgb(0.99, 0.94, 0.94),

  green: rgb(0.04, 0.48, 0.33),
  greenSoft: rgb(0.91, 0.98, 0.95),

  orange: rgb(0.78, 0.34, 0.08),
  orangeSoft: rgb(1, 0.96, 0.91),

  amber: rgb(0.68, 0.40, 0.04),
  amberSoft: rgb(1, 0.98, 0.90),

  text: rgb(0.08, 0.08, 0.09),
  muted: rgb(0.48, 0.49, 0.52),
  line: rgb(0.88, 0.88, 0.88),
  soft: rgb(0.97, 0.97, 0.97),
  white: rgb(1, 1, 1),
};

function pdfSafe(
  value: unknown,
) {
  return String(
    value ?? "-",
  )
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-")
    .replace(/→/g, "->")
    .replace(/✓/g, "OK")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function formatBusinessDate(
  value: string,
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    );

  if (!match) {
    return pdfSafe(value);
  }

  const date =
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        12,
      ),
    );

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

function formatDateTime(
  value: string | null,
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      },
    ).format(
      new Date(value),
    );
  } catch {
    return pdfSafe(value);
  }
}

function wrapText(
  text: string,
  font: any,
  size: number,
  maxWidth: number,
) {
  const normalized =
    pdfSafe(text)
      .replace(/\s+/g, " ")
      .trim();

  if (!normalized) {
    return ["-"];
  }

  const words =
    normalized.split(" ");

  const lines: string[] = [];
  let current = "";

  for (
    const word
    of words
  ) {
    const candidate =
      current
        ? `${current} ${word}`
        : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size,
      ) <= maxWidth
    ) {
      current =
        candidate;
    } else {
      if (current) {
        lines.push(
          current,
        );
      }

      current =
        word;
    }
  }

  if (current) {
    lines.push(
      current,
    );
  }

  return lines;
}

function drawLines(
  page: any,
  lines: string[],
  {
    x,
    y,
    font,
    size,
    color,
    lineHeight,
  }: {
    x: number;
    y: number;
    font: any;
    size: number;
    color: any;
    lineHeight: number;
  },
) {
  let cursor =
    y;

  for (
    const line
    of lines
  ) {
    page.drawText(
      pdfSafe(line),
      {
        x,
        y: cursor,
        font,
        size,
        color,
      },
    );

    cursor -=
      lineHeight;
  }

  return cursor;
}

function riskStyle(
  risk: string,
) {
  if (
    risk === "critical"
  ) {
    return {
      text:
        COLORS.red,
      fill:
        COLORS.redSoft,
    };
  }

  if (
    risk === "major"
  ) {
    return {
      text:
        COLORS.orange,
      fill:
        COLORS.orangeSoft,
    };
  }

  if (
    risk === "medium"
  ) {
    return {
      text:
        COLORS.amber,
      fill:
        COLORS.amberSoft,
    };
  }

  return {
    text:
      COLORS.text,
    fill:
      COLORS.soft,
  };
}

async function embedPhoto(
  pdf: PDFDocument,
  photo: AuditPdfPhoto,
) {
  if (
    !photo.bytes
  ) {
    return null;
  }

  try {
    const mime =
      String(
        photo.mimeType ??
          "",
      ).toLowerCase();

    if (
      mime.includes("png")
    ) {
      return await pdf.embedPng(
        photo.bytes,
      );
    }

    if (
      mime.includes(
        "jpeg",
      ) ||
      mime.includes("jpg")
    ) {
      return await pdf.embedJpg(
        photo.bytes,
      );
    }

    // Fallback for historical rows with missing MIME type.
    try {
      return await pdf.embedJpg(
        photo.bytes,
      );
    } catch {
      return await pdf.embedPng(
        photo.bytes,
      );
    }
  } catch {
    return null;
  }
}

function contain(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio =
    Math.min(
      maxWidth /
        sourceWidth,
      maxHeight /
        sourceHeight,
    );

  return {
    width:
      sourceWidth *
      ratio,

    height:
      sourceHeight *
      ratio,
  };
}

export async function buildAuditReportPdf(
  input: AuditPdfInput,
) {
  const pdf =
    await PDFDocument.create();

  const brand =
    resolveBrand(
      input.outletName,
    );

  const brandLogo =
    await loadBrandLogo(
      pdf,
      brand.logoPath,
    );

  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold,
    );

  const mono =
    await pdf.embedFont(
      StandardFonts.Courier,
    );

  let page =
    pdf.addPage([
      PAGE.width,
      PAGE.height,
    ]);

  let y =
    PAGE.height -
    PAGE.top;

  const contentWidth =
    PAGE.width -
    PAGE.marginX * 2;

  function newPage() {
    page =
      pdf.addPage([
        PAGE.width,
        PAGE.height,
      ]);

    y =
      PAGE.height -
      PAGE.top;

    return page;
  }

  function ensureSpace(
    height: number,
  ) {
    if (
      y - height <
      PAGE.bottom
    ) {
      newPage();
    }
  }

  function label(
    text: string,
    x: number,
    yy: number,
  ) {
    page.drawText(
      pdfSafe(
        text,
      ).toUpperCase(),
      {
        x,
        y: yy,
        size: 7,
        font: bold,
        color:
          COLORS.muted,
      },
    );
  }

  function statCard(
    x: number,
    yy: number,
    width: number,
    title: string,
    value: string,
  ) {
    const height =
      54;

    page.drawRectangle({
      x,
      y:
        yy - height,
      width,
      height,
      color:
        COLORS.soft,
      borderColor:
        COLORS.line,
      borderWidth: 1,
    });

    page.drawText(
      pdfSafe(
        title,
      ).toUpperCase(),
      {
        x: x + 11,
        y: yy - 17,
        size: 7,
        font: bold,
        color:
          COLORS.muted,
      },
    );

    page.drawText(
      pdfSafe(
        value,
      ),
      {
        x: x + 11,
        y: yy - 39,
        size: 15,
        font: bold,
        color:
          COLORS.text,
      },
    );
  }

  // ==========================================================
  // HEADER
  // ==========================================================

  page.drawText(
    brand.systemName,
    {
      x:
        PAGE.marginX,
      y,
      size: 8,
      font: bold,
      color:
        COLORS.red,
    },
  );

  if (
    brandLogo
  ) {
    const logoMaxWidth =
      96;

    const logoMaxHeight =
      46;

    const logoSize =
      contain(
        brandLogo.width,
        brandLogo.height,
        logoMaxWidth,
        logoMaxHeight,
      );

    page.drawImage(
      brandLogo,
      {
        x:
          PAGE.width -
          PAGE.marginX -
          logoSize.width,

        y:
          y -
          logoSize.height +
          9,

        width:
          logoSize.width,

        height:
          logoSize.height,
      },
    );
  }

  y -= 24;

  page.drawText(
    "OUTLET AUDIT REPORT",
    {
      x:
        PAGE.marginX,
      y,
      size: 8,
      font: bold,
      color:
        COLORS.muted,
    },
  );

  y -= 28;

  page.drawText(
    pdfSafe(
      input.outletName,
    ),
    {
      x:
        PAGE.marginX,
      y,
      size: 25,
      font: bold,
      color:
        COLORS.text,
    },
  );

  y -= 23;

  page.drawText(
    pdfSafe(
      input.auditNumber,
    ),
    {
      x:
        PAGE.marginX,
      y,
      size: 10,
      font: mono,
      color:
        COLORS.muted,
    },
  );

  y -= 25;

  page.drawLine({
    start: {
      x:
        PAGE.marginX,
      y,
    },
    end: {
      x:
        PAGE.width -
        PAGE.marginX,
      y,
    },
    thickness: 1,
    color:
      COLORS.line,
  });

  y -= 27;

  const infoWidth =
    contentWidth / 4;

  const infos = [
    [
      "AUDIT DATE",
      formatBusinessDate(
        input.auditDate,
      ),
    ],
    [
      "AUDITOR",
      input.auditorName,
    ],
    [
      "STARTED",
      formatDateTime(
        input.startedAt,
      ),
    ],
    [
      "SUBMITTED",
      formatDateTime(
        input.submittedAt,
      ),
    ],
  ];

  infos.forEach(
    (
      [title, value],
      index,
    ) => {
      const x =
        PAGE.marginX +
        infoWidth *
          index;

      label(
        title,
        x,
        y,
      );

      const lines =
        wrapText(
          value,
          bold,
          9,
          infoWidth -
            12,
        );

      drawLines(
        page,
        lines.slice(
          0,
          2,
        ),
        {
          x,
          y: y - 15,
          font: bold,
          size: 9,
          color:
            COLORS.text,
          lineHeight: 11,
        },
      );
    },
  );

  y -= 54;

  // ==========================================================
  // SCORE SUMMARY
  // ==========================================================

  const scoreBefore =
    input.hasScoring &&
    input.scoreBefore !==
      null
      ? String(
          input.scoreBefore,
        )
      : "N/A";

  const penalty =
    input.hasScoring &&
    input.auditPenalty !==
      null
      ? `-${input.auditPenalty}`
      : "N/A";

  const scoreAfter =
    input.hasScoring &&
    input.scoreAfter !==
      null
      ? `${input.scoreAfter}/100`
      : "NOT SCORED";

  const counts = {
    minor:
      input.findings.filter(
        (finding) =>
          finding.risk ===
          "minor",
      ).length,

    medium:
      input.findings.filter(
        (finding) =>
          finding.risk ===
          "medium",
      ).length,

    major:
      input.findings.filter(
        (finding) =>
          finding.risk ===
          "major",
      ).length,

    critical:
      input.findings.filter(
        (finding) =>
          finding.risk ===
          "critical",
      ).length,
  };

  const areaCount =
    new Set(
      input.findings.map(
        (finding) =>
          finding.areaName,
      ),
    ).size;

  const cardGap =
    7;

  const cardWidth =
    (
      contentWidth -
      cardGap * 4
    ) / 5;

  const stats = [
    [
      "FINDINGS",
      String(
        input.findings.length,
      ),
    ],
    [
      "AREAS",
      String(
        areaCount,
      ),
    ],
    [
      "PREVIOUS",
      scoreBefore,
    ],
    [
      "PENALTY",
      penalty,
    ],
    [
      "CURRENT",
      scoreAfter,
    ],
  ];

  stats.forEach(
    (
      [title, value],
      index,
    ) => {
      statCard(
        PAGE.marginX +
          index *
            (
              cardWidth +
              cardGap
            ),
        y,
        cardWidth,
        title,
        value,
      );
    },
  );

  y -= 70;

  if (
    !input.hasScoring
  ) {
    page.drawRectangle({
      x:
        PAGE.marginX,
      y: y - 30,
      width:
        contentWidth,
      height: 30,
      color:
        COLORS.amberSoft,
      borderColor:
        rgb(
          0.94,
          0.80,
          0.42,
        ),
      borderWidth: 1,
    });

    page.drawText(
      "PRE-SCORING AUDIT - FINDING PENALTIES WERE NOT APPLIED.",
      {
        x:
          PAGE.marginX +
          12,
        y: y - 19,
        size: 8,
        font: bold,
        color:
          COLORS.amber,
      },
    );

    y -= 44;
  }

  page.drawText(
    "RISK BREAKDOWN",
    {
      x:
        PAGE.marginX,
      y,
      size: 8,
      font: bold,
      color:
        COLORS.muted,
    },
  );

  y -= 20;

  const riskItems = [
    [
      "Minor",
      counts.minor,
      2,
    ],
    [
      "Medium",
      counts.medium,
      5,
    ],
    [
      "Major",
      counts.major,
      10,
    ],
    [
      "Critical",
      counts.critical,
      20,
    ],
  ] as const;

  for (
    const [
      risk,
      count,
      weight,
    ]
    of riskItems
  ) {
    page.drawText(
      risk,
      {
        x:
          PAGE.marginX,
        y,
        size: 9,
        font: bold,
        color:
          COLORS.text,
      },
    );

    const riskPenalty =
      count * weight;

    const calculation =
      input.hasScoring
        ? `${count} x -${weight} = ${
            riskPenalty > 0
              ? `-${riskPenalty}`
              : "0"
          }`
        : `${count} x -${weight} = NOT APPLIED`;

    page.drawText(
      calculation,
      {
        x:
          PAGE.width -
          PAGE.marginX -
          150,
        y,
        size: 8,
        font: mono,
        color:
          COLORS.muted,
      },
    );

    y -= 16;
  }

  y -= 15;

  page.drawLine({
    start: {
      x:
        PAGE.marginX,
      y,
    },
    end: {
      x:
        PAGE.width -
        PAGE.marginX,
      y,
    },
    thickness: 1,
    color:
      COLORS.line,
  });

  y -= 28;

  page.drawText(
    "AUDIT FINDINGS",
    {
      x:
        PAGE.marginX,
      y,
      size: 18,
      font: bold,
      color:
        COLORS.text,
    },
  );

  y -= 25;

  if (
    !input.findings.length
  ) {
    page.drawText(
      "No findings recorded.",
      {
        x:
          PAGE.marginX,
        y,
        size: 10,
        font: regular,
        color:
          COLORS.muted,
      },
    );
  }

  // ==========================================================
  // FINDINGS
  // ==========================================================

  for (
    let index = 0;
    index <
    input.findings.length;
    index += 1
  ) {
    const finding =
      input.findings[index];

    const titleLines =
      wrapText(
        finding.questionText,
        bold,
        13,
        contentWidth -
          28,
      );

    const notesLines =
      wrapText(
        finding.notes ||
          "No notes",
        regular,
        9,
        contentWidth -
          28,
      );

    const approximateHeight =
      120 +
      titleLines.length *
        16 +
      Math.min(
        notesLines.length,
        8,
      ) *
        12;

    ensureSpace(
      Math.min(
        approximateHeight,
        260,
      ),
    );

    const style =
      riskStyle(
        finding.risk,
      );

    // Finding heading
    page.drawRectangle({
      x:
        PAGE.marginX,
      y: y - 28,
      width:
        contentWidth,
      height: 28,
      color:
        COLORS.soft,
      borderColor:
        COLORS.line,
      borderWidth: 1,
    });

    page.drawText(
      pdfSafe(
        `FINDING ${index + 1} - ${finding.areaName}`,
      ).toUpperCase(),
      {
        x:
          PAGE.marginX +
          12,
        y: y - 18,
        size: 7,
        font: bold,
        color:
          COLORS.muted,
      },
    );

    const riskLabel =
      pdfSafe(
        finding.risk,
      ).toUpperCase();

    const riskWidth =
      Math.max(
        48,
        bold.widthOfTextAtSize(
          riskLabel,
          7,
        ) + 18,
      );

    page.drawRectangle({
      x:
        PAGE.width -
        PAGE.marginX -
        riskWidth -
        8,
      y: y - 23,
      width:
        riskWidth,
      height: 17,
      color:
        style.fill,
      borderColor:
        style.text,
      borderWidth:
        0.6,
    });

    page.drawText(
      riskLabel,
      {
        x:
          PAGE.width -
          PAGE.marginX -
          riskWidth,
        y: y - 18,
        size: 7,
        font: bold,
        color:
          style.text,
      },
    );

    y -= 49;

    drawLines(
      page,
      titleLines,
      {
        x:
          PAGE.marginX +
          10,
        y,
        font: bold,
        size: 13,
        color:
          COLORS.text,
        lineHeight: 16,
      },
    );

    y -=
      titleLines.length *
        16 +
      2;

    page.drawText(
      pdfSafe(
        finding.questionCode,
      ),
      {
        x:
          PAGE.marginX +
          10,
        y,
        size: 8,
        font: mono,
        color:
          COLORS.muted,
      },
    );

    y -= 22;

    label(
      "CATEGORY",
      PAGE.marginX +
        10,
      y,
    );

    page.drawText(
      pdfSafe(
        finding.categoryName,
      ),
      {
        x:
          PAGE.marginX +
          10,
        y: y - 14,
        size: 9,
        font: bold,
        color:
          COLORS.text,
      },
    );

    y -= 38;

    label(
      "NOTES",
      PAGE.marginX +
        10,
      y,
    );

    y -= 15;

    for (
      const line
      of notesLines
    ) {
      ensureSpace(
        14,
      );

      page.drawText(
        pdfSafe(line),
        {
          x:
            PAGE.marginX +
            10,
          y,
          size: 9,
          font: regular,
          color:
            COLORS.text,
        },
      );

      y -= 12;
    }

    y -= 8;

    // Evidence
    if (
      finding.photos.length
    ) {
      ensureSpace(
        230,
      );

      label(
        "EVIDENCE",
        PAGE.marginX +
          10,
        y,
      );

      y -= 16;

      for (
        const photo
        of finding.photos
      ) {
        const image =
          await embedPhoto(
            pdf,
            photo,
          );

        if (!image) {
          const unsupported =
            `Evidence: ${photo.filename || "photo"} (image format could not be embedded)`;

          const lines =
            wrapText(
              unsupported,
              regular,
              8,
              contentWidth -
                20,
            );

          drawLines(
            page,
            lines,
            {
              x:
                PAGE.marginX +
                10,
              y,
              font: regular,
              size: 8,
              color:
                COLORS.muted,
              lineHeight: 10,
            },
          );

          y -=
            lines.length *
              10 +
            8;

          continue;
        }

        const maxWidth =
          contentWidth -
          20;

        const maxHeight =
          215;

        const fitted =
          contain(
            image.width,
            image.height,
            maxWidth,
            maxHeight,
          );

        ensureSpace(
          fitted.height +
            34,
        );

        page.drawRectangle({
          x:
            PAGE.marginX +
            9,
          y:
            y -
            fitted.height -
            1,
          width:
            fitted.width +
            2,
          height:
            fitted.height +
            2,
          borderColor:
            COLORS.line,
          borderWidth: 1,
        });

        page.drawImage(
          image,
          {
            x:
              PAGE.marginX +
              10,
            y:
              y -
              fitted.height,
            width:
              fitted.width,
            height:
              fitted.height,
          },
        );

        y -=
          fitted.height +
          13;

        const filenameLines =
          wrapText(
            photo.filename ||
              "Audit evidence",
            regular,
            7,
            contentWidth -
              20,
          );

        drawLines(
          page,
          filenameLines.slice(
            0,
            2,
          ),
          {
            x:
              PAGE.marginX +
              10,
            y,
            font: regular,
            size: 7,
            color:
              COLORS.muted,
            lineHeight: 9,
          },
        );

        y -=
          Math.min(
            filenameLines.length,
            2,
          ) *
            9 +
          12;
      }
    } else {
      page.drawText(
        "No photo attached.",
        {
          x:
            PAGE.marginX +
            10,
          y,
          size: 8,
          font: regular,
          color:
            COLORS.muted,
        },
      );

      y -= 18;
    }

    page.drawLine({
      start: {
        x:
          PAGE.marginX,
        y,
      },
      end: {
        x:
          PAGE.width -
          PAGE.marginX,
        y,
      },
      thickness:
        0.7,
      color:
        COLORS.line,
    });

    y -= 24;
  }

  // ==========================================================
  // SIGNATURE / ACKNOWLEDGEMENT
  // ==========================================================

  ensureSpace(
    175,
  );

  y -= 8;

  page.drawLine({
    start: {
      x:
        PAGE.marginX,
      y,
    },
    end: {
      x:
        PAGE.width -
        PAGE.marginX,
      y,
    },
    thickness: 1,
    color:
      COLORS.line,
  });

  y -= 28;

  page.drawText(
    "ACKNOWLEDGEMENT",
    {
      x:
        PAGE.marginX,
      y,
      size: 8,
      font: bold,
      color:
        COLORS.muted,
    },
  );

  y -= 20;

  page.drawText(
    "Audit result acknowledgement and signature",
    {
      x:
        PAGE.marginX,
      y,
      size: 12,
      font: bold,
      color:
        COLORS.text,
    },
  );

  y -= 26;

  const signatureGap =
    6;

  const signatureWidth =
    (
      contentWidth -
      signatureGap * 3
    ) / 4;

  const signatureHeight =
    105;

  const signatureTitles = [
    "AUDITOR / ASSESSOR",
    "LEADER FOH",
    "LEADER BOH",
    "MANAGER / ASST. MANAGER",
  ];

  signatureTitles.forEach(
    (
      title,
      index,
    ) => {
      const x =
        PAGE.marginX +
        index *
          (
            signatureWidth +
            signatureGap
          );

      page.drawRectangle({
        x,
        y:
          y -
          signatureHeight,

        width:
          signatureWidth,

        height:
          signatureHeight,

        color:
          COLORS.white,

        borderColor:
          COLORS.line,

        borderWidth: 1,
      });

      page.drawRectangle({
        x,
        y:
          y -
          27,

        width:
          signatureWidth,

        height: 27,

        color:
          COLORS.soft,

        borderColor:
          COLORS.line,

        borderWidth: 1,
      });

      const titleLines =
        wrapText(
          title,
          bold,
          7,
          signatureWidth -
            12,
        );

      drawLines(
        page,
        titleLines.slice(
          0,
          2,
        ),
        {
          x:
            x + 7,

          y:
            y - 11,

          font: bold,

          size: 7,

          color:
            COLORS.text,

          lineHeight: 9,
        },
      );

      // Signature line
      page.drawLine({
        start: {
          x:
            x + 10,

          y:
            y -
            signatureHeight +
            26,
        },

        end: {
          x:
            x +
            signatureWidth -
            10,

          y:
            y -
            signatureHeight +
            26,
        },

        thickness:
          0.6,

        color:
          COLORS.muted,
      });

      const personName =
        index === 0
          ? input.auditorName
          : "";

      if (
        personName
      ) {
        const nameLines =
          wrapText(
            personName,
            bold,
            7.5,
            signatureWidth -
              16,
          );

        drawLines(
          page,
          nameLines.slice(
            0,
            2,
          ),
          {
            x:
              x + 8,

            y:
              y -
              signatureHeight +
              14,

            font: bold,

            size: 7.5,

            color:
              COLORS.text,

            lineHeight: 8,
          },
        );
      }
    },
  );

  y -=
    signatureHeight +
    20;

  // ==========================================================
  // FOOTER
  // ==========================================================

  const pages =
    pdf.getPages();

  pages.forEach(
    (
      pdfPage,
      index,
    ) => {
      pdfPage.drawLine({
        start: {
          x:
            PAGE.marginX,
          y: 25,
        },
        end: {
          x:
            PAGE.width -
            PAGE.marginX,
          y: 25,
        },
        thickness:
          0.5,
        color:
          COLORS.line,
      });

      pdfPage.drawText(
        pdfSafe(
          input.auditNumber,
        ),
        {
          x:
            PAGE.marginX,
          y: 13,
          size: 7,
          font: mono,
          color:
            COLORS.muted,
        },
      );

      const pageText =
        `Page ${index + 1} / ${pages.length}`;

      const pageTextWidth =
        regular.widthOfTextAtSize(
          pageText,
          7,
        );

      pdfPage.drawText(
        pageText,
        {
          x:
            PAGE.width -
            PAGE.marginX -
            pageTextWidth,
          y: 13,
          size: 7,
          font: regular,
          color:
            COLORS.muted,
        },
      );
    },
  );

  return await pdf.save();
}
