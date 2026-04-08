import { HomeworkNumberStatus, UserRole } from "@prisma/client";

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
    buttonClassName: "ui-status-button ui-status-green",
    subtleClassName: "ui-status-surface ui-status-green"
  },
  YELLOW: {
    label: "Исправлен после самопроверки",
    shortLabel: "Желтый",
    cardClassName: "ui-status-surface ui-status-yellow",
    buttonClassName: "ui-status-button ui-status-yellow",
    subtleClassName: "ui-status-surface ui-status-yellow"
  },
  RED: {
    label: "Нужна помощь преподавателя",
    shortLabel: "Красный",
    cardClassName: "ui-status-surface ui-status-red",
    buttonClassName: "ui-status-button ui-status-red",
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
  return role === UserRole.TEACHER ? "/teacher" : "/student";
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Без даты";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "Без даты";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

  const numbers = new Set<number>();

  for (const match of matches) {
    if (match.includes("-")) {
      const [rawStart, rawEnd] = match.split("-").map((value) => Number(value.trim()));

      if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd) || rawStart <= 0 || rawEnd <= 0) {
        continue;
      }

      const start = Math.min(rawStart, rawEnd);
      const end = Math.max(rawStart, rawEnd);

      for (let current = start; current <= end; current += 1) {
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
