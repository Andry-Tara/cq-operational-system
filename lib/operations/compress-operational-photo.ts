const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;
const RETRY_QUALITY = 0.62;
const SKIP_BELOW_BYTES = 450 * 1024;
const RETRY_ABOVE_BYTES = 850 * 1024;

function loadImage(
  file: File
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error("Unable to decode image.")
      );
    };

    image.src = url;
  });
}

function toJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Unable to compress image."
            )
          );
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export async function compressOperationalPhoto(
  file: File
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (
    file.type === "image/jpeg" &&
    file.size <= SKIP_BELOW_BYTES
  ) {
    return file;
  }

  try {
    const image = await loadImage(file);

    const sourceWidth =
      image.naturalWidth || image.width;

    const sourceHeight =
      image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(
      1,
      MAX_DIMENSION /
        Math.max(
          sourceWidth,
          sourceHeight
        )
    );

    const width = Math.max(
      1,
      Math.round(
        sourceWidth * scale
      )
    );

    const height = Math.max(
      1,
      Math.round(
        sourceHeight * scale
      )
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      width,
      height
    );

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    let blob =
      await toJpegBlob(
        canvas,
        JPEG_QUALITY
      );

    if (
      blob.size >
      RETRY_ABOVE_BYTES
    ) {
      blob =
        await toJpegBlob(
          canvas,
          RETRY_QUALITY
        );
    }

    if (
      file.type === "image/jpeg" &&
      blob.size >= file.size
    ) {
      return file;
    }

    const baseName =
      file.name.replace(
        /\.[^.]+$/,
        ""
      ) || "operational-photo";

    return new File(
      [blob],
      `${baseName}.jpg`,
      {
        type: "image/jpeg",
        lastModified:
          file.lastModified ||
          Date.now(),
      }
    );
  } catch (error) {
    console.warn(
      "Photo compression skipped:",
      error
    );

    // Compression failure must never
    // block outlet operations.
    return file;
  }
}
