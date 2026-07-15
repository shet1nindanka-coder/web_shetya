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
  const numbers = new Set<number>();

  for (const match of matches) {
    if (numbers.size >= MAX_NUMBERS) {
      break;
    }

    if (match.includes("-")) {
      const [rawStart, rawEnd] = match.split("-").map((value) => Number(value.trim()));

      if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd) || rawStart <= 0 || rawEnd <= 0) {
        continue;
      }

      const start = Math.min(rawStart, rawEnd);
      const end = Math.max(rawStart, rawEnd);

      // Гигантский диапазон — почти наверняка опечатка: пропускаем его целиком.
      if (end - start >= MAX_NUMBERS) {
        continue;
      }

      for (let current = start; current <= end && numbers.size < MAX_NUMBERS; current += 1) {
        numbers.add(current);
      }

      continue;
    }

    const value = Number(match.trim());

    if (Number.isInteger(value) && value > 0) {
      numbers.add(value);
    }
  }

  return Array.from(numbers).sort((left, right) => left - right);
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
