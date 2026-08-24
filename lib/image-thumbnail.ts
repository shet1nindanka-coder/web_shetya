import { logWarnEvent } from "@/lib/logger";

/**
 * Превью для фото решений. Ученик снимает домашку телефоном — исходник весит
 * мегабайты, а в галерее ревью показывается плиткой 64–96 px. Отдаём под такую
 * плитку webp-миниатюру вместо оригинала.
 */
export const THUMBNAIL_WIDTH = 320;

const THUMBNAILABLE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export function isThumbnailable(mimeType: string) {
  return THUMBNAILABLE_MIME.has(mimeType.toLowerCase());
}

export async function buildThumbnail(source: Buffer, context: Record<string, unknown>) {
  try {
    // sharp тянет нативный биндинг — грузим только когда превью реально нужно.
    const sharp = (await import("sharp")).default;

    const body = await sharp(source)
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    return { body, mimeType: "image/webp" };
  } catch (error) {
    logWarnEvent("file.thumbnail.failed", context, error, "Thumbnail generation failed; serving original file.");

    return null;
  }
}
