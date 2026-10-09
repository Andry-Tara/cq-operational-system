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


export type QaPdfCriterion = {
  label: string;
  status: string;
  note: string | null;
};


export type QaPdfEvidence = {
  mimeType: string | null;
  bytes: Uint8Array | null;

  captureSource:
    | string
    | null;

  capturedAt:
    | string
    | null;

  uploadedAt:
    | string
    | null;

  locationStatus:
    | string
    | null;
};


export type QaPdfMenu = {
  sequenceNo: number;

  name: string;

  serviceSeconds:
    | number
    | null;

  serviceStandardSeconds: number;

  serviceStatus:
    | string
    | null;

  score: number;

  criteria:
    QaPdfCriterion[];

  evidence:
    QaPdfEvidence[];
};


export type QaFoodPdfInput = {
  qaNumber: string;
  businessDate: string;

  outletName: string;
  outletCode: string;
  timezone: string;

  auditorName: string;

  score: number;
  maxScore: number;

  pointsLost: number;

  standardMenuCount: number;
  needsCorrectionCount: number;

  onTimeCount: number;
  lateCount: number;

  menus:
    QaPdfMenu[];
};


const PAGE = {
  width: 595.28,
  height: 841.89,

  marginX: 36,

  top: 38,
  bottom: 38,
};


const BRAND = {
  cq: {
    logoPath:
      "brand/chongqing-hotpot.png",

    systemName:
      "CHONG QING OPERATIONAL SYSTEM",
  },

  dd: {
    logoPath:
      "brand/dingding-hotpot.png",

    systemName:
      "DING DING OPERATIONAL SYSTEM",
  },
} as const;


const C = {
  red:
    rgb(
      0.73,
      0.08,
      0.08,
    ),

  text:
    rgb(
      0.08,
      0.08,
      0.09,
    ),

  black:
    rgb(
      0.025,
      0.04,
      0.065,
    ),

  muted:
    rgb(
      0.48,
      0.49,
      0.52,
    ),

  line:
    rgb(
      0.88,
      0.88,
      0.88,
    ),

  accentLine:
    rgb(
      0.88,
      0.81,
      0.66,
    ),

  soft:
    rgb(
      0.975,
      0.972,
      0.958,
    ),

  white:
    rgb(
      1,
      1,
      1,
    ),

  green:
    rgb(
      0.04,
      0.48,
      0.33,
    ),

  greenSoft:
    rgb(
      0.92,
      0.98,
      0.95,
    ),

  amber:
    rgb(
      0.68,
      0.40,
      0.04,
    ),

  amberSoft:
    rgb(
      1,
      0.97,
      0.88,
    ),
};


function resolveBrand(
  outletName: string,
) {
  return /^DD(?:\s|$)/i.test(
    String(
      outletName || "",
    ).trim(),
  )
    ? BRAND.dd
    : BRAND.cq;
}


async function loadBrandLogo(
  pdf: PDFDocument,
  logoPath: string,
) {
  try {
    const bytes =
      await readFile(
        join(
          process.cwd(),
          "public",
          logoPath,
        ),
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
      "QA PDF brand logo error:",
      error,
    );

    return null;
  }
}


function safe(
  value: unknown,
) {
  return String(
    value ?? "-",
  )
    .replace(
      /[–—]/g,
      "-",
    )
    .replace(
      /[‘’]/g,
      "'",
    )
    .replace(
      /[“”]/g,
      '"',
    )
    .replace(
      /≤/g,
      "<=",
    )
    .replace(
      /•/g,
      "-",
    )
    .replace(
      /✓/g,
      "OK",
    )
    .replace(
      /[^\x09\x0A\x0D\x20-\xFF]/g,
      "?",
    );
}


function formatBusinessDate(
  value: string,
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    );

  if (!match) {
    return safe(
      value,
    );
  }

  const date =
    new Date(
      Date.UTC(
        Number(
          match[1],
        ),

        Number(
          match[2],
        ) - 1,

        Number(
          match[3],
        ),

        12,
      ),
    );

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "long",

      year:
        "numeric",

      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}


function formatDateTime(
  value:
    | string
    | null,
  timezone: string,
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        timeZone:
          timezone ||
          "Asia/Jakarta",
      },
    ).format(
      new Date(
        value,
      ),
    );

  } catch {
    return safe(
      value,
    );
  }
}


function duration(
  raw:
    | number
    | null,
) {
  const seconds =
    Math.max(
      0,
      Math.floor(
        Number(
          raw ?? 0,
        ),
      ),
    );

  return `${String(
    Math.floor(
      seconds / 60,
    ),
  ).padStart(
    2,
    "0",
  )}:${String(
    seconds % 60,
  ).padStart(
    2,
    "0",
  )}`;
}


function wrap(
  value: string,
  font: any,
  size: number,
  maxWidth: number,
) {
  const words =
    safe(
      value,
    )
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  const output:
    string[] =
    [];

  let current =
    "";

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
      ) <=
      maxWidth
    ) {
      current =
        candidate;

    } else {
      if (current) {
        output.push(
          current,
        );
      }

      current =
        word;
    }
  }

  if (current) {
    output.push(
      current,
    );
  }

  return output.length
    ? output
    : [""];
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


export async function buildQaFoodReportPdf(
  input:
    QaFoodPdfInput,
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
  }


  function ensureSpace(
    required:
      number,
  ) {
    if (
      y -
      required <
      PAGE.bottom +
      15
    ) {
      newPage();
    }
  }


  function label(
    value: string,
    x: number,
    yy: number,
  ) {
    page.drawText(
      safe(
        value,
      ).toUpperCase(),
      {
        x,

        y:
          yy,

        size:
          6.2,

        font:
          bold,

        color:
          C.muted,
      },
    );
  }


  function drawWrapped(
    value: string,
    x: number,
    size: number,
    maxWidth: number,
    font = regular,
    color = C.text,
    lineHeight =
      size + 3,
  ) {
    const lines =
      wrap(
        value,
        font,
        size,
        maxWidth,
      );

    for (
      const line
      of lines
    ) {
      page.drawText(
        line,
        {
          x,
          y,

          size,
          font,
          color,
        },
      );

      y -=
        lineHeight;
    }
  }


  function metaCard(
    x: number,
    yy: number,
    width: number,
    title: string,
    value: string,
  ) {
    const height =
      39;


    page.drawRectangle({
      x,

      y:
        yy -
        height,

      width,
      height,

      color:
        C.soft,

      borderColor:
        C.accentLine,

      borderWidth:
        0.7,
    });


    label(
      title,
      x + 8,
      yy - 12,
    );


    const lines =
      wrap(
        value,
        bold,
        7.3,
        width - 16,
      );


    let valueY =
      yy - 27;


    for (
      const line
      of lines.slice(
        0,
        2,
      )
    ) {
      page.drawText(
        line,
        {
          x:
            x + 8,

          y:
            valueY,

          size:
            7.3,

          font:
            bold,

          color:
            C.text,
        },
      );

      valueY -=
        8;
    }
  }


  function statCard(
    x: number,
    yy: number,
    width: number,
    title: string,
    value: string,
    dark = false,
  ) {
    const height =
      43;


    page.drawRectangle({
      x,

      y:
        yy -
        height,

      width,
      height,

      color:
        dark
          ? C.black
          : C.soft,

      borderColor:
        dark
          ? C.black
          : C.accentLine,

      borderWidth:
        0.8,
    });


    page.drawText(
      safe(
        title,
      ).toUpperCase(),
      {
        x:
          x + 8,

        y:
          yy - 12,

        size:
          5.8,

        font:
          bold,

        color:
          dark
            ? rgb(
                0.73,
                0.73,
                0.73,
              )
            : C.muted,
      },
    );


    page.drawText(
      safe(
        value,
      ),
      {
        x:
          x + 8,

        y:
          yy - 31,

        size:
          dark
            ? 13
            : 11,

        font:
          bold,

        color:
          dark
            ? C.white
            : C.text,
      },
    );
  }


  function sectionTitle(
    value: string,
  ) {
    ensureSpace(
      30,
    );

    page.drawText(
      safe(
        value,
      ).toUpperCase(),
      {
        x:
          PAGE.marginX,

        y,

        size:
          11,

        font:
          bold,

        color:
          C.text,
      },
    );

    y -=
      23;
  }


  // ========================================================
  // PAGE 1 HEADER — SAME FAMILY AS OUTLET AUDIT
  // ========================================================

  page.drawText(
    brand.systemName,
    {
      x:
        PAGE.marginX,

      y,

      size:
        7.5,

      font:
        bold,

      color:
        C.red,
    },
  );


  if (
    brandLogo
  ) {
    const size =
      contain(
        brandLogo.width,
        brandLogo.height,
        96,
        46,
      );

    page.drawImage(
      brandLogo,
      {
        x:
          PAGE.width -
          PAGE.marginX -
          size.width,

        y:
          y -
          size.height +
          9,

        width:
          size.width,

        height:
          size.height,
      },
    );
  }


  y -=
    23;


  page.drawText(
    "QA FOOD STANDARD REPORT",
    {
      x:
        PAGE.marginX,

      y,

      size:
        7.5,

      font:
        bold,

      color:
        C.muted,
    },
  );


  y -=
    28;


  page.drawText(
    safe(
      input.outletName,
    ),
    {
      x:
        PAGE.marginX,

      y,

      size:
        24,

      font:
        bold,

      color:
        C.text,
    },
  );


  y -=
    22;


  page.drawText(
    safe(
      input.qaNumber,
    ),
    {
      x:
        PAGE.marginX,

      y,

      size:
        7,

      font:
        mono,

      color:
        C.muted,
    },
  );


  y -=
    22;


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
      C.accentLine,
  });


  y -=
    22;


  // ========================================================
  // META ROW
  // ========================================================

  const metaGap =
    5;


  const metaWidth =
    (
      contentWidth -
      metaGap * 3
    ) / 4;


  metaCard(
    PAGE.marginX,
    y,
    metaWidth,
    "Assessment Date",
    formatBusinessDate(
      input.businessDate,
    ),
  );


  metaCard(
    PAGE.marginX +
      (
        metaWidth +
        metaGap
      ),
    y,
    metaWidth,
    "Auditor",
    input.auditorName,
  );


  metaCard(
    PAGE.marginX +
      (
        metaWidth +
        metaGap
      ) * 2,
    y,
    metaWidth,
    "Service Standard",
    "<= 13 Minutes",
  );


  metaCard(
    PAGE.marginX +
      (
        metaWidth +
        metaGap
      ) * 3,
    y,
    metaWidth,
    "Menus Tested",
    String(
      input.menus.length,
    ),
  );


  y -=
    53;


  // ========================================================
  // SCORE ROW — MATCH AUDIT CARD STYLE
  // ========================================================

  const scoreGap =
    4;


  const scoreWidth =
    (
      contentWidth -
      scoreGap * 4
    ) / 5;


  statCard(
    PAGE.marginX,
    y,
    scoreWidth,
    "Menus",
    String(
      input.menus.length,
    ),
  );


  statCard(
    PAGE.marginX +
      (
        scoreWidth +
        scoreGap
      ),
    y,
    scoreWidth,
    "Standard",
    String(
      input.standardMenuCount,
    ),
  );


  statCard(
    PAGE.marginX +
      (
        scoreWidth +
        scoreGap
      ) * 2,
    y,
    scoreWidth,
    "Correction",
    String(
      input.needsCorrectionCount,
    ),
  );


  statCard(
    PAGE.marginX +
      (
        scoreWidth +
        scoreGap
      ) * 3,
    y,
    scoreWidth,
    "Points Lost",
    `-${input.pointsLost}`,
  );


  statCard(
    PAGE.marginX +
      (
        scoreWidth +
        scoreGap
      ) * 4,
    y,
    scoreWidth,
    "Current",
    `${input.score}/${input.maxScore}`,
    true,
  );


  y -=
    60;


  // ========================================================
  // QUICK PERFORMANCE SUMMARY
  // ========================================================

  label(
    "Performance Summary",
    PAGE.marginX,
    y,
  );


  y -=
    15;


  page.drawText(
    `On Time   ${input.onTimeCount}/10`,
    {
      x:
        PAGE.marginX,

      y,

      size:
        7,

      font:
        bold,

      color:
        C.text,
    },
  );


  page.drawText(
    `Late   ${input.lateCount}/10`,
    {
      x:
        PAGE.marginX +
        120,

      y,

      size:
        7,

      font:
        bold,

      color:
        input.lateCount
        ? C.amber
        : C.text,
    },
  );


  y -=
    28;


  sectionTitle(
    "Menu Assessment",
  );


  // ========================================================
  // MENU ASSESSMENTS
  // ========================================================

  for (
    const menu
    of input.menus
  ) {
    const failedCriteria =
      menu.criteria.filter(
        (
          criterion,
        ) =>
          criterion.status ===
          "NOT_STANDARD",
      );


    const evidenceRows =
      menu.evidence.filter(
        (
          evidence,
        ) =>
          Boolean(
            evidence.bytes,
          ),
      );


    const estimatedHeight =
      225 +
      (
        failedCriteria.length
          ? 35
          : 0
      ) +
      (
        evidenceRows.length
          ? 135
          : 0
      );


    ensureSpace(
      estimatedHeight,
    );


    // ------------------------------------------------------
    // BLACK HEADER BAR — SAME AS AUDIT FINDING BAR
    // ------------------------------------------------------

    const barHeight =
      20;


    page.drawRectangle({
      x:
        PAGE.marginX,

      y:
        y -
        barHeight,

      width:
        contentWidth,

      height:
        barHeight,

      color:
        C.black,
    });


    page.drawText(
      `MENU ${String(
        menu.sequenceNo,
      ).padStart(
        2,
        "0",
      )}`,
      {
        x:
          PAGE.marginX +
          8,

        y:
          y -
          13,

        size:
          6.5,

        font:
          bold,

        color:
          C.white,
      },
    );


    const badgeText =
      `${menu.score}/10`;


    const badgeWidth =
      46;


    page.drawRectangle({
      x:
        PAGE.width -
        PAGE.marginX -
        badgeWidth -
        4,

      y:
        y -
        17,

      width:
        badgeWidth,

      height:
        13,

      color:
        menu.score ===
        10
          ? C.greenSoft
          : C.amberSoft,
    });


    page.drawText(
      badgeText,
      {
        x:
          PAGE.width -
          PAGE.marginX -
          badgeWidth +
          7,

        y:
          y -
          13,

        size:
          6.3,

        font:
          bold,

        color:
          menu.score ===
          10
            ? C.green
            : C.amber,
      },
    );


    y -=
      34;


    // ------------------------------------------------------
    // MENU TITLE
    // ------------------------------------------------------

    drawWrapped(
      menu.name,
      PAGE.marginX +
        8,
      11.5,
      contentWidth -
        16,
      bold,
      C.text,
      14,
    );


    y -=
      5;


    // ------------------------------------------------------
    // SERVICE DATA
    // ------------------------------------------------------

    const serviceColumns = [
      {
        label:
          "SERVICE TIME",

        value:
          duration(
            menu.serviceSeconds,
          ),
      },

      {
        label:
          "SLA",

        value:
          `<= ${duration(
            menu.serviceStandardSeconds,
          )}`,
      },

      {
        label:
          "RESULT",

        value:
          menu.serviceStatus ||
          "-",
      },
    ];


    const serviceWidth =
      contentWidth /
      3;


    serviceColumns.forEach(
      (
        item,
        index,
      ) => {
        const x =
          PAGE.marginX +
          serviceWidth *
          index +
          8;


        label(
          item.label,
          x,
          y,
        );


        page.drawText(
          safe(
            item.value,
          ),
          {
            x,

            y:
              y - 14,

            size:
              7.5,

            font:
              bold,

            color:
              item.label ===
                "RESULT" &&
              item.value !==
                "STANDARD"
                ? C.amber
                : C.text,
          },
        );
      },
    );


    y -=
      39;


    // ------------------------------------------------------
    // QUALITY CRITERIA — CLEAN AUDIT STYLE, NO BIG CARDS
    // ------------------------------------------------------

    label(
      "Quality Criteria",
      PAGE.marginX +
        8,
      y,
    );


    y -=
      15;


    const columnGap =
      22;


    const columnWidth =
      (
        contentWidth -
        columnGap -
        16
      ) / 2;


    for (
      let index = 0;
      index <
      menu.criteria.length;
      index += 2
    ) {
      const row = [
        menu.criteria[
          index
        ],

        menu.criteria[
          index + 1
        ],
      ];


      let rowHeight =
        18;


      if (
        row.some(
          (
            criterion,
          ) =>
            criterion?.status ===
              "NOT_STANDARD" &&
            criterion.note,
        )
      ) {
        rowHeight =
          36;
      }


      ensureSpace(
        rowHeight +
        5,
      );


      row.forEach(
        (
          criterion,
          column,
        ) => {
          if (
            !criterion
          ) {
            return;
          }


          const failed =
            criterion.status ===
            "NOT_STANDARD";


          const x =
            PAGE.marginX +
            8 +
            column *
              (
                columnWidth +
                columnGap
              );


          page.drawText(
            safe(
              criterion.label,
            ),
            {
              x,

              y,

              size:
                7.1,

              font:
                bold,

              color:
                C.text,
            },
          );


          page.drawText(
            failed
              ? "0/1"
              : "1/1",
            {
              x:
                x +
                columnWidth -
                64,

              y,

              size:
                6.5,

              font:
                bold,

              color:
                C.muted,
            },
          );


          page.drawText(
            safe(
              criterion.status,
            ),
            {
              x:
                x +
                columnWidth -
                39,

              y,

              size:
                5.9,

              font:
                bold,

              color:
                failed
                  ? C.amber
                  : C.green,
            },
          );


          if (
            failed &&
            criterion.note
          ) {
            const noteLines =
              wrap(
                `Note: ${criterion.note}`,
                regular,
                6.2,
                columnWidth,
              );


            let noteY =
              y - 12;


            for (
              const line
              of noteLines.slice(
                0,
                2,
              )
            ) {
              page.drawText(
                line,
                {
                  x,

                  y:
                    noteY,

                  size:
                    6.2,

                  font:
                    regular,

                  color:
                    C.amber,
                },
              );


              noteY -=
                7;
            }
          }
        },
      );


      y -=
        rowHeight;
    }


    // ------------------------------------------------------
    // CORRECTION NOTE
    // ------------------------------------------------------

    if (
      failedCriteria.length ||
      menu.serviceStatus !==
        "STANDARD"
    ) {
      y -=
        4;


      page.drawRectangle({
        x:
          PAGE.marginX +
          8,

        y:
          y - 21,

        width:
          contentWidth -
          16,

        height:
          21,

        color:
          C.amberSoft,
      });


      page.drawText(
        `NEEDS CORRECTION  ·  POINTS LOST -${
          10 -
          menu.score
        }`,
        {
          x:
            PAGE.marginX +
            16,

          y:
            y - 14,

          size:
            6.7,

          font:
            bold,

          color:
            C.amber,
        },
      );


      y -=
        31;
    }


    // ------------------------------------------------------
    // EVIDENCE
    // ------------------------------------------------------

    if (
      evidenceRows.length
    ) {
      ensureSpace(
        145,
      );


      label(
        "Evidence",
        PAGE.marginX +
          8,
        y,
      );


      y -=
        13;


      const photoGap =
        12;


      const photoMaxWidth =
        evidenceRows.length >
        1
          ? (
              contentWidth -
              photoGap -
              16
            ) / 2
          : 185;


      let photoX =
        PAGE.marginX +
        8;


      let lowestY =
        y;


      for (
        const evidence
        of evidenceRows.slice(
          0,
          2,
        )
      ) {
        if (
          !evidence.bytes
        ) {
          continue;
        }


        try {
          let image;


          if (
            evidence.mimeType ===
            "image/png"
          ) {
            image =
              await pdf.embedPng(
                evidence.bytes,
              );

          } else if (
            evidence.mimeType ===
              "image/jpeg" ||
            evidence.mimeType ===
              "image/jpg"
          ) {
            image =
              await pdf.embedJpg(
                evidence.bytes,
              );

          } else {
            continue;
          }


          const size =
            contain(
              image.width,
              image.height,
              photoMaxWidth,
              112,
            );


          page.drawImage(
            image,
            {
              x:
                photoX,

              y:
                y -
                size.height,

              width:
                size.width,

              height:
                size.height,
            },
          );


          const source =
            String(
              evidence.captureSource ||
              "",
            );


          const location =
            String(
              evidence.locationStatus ||
              "",
            );


          const meta =
            [
              source ||
              null,

              location &&
              location !==
                source
                ? location
                : null,

              formatDateTime(
                evidence.capturedAt ||
                evidence.uploadedAt,
                input.timezone,
              ),
            ]
              .filter(
                Boolean,
              )
              .join(
                " · ",
              );


          const metaLines =
            wrap(
              meta,
              regular,
              5.8,
              photoMaxWidth,
            );


          let metaY =
            y -
            size.height -
            9;


          for (
            const line
            of metaLines.slice(
              0,
              2,
            )
          ) {
            page.drawText(
              line,
              {
                x:
                  photoX,

                y:
                  metaY,

                size:
                  5.8,

                font:
                  regular,

                color:
                  C.muted,
              },
            );


            metaY -=
              7;
          }


          lowestY =
            Math.min(
              lowestY,
              metaY,
            );


          photoX +=
            photoMaxWidth +
            photoGap;

        } catch {
          // Keep PDF usable even if one evidence image
          // cannot be rendered.
        }
      }


      y =
        lowestY -
        12;
    }


    y -=
      8;


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
        0.6,

      color:
        C.line,
    });


    y -=
      20;
  }


  // ========================================================
  // CORRECTION SUMMARY
  // ========================================================

  const corrections =
    input.menus.filter(
      (
        menu,
      ) =>
        menu.score <
        10 ||
        menu.serviceStatus !==
          "STANDARD",
    );


  if (
    corrections.length
  ) {
    ensureSpace(
      95 +
      corrections.length *
        30,
    );


    sectionTitle(
      "Correction Summary",
    );


    for (
      const menu
      of corrections
    ) {
      ensureSpace(
        50,
      );


      page.drawRectangle({
        x:
          PAGE.marginX,

        y:
          y - 18,

        width:
          contentWidth,

        height:
          18,

        color:
          C.black,
      });


      page.drawText(
        `MENU ${String(
          menu.sequenceNo,
        ).padStart(
          2,
          "0",
        )}`,
        {
          x:
            PAGE.marginX +
            7,

          y:
            y - 12,

          size:
            6,

          font:
            bold,

          color:
            C.white,
        },
      );


      page.drawText(
        `${menu.score}/10`,
        {
          x:
            PAGE.width -
            PAGE.marginX -
            41,

          y:
            y - 12,

          size:
            6.2,

          font:
            bold,

          color:
            C.amberSoft,
        },
      );


      y -=
        30;


      drawWrapped(
        menu.name,
        PAGE.marginX +
          8,
        8.2,
        contentWidth -
          16,
        bold,
      );


      const issues =
        menu.criteria.filter(
          (
            criterion,
          ) =>
            criterion.status ===
            "NOT_STANDARD",
        );


      for (
        const criterion
        of issues
      ) {
        const detail =
          criterion.note
            ? `${criterion.label}: ${criterion.note}`
            : criterion.label;


        drawWrapped(
          `- ${detail}`,
          PAGE.marginX +
            16,
          6.8,
          contentWidth -
            24,
          regular,
          C.amber,
          9,
        );
      }


      y -=
        10;
    }
  }


  // ========================================================
  // ACKNOWLEDGEMENT — SAME COMPACT STYLE AS AUDIT
  // ========================================================

  ensureSpace(
    150,
  );


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
      0.6,

    color:
      C.line,
  });


  y -=
    24;


  label(
    "Acknowledgement",
    PAGE.marginX,
    y,
  );


  y -=
    20;


  page.drawText(
    "QA assessment result acknowledgement and signature",
    {
      x:
        PAGE.marginX,

      y,

      size:
        10,

      font:
        bold,

      color:
        C.text,
    },
  );


  y -=
    27;


  const signatureTitles = [
    "AUDITOR / ASSESSOR",
    "LEADER FOH",
    "LEADER BOH",
    "MANAGER / ASST. MANAGER",
  ];


  const signatureNames = [
    input.auditorName,
    "",
    "",
    "",
  ];


  const signatureGap =
    5;


  const signatureWidth =
    (
      contentWidth -
      signatureGap *
        3
    ) / 4;


  const signatureHeight =
    78;


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
          C.white,

        borderColor:
          C.line,

        borderWidth:
          0.8,
      });


      page.drawRectangle({
        x,

        y:
          y - 20,

        width:
          signatureWidth,

        height:
          20,

        color:
          C.soft,

        borderColor:
          C.line,

        borderWidth:
          0.8,
      });


      const titleLines =
        wrap(
          title,
          bold,
          5.6,
          signatureWidth -
            10,
        );


      let titleY =
        y - 9;


      for (
        const line
        of titleLines.slice(
          0,
          2,
        )
      ) {
        page.drawText(
          line,
          {
            x:
              x + 6,

            y:
              titleY,

            size:
              5.6,

            font:
              bold,

            color:
              C.text,
          },
        );


        titleY -=
          7;
      }


      const signatureY =
        y -
        signatureHeight +
        22;


      page.drawLine({
        start: {
          x:
            x + 8,

          y:
            signatureY,
        },

        end: {
          x:
            x +
            signatureWidth -
            8,

          y:
            signatureY,
        },

        thickness:
          0.5,

        color:
          C.muted,
      });


      if (
        signatureNames[
          index
        ]
      ) {
        page.drawText(
          safe(
            signatureNames[
              index
            ],
          ),
          {
            x:
              x + 7,

            y:
              signatureY -
              12,

            size:
              6.4,

            font:
              bold,

            color:
              C.text,
          },
        );
      }
    },
  );


  // ========================================================
  // FOOTER — SAME VISUAL FAMILY AS AUDIT
  // ========================================================

  const pages =
    pdf.getPages();


  pages.forEach(
    (
      currentPage,
      index,
    ) => {
      currentPage.drawLine({
        start: {
          x:
            PAGE.marginX,
          y:
            25,
        },

        end: {
          x:
            PAGE.width -
            PAGE.marginX,
          y:
            25,
        },

        thickness:
          0.5,

        color:
          C.accentLine,
      });


      currentPage.drawText(
        safe(
          input.qaNumber,
        ),
        {
          x:
            PAGE.marginX,

          y:
            13,

          size:
            5.8,

          font:
            mono,

          color:
            C.muted,
        },
      );


      const pageText =
        `Page ${index + 1} / ${pages.length}`;


      currentPage.drawText(
        pageText,
        {
          x:
            PAGE.width -
            PAGE.marginX -
            regular.widthOfTextAtSize(
              pageText,
              5.8,
            ),

          y:
            13,

          size:
            5.8,

          font:
            regular,

          color:
            C.muted,
        },
      );
    },
  );


  return pdf.save();
}
