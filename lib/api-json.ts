import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

/**
 * Next сжимает только рендер-ответы (HTML и RSC); route handlers из app/api/**
 * уходят к клиенту как есть — без Content-Encoding. На больших JSON (списки
 * уведомлений, срезы статистики) это лишние килобайты в каждом запросе,
 * поэтому сжимаем их здесь сами.
 */
const MIN_COMPRESS_BYTES = 1024;

// Уровень 4 у brotli — компромисс «сжатие/латентность» для динамики:
// по объёму он на уровне gzip -9, но кодирует в разы быстрее, чем brotli -11.
const BROTLI_QUALITY = 4;

type Encoding = "br" | "gzip" | null;

function pickEncoding(request: Request): Encoding {
  const header = request.headers.get("accept-encoding");

  if (!header) {
    return null;
  }

  const accepted = header.toLowerCase();

  if (accepted.includes("br")) {
    return "br";
  }

  if (accepted.includes("gzip")) {
    return "gzip";
  }

  return null;
}

/**
 * JSON-ответ со сжатием по Accept-Encoding клиента.
 * Совместим по сигнатуре с NextResponse.json: `init` пробрасывается как есть.
 */
export async function jsonResponse(request: Request, data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(data);
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const raw = Buffer.from(body, "utf8");
  const encoding = raw.byteLength >= MIN_COMPRESS_BYTES ? pickEncoding(request) : null;

  if (!encoding) {
    headers.set("Content-Length", String(raw.byteLength));

    return new Response(raw, { ...init, headers });
  }

  const compressed =
    encoding === "br"
      ? await brotliAsync(raw, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength
          }
        })
      : await gzipAsync(raw);

  headers.set("Content-Encoding", encoding);
  headers.set("Content-Length", String(compressed.byteLength));
  // Прокси и CDN должны различать сжатый и несжатый вариант одного URL.
  const vary = headers.get("Vary");
  headers.set("Vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");

  return new Response(compressed, { ...init, headers });
}
