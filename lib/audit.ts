import { headers } from "next/headers";
import { AuditCategory, Prisma, type UserRole } from "@prisma/client";
import { tryGetCurrentUser } from "@/lib/auth";
import { logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getClientIpFromHeaders } from "@/lib/rate-limit";

/**
 * Журнал действий для панели разработчика.
 *
 * Правило номер один: запись в журнал НИКОГДА не ломает основную операцию.
 * Любая ошибка гасится и уходит в pino — иначе упавший insert в журнал
 * отменил бы проверку ДЗ или выдачу плана, то есть журнал стал бы опаснее
 * той проблемы, ради которой его завели.
 */

const SUMMARY_MAX = 300;
const ERROR_MAX = 500;

// Цены провайдера за миллион токенов. В env, потому что тарифы меняются:
// пересчитывать историю задним числом нельзя, поэтому costRub считается
// в момент записи и дальше не трогается.
const DEFAULT_INPUT_PRICE_RUB = 800;
const DEFAULT_OUTPUT_PRICE_RUB = 4700;

function readPrice(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

/** Примерная стоимость вызова модели в рублях. null, если токены неизвестны. */
export function estimateAiCostRub(inputTokens: number | null, outputTokens: number | null) {
  if (inputTokens === null && outputTokens === null) {
    return null;
  }

  const inputPrice = readPrice("AI_PRICE_INPUT_RUB_PER_MTOK", DEFAULT_INPUT_PRICE_RUB);
  const outputPrice = readPrice("AI_PRICE_OUTPUT_RUB_PER_MTOK", DEFAULT_OUTPUT_PRICE_RUB);
  const cost = ((inputTokens ?? 0) * inputPrice + (outputTokens ?? 0) * outputPrice) / 1_000_000;

  return new Prisma.Decimal(cost.toFixed(4));
}

export type AuditActor = {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: UserRole | null;
  clientIp?: string | null;
};

export type AuditEntry = AuditActor & {
  category: AuditCategory;
  /** Имя события в стиле pino-логов: "lesson_plan.generate", "auth.login". */
  action: string;
  outcome?: "ok" | "failed";
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  summary?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
  error?: unknown;
  meta?: Prisma.InputJsonValue | null;
};

function clip(value: string | null | undefined, max: number) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function errorToText(error: unknown) {
  if (error === undefined || error === null) {
    return null;
  }

  if (error instanceof Error) {
    return clip(error.message, ERROR_MAX);
  }

  if (typeof error === "string") {
    return clip(error, ERROR_MAX);
  }

  try {
    return clip(JSON.stringify(error), ERROR_MAX);
  } catch {
    return clip(String(error), ERROR_MAX);
  }
}

/**
 * Актор текущего запроса. Безопасно вызывать откуда угодно: вне контекста
 * запроса (фоновая очередь автопроверки, retention-джоб) вернёт пустой
 * объект вместо исключения.
 */
export async function currentAuditActor(): Promise<AuditActor> {
  let clientIp: string | null = null;

  try {
    clientIp = getClientIpFromHeaders(await headers()) ?? null;
  } catch {
    // Вне контекста запроса headers() бросает — это нормально для фоновых задач.
  }

  try {
    const user = await tryGetCurrentUser();

    if (!user) {
      return { clientIp };
    }

    return { actorId: user.id, actorName: user.name, actorRole: user.role, clientIp };
  } catch {
    return { clientIp };
  }
}

/** Пишет запись в журнал. Не бросает и не возвращает ошибок — только гасит их в лог. */
export async function writeAuditLog(entry: AuditEntry) {
  try {
    const inputTokens = entry.inputTokens ?? null;
    const outputTokens = entry.outputTokens ?? null;

    await prisma.auditLog.create({
      data: {
        category: entry.category,
        action: entry.action.trim(),
        outcome: entry.outcome ?? "ok",
        actorId: entry.actorId ?? null,
        actorName: clip(entry.actorName, 200),
        actorRole: entry.actorRole ?? null,
        targetType: clip(entry.targetType, 60),
        targetId: clip(entry.targetId, 100),
        targetLabel: clip(entry.targetLabel, 200),
        summary: clip(entry.summary, SUMMARY_MAX),
        model: clip(entry.model, 100),
        inputTokens,
        outputTokens,
        costRub: entry.category === AuditCategory.AI ? estimateAiCostRub(inputTokens, outputTokens) : null,
        durationMs: entry.durationMs ?? null,
        error: errorToText(entry.error),
        meta: entry.meta ?? Prisma.JsonNull,
        clientIp: clip(entry.clientIp, 64)
      }
    });
  } catch (error) {
    logWarnEvent("audit.write_failed", { action: entry.action }, error, "Failed to write an audit log entry.");
  }
}

/**
 * Журнал действия, выполненного текущим пользователем. Сахар поверх
 * writeAuditLog: сам подтягивает актора из сессии.
 */
export async function auditCurrentUser(entry: Omit<AuditEntry, keyof AuditActor>) {
  const actor = await currentAuditActor();
  await writeAuditLog({ ...entry, ...actor });
}

// Срок хранения журнала. 90 дней: хватает разобрать любой инцидент и увидеть
// динамику за четверть, при этом таблица не растёт бесконечно.
const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export function getAuditRetentionDays(rawValue = process.env.AUDIT_LOG_RETENTION_DAYS) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? Math.floor(parsed) : DEFAULT_AUDIT_RETENTION_DAYS;
}

/**
 * Удаляет записи журнала старше срока хранения. Ноль или отрицательное значение
 * в AUDIT_LOG_RETENTION_DAYS отключает чистку — тем же способом, что и у фото решений.
 */
export async function pruneExpiredAuditLogs(now = new Date()) {
  const retentionDays = getAuditRetentionDays();

  if (retentionDays <= 0) {
    return { deleted: 0, skipped: true as const };
  }

  const threshold = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: threshold } } });

  return { deleted: result.count, skipped: false as const };
}
