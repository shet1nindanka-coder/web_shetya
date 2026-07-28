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
  const css = getInlineKatexCss();

  return html.replace(KATEX_CSS_MARKER, css ? `<style>${css}</style>` : "");
}
