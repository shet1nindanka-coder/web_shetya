import { existsSync } from "node:fs";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";

// Структурные типы вместо импорта из puppeteer-core: пакет ставится только на
// сервере, а сборка и tsc должны проходить и без него.
type PdfPage = {
  setDefaultTimeout(ms: number): void;
  setContent(html: string, options: { waitUntil: "load"; timeout: number }): Promise<void>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
};

type PdfBrowser = {
  connected: boolean;
  newPage(): Promise<PdfPage>;
  close(): Promise<void>;
};

/*
 * HTML → PDF через headless Chromium (puppeteer-core, браузер системный).
 * Ленивый синглтон в globalThis, автозакрытие после простоя. Если браузер
 * недоступен — возвращаем null, роут отдаёт HTML-версию для печати.
 */

const IDLE_CLOSE_MS = 5 * 60_000;
const RENDER_TIMEOUT_MS = 60_000;

const CHROMIUM_CANDIDATES = [
  process.env.LESSON_PDF_CHROMIUM_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
].filter((candidate): candidate is string => Boolean(candidate));

declare global {
  var __lessonPdfBrowser__: PdfBrowser | null | undefined;
  var __lessonPdfIdleTimer__: ReturnType<typeof setTimeout> | null | undefined;
}

function scheduleIdleClose() {
  if (global.__lessonPdfIdleTimer__) {
    clearTimeout(global.__lessonPdfIdleTimer__);
  }

  global.__lessonPdfIdleTimer__ = setTimeout(() => {
    const browser = global.__lessonPdfBrowser__;
    global.__lessonPdfBrowser__ = null;
    global.__lessonPdfIdleTimer__ = null;

    if (browser) {
      void browser.close().catch(() => undefined);
    }
  }, IDLE_CLOSE_MS);

  // Не держим процесс живым ради таймера.
  global.__lessonPdfIdleTimer__.unref?.();
}

async function getBrowser(): Promise<PdfBrowser | null> {
  if (global.__lessonPdfBrowser__?.connected) {
    return global.__lessonPdfBrowser__;
  }

  const executablePath = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    logErrorEvent(
      "lesson_pdf.renderer_unavailable",
      { candidates: CHROMIUM_CANDIDATES.length },
      undefined,
      "No Chromium executable found for lesson PDF rendering."
    );
    return null;
  }

  try {
    // Динамический импорт через Function: puppeteer-core — опциональная зависимость,
    // её нет в локальном dev-окружении, и ни tsc, ни webpack не должны её резолвить.
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<unknown>;
    const puppeteerModule = (await dynamicImport("puppeteer-core")) as {
      default: {
        launch(options: { executablePath: string; headless: boolean; args: string[] }): Promise<PdfBrowser>;
      };
    };
    const browser = await puppeteerModule.default.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });

    global.__lessonPdfBrowser__ = browser;
    logInfoEvent("lesson_pdf.browser_started", { executablePath });

    return browser;
  } catch (error) {
    logErrorEvent(
      "lesson_pdf.renderer_unavailable",
      { executablePath },
      error instanceof Error ? error : undefined,
      "Failed to launch Chromium for lesson PDF rendering."
    );
    return null;
  }
}

/** null = рендерер недоступен (нет браузера/памяти) — вызывающий отдаёт HTML-фолбэк. */
export async function renderPdfFromHtml(html: string): Promise<Buffer | null> {
  if (process.env.LESSON_PDF_RENDERER === "html") {
    return null;
  }

  const browser = await getBrowser();

  if (!browser) {
    return null;
  }

  let page: PdfPage | null = null;

  try {
    page = await browser.newPage();
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    await page.setContent(html, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });
    // Шрифты KaTeX инлайновые, но подгружаются асинхронно: раскладку формул
    // (и повтор знака при переносе) считаем только после них.
    await page
      .evaluate(() =>
        document.fonts.ready.then(() => {
          const apply = (window as unknown as { __applyMathBreaks?: (root: Document) => void }).__applyMathBreaks;
          apply?.(document);
        })
      )
      .catch(() => undefined);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "18mm", left: "15mm", right: "15mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;display:flex;justify-content:space-between;font-size:8px;color:#a6abb3;padding:0 15mm;font-family:sans-serif;"><span>ШБЗ Школа</span><span>стр. <span class="pageNumber"></span> из <span class="totalPages"></span></span></div>',
      timeout: RENDER_TIMEOUT_MS
    });

    return Buffer.from(pdf);
  } catch (error) {
    logErrorEvent(
      "lesson_pdf.render_failed",
      {},
      error instanceof Error ? error : undefined,
      "Lesson PDF rendering failed."
    );
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }

    scheduleIdleClose();
  }
}
