const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;
const RETRY_QUALITY = 0.62;
const SKIP_BELOW = 450 * 1024;
const RETRY_ABOVE = 850 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };

    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to compress image."));
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
    file.size <= SKIP_BELOW
  ) {
    return file;
  }

  try {
    const image = await loadImage(file);

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(sourceWidth, sourceHeight)
    );

    const width = Math.max(
      1,
      Math.round(sourceWidth * scale)
    );

    const height = Math.max(
      1,
      Math.round(sourceHeight * scale)
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return file;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    let blob = await canvasToBlob(
      canvas,
      JPEG_QUALITY
    );

    if (blob.size > RETRY_ABOVE) {
      blob = await canvasToBlob(
        canvas,
        RETRY_QUALITY
      );
    }

    // Jangan gunakan hasil compression kalau malah lebih besar.
    if (
      file.type === "image/jpeg" &&
      blob.size >= file.size
    ) {
      return file;
    }

    const baseName =
      file.name.replace(/\.[^.]+$/, "") ||
      "operational-photo";

    return new File(
      [blob],
      `${baseName}.jpg`,
      {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      }
    );
  } catch (error) {
    // Optimization tidak boleh menghalangi operasional.
    console.warn("Photo compression skipped:", error);
    return file;
  }
}
