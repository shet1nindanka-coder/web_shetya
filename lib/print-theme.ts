import { readFileSync } from "node:fs";
import path from "node:path";
import { logWarnEvent } from "@/lib/logger";

/*
 * Единая печатная система ШБЗ: инлайн KaTeX-ресурсов для раздатки.
 * katex.min.css читается из node_modules, woff2-шрифты зашиваются base64 —
 * документ полностью самодостаточен, формулы выглядят одинаково везде.
 */

export const KATEX_CSS_MARKER = "<!--KATEX-CSS-->";

let cachedKatexCss: string | null | undefined;

function loadKatexCss(): string | null {
  const distDir = path.join(process.cwd(), "node_modules", "katex", "dist");
  const rawCss = readFileSync(path.join(distDir, "katex.min.css"), "utf8");

  // src:url(fonts/KaTeX_X.woff2) format("woff2"),url(...woff)...  →  data-URL, только woff2.
  return rawCss.replace(
    /src:url\(fonts\/(KaTeX_[\w-]+)\.woff2\) format\("woff2"\)[^;}]*/g,
    (_match, fontName: string) => {
      const fontData = readFileSync(path.join(distDir, "fonts", `${fontName}.woff2`)).toString("base64");
      return `src:url(data:font/woff2;base64,${fontData}) format("woff2")`;
    }
  );
}

let cachedLogoFontCss: string | null | undefined;

/* @font-face гарнитуры Montserrat (текст раздатки + логотип «ШБЗШкола» в 900):
   файлы зашиваются base64, чтобы раздатка не зависела от шрифтов на машине с Chromium. */
const PRINT_FONT_FACES: Array<[string, number]> = [
  ["Montserrat-Regular.ttf", 400],
  ["Montserrat-Medium.ttf", 500],
  ["Montserrat-SemiBold.ttf", 600],
  ["Montserrat-Bold.ttf", 700],
  ["Montserrat-Black.ttf", 900]
];

function loadLogoFontCss(): string {
  const fontDir = path.join(process.cwd(), "assets", "fonts", "montserrat");
  return PRINT_FONT_FACES.map(([file, weight]) => {
    const fontData = readFileSync(path.join(fontDir, file)).toString("base64");
    return `@font-face{font-family:"Montserrat";font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${fontData}) format("truetype")}`;
  }).join("");
}

export function getInlineLogoFontCss(): string {
  if (cachedLogoFontCss === undefined) {
    try {
      cachedLogoFontCss = loadLogoFontCss();
    } catch (error) {
      cachedLogoFontCss = null;
      logWarnEvent(
        "lesson_pdf.logo_font_failed",
        {},
        error instanceof Error ? error : undefined,
        "Failed to inline the logo font for print documents."
      );
    }
  }

  return cachedLogoFontCss ?? "";
}

export function getInlineKatexCss(): string {
  if (cachedKatexCss === undefined) {
    try {
      cachedKatexCss = loadKatexCss();
    } catch (error) {
      cachedKatexCss = null;
      logWarnEvent(
        "lesson_pdf.katex_css_failed",
        {},
        error instanceof Error ? error : undefined,
        "Failed to inline KaTeX CSS for print documents."
      );
    }
  }

  return cachedKatexCss ?? "";
}

/** Вставляет инлайн-CSS KaTeX в HTML раздатки (маркер в <head>). */
export function embedKatexAssets(html: string): string {
  const css = [getInlineKatexCss(), getInlineLogoFontCss()].filter(Boolean).join("\n");

  return html.replace(KATEX_CSS_MARKER, css ? `<style>${css}</style>` : "");
}
