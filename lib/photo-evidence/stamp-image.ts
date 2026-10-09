type StampInput = {
  file: File;

  capturedAt: string;

  timezone: string;

  outletName: string;

  moduleLabel: string;

  subjectLabel: string;

  locationLine: string;
};


function zoneLabel(
  timezone: string,
) {
  if (
    timezone ===
    "Asia/Jakarta"
  ) {
    return "WIB";
  }

  if (
    timezone ===
    "Asia/Makassar"
  ) {
    return "WITA";
  }

  if (
    timezone ===
    "Asia/Jayapura"
  ) {
    return "WIT";
  }

  return timezone;
}


function timestampLabel(
  capturedAt: string,
  timezone: string,
) {
  const formatted =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          timezone,

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

        second:
          "2-digit",

        hour12:
          false,
      },
    )
      .format(
        new Date(
          capturedAt,
        ),
      )
      .replace(
        ",",
        " ·",
      );

  return `${formatted} ${zoneLabel(
    timezone,
  )}`;
}


async function loadImage(
  file: File,
) {
  const url =
    URL.createObjectURL(
      file,
    );

  try {
    const image =
      new Image();

    image.decoding =
      "async";

    await new Promise<
      void
    >(
      (
        resolve,
        reject,
      ) => {
        image.onload =
          () =>
            resolve();

        image.onerror =
          () =>
            reject(
              new Error(
                "Unable to decode camera photo.",
              ),
            );

        image.src =
          url;
      },
    );

    return image;
  } finally {
    URL.revokeObjectURL(
      url,
    );
  }
}


export async function stampEvidencePhoto({
  file,
  capturedAt,
  timezone,
  outletName,
  moduleLabel,
  subjectLabel,
  locationLine,
}: StampInput) {
  const image =
    await loadImage(
      file,
    );

  const MAX_DIMENSION =
    2200;

  const ratio =
    Math.min(
      1,
      MAX_DIMENSION /
        Math.max(
          image.naturalWidth,
          image.naturalHeight,
        ),
    );

  const width =
    Math.max(
      1,
      Math.round(
        image.naturalWidth *
          ratio,
      ),
    );

  const height =
    Math.max(
      1,
      Math.round(
        image.naturalHeight *
          ratio,
      ),
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      "2d",
    );

  if (!context) {
    throw new Error(
      "Unable to create photo canvas.",
    );
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height,
  );

  const fontSize =
    Math.max(
      24,
      Math.round(
        width *
          0.023,
      ),
    );

  const lineHeight =
    Math.round(
      fontSize *
        1.32,
    );

  const padding =
    Math.round(
      fontSize *
        0.8,
    );

  const lines = [
    timestampLabel(
      capturedAt,
      timezone,
    ),

    outletName,

    `${moduleLabel} · ${subjectLabel}`,

    locationLine,
  ];

  const overlayHeight =
    padding *
      2 +
    lineHeight *
      lines.length;

  context.fillStyle =
    "rgba(0,0,0,0.68)";

  context.fillRect(
    0,
    height -
      overlayHeight,
    width,
    overlayHeight,
  );

  context.font =
    `600 ${fontSize}px Arial, sans-serif`;

  context.fillStyle =
    "#ffffff";

  context.textBaseline =
    "top";

  lines.forEach(
    (
      line,
      index,
    ) => {
      context.fillText(
        line,
        padding,
        height -
          overlayHeight +
          padding +
          index *
            lineHeight,
        width -
          padding *
            2,
      );
    },
  );

  const blob =
    await new Promise<
      Blob
    >(
      (
        resolve,
        reject,
      ) => {
        canvas.toBlob(
          (
            value,
          ) => {
            if (
              !value
            ) {
              reject(
                new Error(
                  "Unable to render stamped photo.",
                ),
              );

              return;
            }

            resolve(
              value,
            );
          },

          "image/jpeg",

          0.9,
        );
      },
    );

  const baseName =
    file.name
      .replace(
        /\.[^.]+$/,
        "",
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-",
      )
      .slice(
        0,
        80,
      ) ||
    "photo";

  return new File(
    [
      blob,
    ],
    `${baseName}-evidence.jpg`,
    {
      type:
        "image/jpeg",

      lastModified:
        Date.now(),
    },
  );
}
