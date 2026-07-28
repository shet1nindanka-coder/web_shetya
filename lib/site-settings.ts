import { logWarnEvent } from "@/lib/logger";
import { MAX_COMPLETED_CHECKS_PER_STUDENT } from "@/lib/solution-check-history";
import { getHomeworkPhotoRetentionDays } from "@/lib/homework-photo-retention";

export type ReasoningEffort = "low" | "medium" | "high";

export type SiteSettings = {
  aiEnabled: boolean;
  aiModel: string;
  aiReasoningEffort: ReasoningEffort;
  aiMinConfidence: number;
  aiDailyLimit: number;
  aiPerStudentHourlyLimit: number;
  photoRetentionDays: number; // 0 = автоудаление выключено
  maxPhotosPerAssignment: number;
  completedChecksKept: number;
  lessonPlanEnabled: boolean;
  lessonPlanShortlistSize: number;
  lessonPlanMaxItems: number;
  lessonPlanConcurrency: number;
  homeworkPlanEnabled: boolean;
  homeworkPlanMaxItems: number;
  homeworkPlanShortlistSize: number;
};

const REASONING_EFFORTS: ReasoningEffort[] = ["low", "medium", "high"];

// Number("") === 0, поэтому пустую строку считаем отсутствием значения, а не нулём.
function toFiniteNumber(raw: unknown) {
  if (typeof raw === "string" && raw.trim() === "") {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number) {
  const value = toFiniteNumber(raw);

  if (value === null) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampFloat(raw: unknown, min: number, max: number, fallback: number) {
  const value = toFiniteNumber(raw);

  if (value === null) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

// Дефолты берутся из env — панель их переопределяет, env остаётся страховкой.
export function getSiteSettingsDefaults(): SiteSettings {
  const effortRaw = process.env.AI_CHECK_REASONING_EFFORT?.trim().toLowerCase();
  const confidenceRaw = Number(process.env.AI_CHECK_MIN_CONFIDENCE);
  const dailyRaw = Number(process.env.AI_CHECK_DAILY_LIMIT);

  return {
    aiEnabled: Boolean(process.env.AI_CHECK_API_KEY?.trim() && process.env.AI_CHECK_MODEL?.trim()),
    aiModel: process.env.AI_CHECK_MODEL?.trim() ?? "",
    aiReasoningEffort: REASONING_EFFORTS.includes(effortRaw as ReasoningEffort)
      ? (effortRaw as ReasoningEffort)
      : "high",
    aiMinConfidence:
      Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : 0.6,
    aiDailyLimit: Number.isFinite(dailyRaw) && dailyRaw > 0 ? Math.floor(dailyRaw) : 300,
    aiPerStudentHourlyLimit: 10,
    photoRetentionDays: getHomeworkPhotoRetentionDays() ?? 0,
    maxPhotosPerAssignment: 10,
    completedChecksKept: MAX_COMPLETED_CHECKS_PER_STUDENT,
    // ИИ-подбор заданий на урок включён, если настроена автопроверка.
    lessonPlanEnabled: Boolean(process.env.AI_CHECK_API_KEY?.trim() && process.env.AI_CHECK_MODEL?.trim()),
    lessonPlanShortlistSize: 60,
    lessonPlanMaxItems: 40,
    lessonPlanConcurrency: 3,
    homeworkPlanEnabled: Boolean(process.env.AI_CHECK_API_KEY?.trim() && process.env.AI_CHECK_MODEL?.trim()),
    homeworkPlanMaxItems: 20,
    homeworkPlanShortlistSize: 60
  };
}

// Применяет строковые значения (из БД или формы) поверх дефолтов с валидацией.
export function applySettingRows(
  defaults: SiteSettings,
  rows: Array<{ key: string; value: string }>
): SiteSettings {
  const result = { ...defaults };

  for (const row of rows) {
    const value = row.value;

    switch (row.key) {
      case "aiEnabled":
        result.aiEnabled = value === "true";
        break;
      case "aiModel":
        result.aiModel = value.trim().slice(0, 100);
        break;
      case "aiReasoningEffort":
        if (REASONING_EFFORTS.includes(value as ReasoningEffort)) {
          result.aiReasoningEffort = value as ReasoningEffort;
        }
        break;
      case "aiMinConfidence":
        result.aiMinConfidence = clampFloat(value, 0, 1, defaults.aiMinConfidence);
        break;
      case "aiDailyLimit":
        result.aiDailyLimit = clampInt(value, 1, 100000, defaults.aiDailyLimit);
        break;
      case "aiPerStudentHourlyLimit":
        result.aiPerStudentHourlyLimit = clampInt(value, 1, 1000, defaults.aiPerStudentHourlyLimit);
        break;
      case "photoRetentionDays":
        result.photoRetentionDays = clampInt(value, 0, 3650, defaults.photoRetentionDays);
        break;
      case "maxPhotosPerAssignment":
        result.maxPhotosPerAssignment = clampInt(value, 1, 30, defaults.maxPhotosPerAssignment);
        break;
      case "completedChecksKept":
        result.completedChecksKept = clampInt(value, 1, 500, defaults.completedChecksKept);
        break;
      case "lessonPlanEnabled":
        result.lessonPlanEnabled = value === "true";
        break;
      case "lessonPlanShortlistSize":
        result.lessonPlanShortlistSize = clampInt(value, 20, 150, defaults.lessonPlanShortlistSize);
        break;
      case "lessonPlanMaxItems":
        result.lessonPlanMaxItems = clampInt(value, 5, 60, defaults.lessonPlanMaxItems);
        break;
      case "lessonPlanConcurrency":
        result.lessonPlanConcurrency = clampInt(value, 1, 10, defaults.lessonPlanConcurrency);
        break;
      case "homeworkPlanEnabled":
        result.homeworkPlanEnabled = value === "true";
        break;
      case "homeworkPlanMaxItems":
        result.homeworkPlanMaxItems = clampInt(value, 3, 60, defaults.homeworkPlanMaxItems);
        break;
      case "homeworkPlanShortlistSize":
        result.homeworkPlanShortlistSize = clampInt(value, 20, 150, defaults.homeworkPlanShortlistSize);
        break;
      default:
        break;
    }
  }

  return result;
}

export function serializeSiteSettings(values: SiteSettings): Array<{ key: string; value: string }> {
  return [
    { key: "aiEnabled", value: String(values.aiEnabled) },
    { key: "aiModel", value: values.aiModel },
    { key: "aiReasoningEffort", value: values.aiReasoningEffort },
    { key: "aiMinConfidence", value: String(values.aiMinConfidence) },
    { key: "aiDailyLimit", value: String(values.aiDailyLimit) },
    { key: "aiPerStudentHourlyLimit", value: String(values.aiPerStudentHourlyLimit) },
    { key: "photoRetentionDays", value: String(values.photoRetentionDays) },
    { key: "maxPhotosPerAssignment", value: String(values.maxPhotosPerAssignment) },
    { key: "completedChecksKept", value: String(values.completedChecksKept) },
    { key: "lessonPlanEnabled", value: String(values.lessonPlanEnabled) },
    { key: "lessonPlanShortlistSize", value: String(values.lessonPlanShortlistSize) },
    { key: "lessonPlanMaxItems", value: String(values.lessonPlanMaxItems) },
    { key: "lessonPlanConcurrency", value: String(values.lessonPlanConcurrency) },
    { key: "homeworkPlanEnabled", value: String(values.homeworkPlanEnabled) },
    { key: "homeworkPlanMaxItems", value: String(values.homeworkPlanMaxItems) },
    { key: "homeworkPlanShortlistSize", value: String(values.homeworkPlanShortlistSize) }
  ];
}

export function parseSiteSettingsForm(formData: FormData): SiteSettings {
  const rows = [
    { key: "aiEnabled", value: formData.get("aiEnabled") === "on" ? "true" : "false" },
    { key: "aiModel", value: String(formData.get("aiModel") ?? "") },
    { key: "aiReasoningEffort", value: String(formData.get("aiReasoningEffort") ?? "") },
    { key: "aiMinConfidence", value: String(formData.get("aiMinConfidence") ?? "") },
    { key: "aiDailyLimit", value: String(formData.get("aiDailyLimit") ?? "") },
    { key: "aiPerStudentHourlyLimit", value: String(formData.get("aiPerStudentHourlyLimit") ?? "") },
    { key: "photoRetentionDays", value: String(formData.get("photoRetentionDays") ?? "") },
    { key: "maxPhotosPerAssignment", value: String(formData.get("maxPhotosPerAssignment") ?? "") },
    { key: "completedChecksKept", value: String(formData.get("completedChecksKept") ?? "") },
    { key: "lessonPlanEnabled", value: formData.get("lessonPlanEnabled") === "on" ? "true" : "false" },
    { key: "lessonPlanShortlistSize", value: String(formData.get("lessonPlanShortlistSize") ?? "") },
    { key: "lessonPlanMaxItems", value: String(formData.get("lessonPlanMaxItems") ?? "") },
    { key: "lessonPlanConcurrency", value: String(formData.get("lessonPlanConcurrency") ?? "") },
    { key: "homeworkPlanEnabled", value: formData.get("homeworkPlanEnabled") === "on" ? "true" : "false" },
    { key: "homeworkPlanMaxItems", value: String(formData.get("homeworkPlanMaxItems") ?? "") },
    { key: "homeworkPlanShortlistSize", value: String(formData.get("homeworkPlanShortlistSize") ?? "") }
  ];

  return applySettingRows(getSiteSettingsDefaults(), rows);
}

async function readSettingRows(): Promise<Array<{ key: string; value: string }>> {
  const { prisma } = await import("@/lib/prisma");

  try {
    return await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      'SELECT "key", "value" FROM "SiteSetting"'
    );
  } catch (error) {
    // До применения миграции таблицы нет — тихо работаем на дефолтах из env.
    logWarnEvent(
      "site_settings.read_failed",
      {},
      error instanceof Error ? error : undefined,
      "SiteSetting table is unavailable; falling back to env defaults."
    );

    return [];
  }
}

export async function getSiteSettingsUncached(): Promise<SiteSettings> {
  return applySettingRows(getSiteSettingsDefaults(), await readSettingRows());
}

// Кэш в памяти одного инстанса: настройки читаются на каждый запрос автопроверки
// и загрузки фото, 15 секунд достаточно свежо и не дёргает БД лишний раз.
const CACHE_TTL_MS = 15_000;
let settingsCache: { value: SiteSettings; expiresAt: number } | null = null;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) {
    return settingsCache.value;
  }

  const value = await getSiteSettingsUncached();
  settingsCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };

  return value;
}

export function invalidateSiteSettingsCache() {
  settingsCache = null;
}

export async function saveSiteSettings(values: SiteSettings) {
  const { prisma } = await import("@/lib/prisma");

  for (const row of serializeSiteSettings(values)) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()',
      row.key,
      row.value
    );
  }

  invalidateSiteSettingsCache();
}

export async function getInternalSettingValue(key: string): Promise<string | null> {
  const { prisma } = await import("@/lib/prisma");

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
      'SELECT "value" FROM "SiteSetting" WHERE "key" = $1',
      key
    );

    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setInternalSettingValue(key: string, value: string) {
  const { prisma } = await import("@/lib/prisma");

  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()',
      key,
      value
    );
  } catch {
    // Таблицы может не быть до миграции — не critical-path.
  }
}
