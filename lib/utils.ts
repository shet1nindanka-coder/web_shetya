import { HomeworkNumberStatus, UserRole } from "@prisma/client";

const singleLineControlChars = /[\u0000-\u001F\u007F]+/g;
const multilineControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g;
const repeatedWhitespace = /\s+/g;
export const MAX_USER_NAME_LENGTH = 120;
export const MAX_LOGIN_LENGTH = 254;
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export const homeworkStatusMeta: Record<
  HomeworkNumberStatus,
  {
    label: string;
    shortLabel: string;
    cardClassName: string;
    buttonClassName: string;
    subtleClassName: string;
  }
> = {
  GREEN: {
    label: "Решен с первого раза",
    shortLabel: "Зеленый",
    cardClassName: "ui-status-surface ui-status-green",
    buttonClassName: "ui-status-option ui-status-green",
    subtleClassName: "ui-status-surface ui-status-green"
  },
  YELLOW: {
    label: "Исправлен после самопроверки",
    shortLabel: "Желтый",
    cardClassName: "ui-status-surface ui-status-yellow",
    buttonClassName: "ui-status-option ui-status-yellow",
    subtleClassName: "ui-status-surface ui-status-yellow"
  },
  RED: {
    label: "Нужна помощь преподавателя",
    shortLabel: "Красный",
    cardClassName: "ui-status-surface ui-status-red",
    buttonClassName: "ui-status-option ui-status-red",
    subtleClassName: "ui-status-surface ui-status-red"
  }
};

export const allowedUploadExtensions = [".pdf", ".docx", ".png", ".jpg", ".jpeg"];

export const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "image/png",
  "image/jpeg"
]);

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function roleHome(role: UserRole) {
  if (role === UserRole.TEACHER) {
    return "/teacher";
  }

  if (role === UserRole.DEVELOPER) {
    return "/developer/topics";
  }

  return "/student";
}

export function normalizeSingleLineText(value: string) {
  return value.replace(singleLineControlChars, " ").replace(repeatedWhitespace, " ").trim();
}

export function normalizeMultilineText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(multilineControlChars, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function normalizeLoginInput(value: string) {
  return normalizeSingleLineText(value).toLowerCase();
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Без даты";
  }

  const date = value instanceof Date ? value : new Date(value);

  return dateFormatter.format(date);
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "Без даты";
  }

  const date = value instanceof Date ? value : new Date(value);

  return dateTimeFormatter.format(date);
}

export function toIsoDateTimeString(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} Б`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export function completionPercent(done: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((done / total) * 100);
}

/**
 * Нормализованный вид номера: без ведущих нулей («010203» → «10203», «000» → «0»).
 * По нему номера сравниваются и дедуплицируются; записанный вид хранится как набран.
 */
export function normalizeHomeworkNumber(value: string) {
  return value.trim().replace(/^0+(?=.)/, "");
}

/**
 * Численное сравнение номеров-строк: «2» < «10», ведущие нули не влияют.
 * Без Number(): сравнение по длине нормализованного вида и лексикографике
 * корректно для цифровых строк любой длины.
 */
export function compareHomeworkNumbers(left: string, right: string) {
  const a = normalizeHomeworkNumber(left);
  const b = normalizeHomeworkNumber(right);

  if (a.length !== b.length) {
    return a.length - b.length;
  }

  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Близнецы: номер из нового списка совпадает с уже сохранённым с точностью до
 * ведущих нулей, но записан иначе («010203» при существующем «10203»). Формально
 * для @@unique это разные строки, по смыслу — один номер; сохранение отклоняется.
 */
export function findHomeworkNumberTwins(existingNumbers: string[], nextNumbers: string[]) {
  const byNormalized = new Map<string, string>();

  for (const existing of existingNumbers) {
    byNormalized.set(normalizeHomeworkNumber(existing), existing);
  }

  const twins: Array<{ existing: string; typed: string }> = [];

  for (const typed of nextNumbers) {
    const existing = byNormalized.get(normalizeHomeworkNumber(typed));

    if (existing !== undefined && existing !== typed) {
      twins.push({ existing, typed });
    }
  }

  return twins;
}

export function parseNumbersInput(input: string) {
  const normalizedInput = input.replace(/[‐‑‒–—―−﹘﹣－]/g, "-");
  const matches = Array.from(
    normalizedInput.matchAll(/(^|[\s,;]+)(\d+\s*-\s*\d+|\d+)(?=$|[\s,;]+)/g),
    (match) => match[2]
  );

  if (!matches.length) {
    return [];
  }

  // Ограничение размера защищает от опечаток вроде «1-100000000», которые иначе
  // синхронно развернут гигантский Set и попытаются вставить миллионы строк,
  // заблокировав единственный инстанс.
  const MAX_NUMBERS = 2000;
  // Ключ — нормализованный вид, значение — как набрано: «01, 1» — один номер,
  // выигрывает первый набранный вариант.
  const numbers = new Map<string, string>();

  const addNumber = (recorded: string) => {
    const normalized = normalizeHomeworkNumber(recorded);

    if (normalized === "0" || numbers.has(normalized)) {
      return;
    }

    numbers.set(normalized, recorded);
  };

  for (const match of matches) {
    if (numbers.size >= MAX_NUMBERS) {
      break;
    }

    if (match.includes("-")) {
      const [rawStart = "", rawEnd = ""] = match.split("-").map((value) => value.trim());

      // Границы длиннее 15 цифр не влезают в точные целые — почти наверняка опечатка.
      if (!rawStart || !rawEnd || rawStart.length > 15 || rawEnd.length > 15) {
        continue;
      }

      const startValue = Number(rawStart);
      const endValue = Number(rawEnd);

      if (startValue <= 0 || endValue <= 0) {
        continue;
      }

      const start = Math.min(startValue, endValue);
      const end = Math.max(startValue, endValue);

      // Гигантский диапазон — почти наверняка опечатка: пропускаем его целиком.
      if (end - start >= MAX_NUMBERS) {
        continue;
      }

      // Ширина берётся у границ: «000001-000005» разворачивается в шестизначные
      // номера. При границах разной ширины действует большая.
      const width = Math.max(rawStart.length, rawEnd.length);

      for (let current = start; current <= end && numbers.size < MAX_NUMBERS; current += 1) {
        addNumber(String(current).padStart(width, "0"));
      }

      continue;
    }

    addNumber(match.trim());
  }

  return Array.from(numbers.values()).sort(compareHomeworkNumbers);
}

export function getFileExtension(fileName: string) {
  const normalizedName = fileName.split("?")[0]?.split("#")[0] ?? fileName;
  const extensionIndex = normalizedName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return "";
  }

  return normalizedName.slice(extensionIndex).toLowerCase();
}

export function isPdfMime(mimeType: string) {
  return mimeType === "application/pdf";
}

export function isImageMime(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg";
}

export function isOfficeMime(mimeType: string) {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export function getMimeTypeFromExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getStatusCounts(statuses: Array<HomeworkNumberStatus | null | undefined>) {
  const counts = {
    GREEN: 0,
    YELLOW: 0,
    RED: 0
  };

  for (const status of statuses) {
    if (status) {
      counts[status] += 1;
    }
  }

  return counts;
}

export function isHomeworkOverdue(deadlineAt: string | null, isCompleted: boolean, now: number = Date.now()) {
  if (!deadlineAt || isCompleted) {
    return false;
  }

  const deadline = new Date(deadlineAt);

  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now;
}
