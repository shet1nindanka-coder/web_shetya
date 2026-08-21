import { readFile } from "node:fs/promises";
import path from "node:path";

/* Шрифт логотипа «ШБЗШкола» (Montserrat 900) для серверных ImageResponse:
   favicon, apple-touch-icon и og:image собираются из той же буквы/лока, что и
   в интерфейсе, поэтому гарнитура должна быть одна. */
export const LOGO_FONT_PATH = path.join(process.cwd(), "assets", "fonts", "montserrat", "Montserrat-Black.ttf");

export const LOGO_BRAND = "#16C79F";
export const LOGO_INK = "#0A0A0A";
export const LOGO_DARK_BG = "#101212";

let cached: Promise<ArrayBuffer> | undefined;

export function loadLogoFont(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = readFile(LOGO_FONT_PATH).then((buffer) =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
  }
  return cached;
}

export function logoFontOptions(data: ArrayBuffer) {
  return [{ name: "Montserrat", data, weight: 900 as const, style: "normal" as const }];
}
