import { SolutionCheckStatus } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { logWarnEvent } from "@/lib/logger";

/*
 * Служебные уведомления разработчика: колокольчик сообщает о том, что требует
 * взгляда — ошибки на платформе, тающий дневной бюджет ИИ, зависшие проверки,
 * распухшее хранилище. Генерация ленивая (GET /api/notifications), по образцу
 * напоминаний о звонках у учителя: in-memory троттлинг — корректно на одном
 * инстансе, при горизонтальном масштабировании нужен внешний стор.
 */

export const DEVELOPER_ALERT_TYPES = {
  errors: "dev_errors",
  budgetWarn: "dev_ai_budget_warn",
  budgetOut: "dev_ai_budget_out",
  staleChecks: "dev_stale_checks",
  storage: "dev_storage"
} as const;

const ENSURE_THROTTLE_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const STALE_CHECK_AGE_MS = 30 * 60_000;
const STORAGE_WARN_BYTES = 512 * 1024 * 1024;
const BUDGET_WARN_RATIO = 0.8;

/** Кулдауны повторной отправки: чаще — шум, реже — можно пропустить проблему. */
const COOLDOWN_MS: Record<string, number> = {
  [DEVELOPER_ALERT_TYPES.errors]: 6 * 60 * 60_000,
  [DEVELOPER_ALERT_TYPES.budgetWarn]: DAY_MS,
  [DEVELOPER_ALERT_TYPES.budgetOut]: DAY_MS,
  [DEVELOPER_ALERT_TYPES.staleChecks]: 6 * 60 * 60_000,
  [DEVELOPER_ALERT_TYPES.storage]: 7 * DAY_MS
};

export type DeveloperAlertFacts = {
  /** Ошибок в журнале за сутки. */
  failedCount: number;
  /** Из них — после последнего уведомления об ошибках (новых). */
  failedSinceLastAlert: number;
  checksLastDay: number;
  aiDailyLimit: number;
  staleCheckCount: number;
  storageBytes: number;
  /** type → когда отправляли в прошлый раз. */
  lastSentAt: Partial<Record<string, Date>>;
  now: Date;
};

export type DeveloperAlert = {
  type: string;
  title: string;
  body: string;
  href: string;
};

function cooledDown(facts: DeveloperAlertFacts, type: string) {
  const last = facts.lastSentAt[type];
  return !last || facts.now.getTime() - last.getTime() >= (COOLDOWN_MS[type] ?? DAY_MS);
}

/**
 * Чистое решение «какие уведомления создать» — покрыто тестами.
 * Бюджет: при исчерпании уходит только эскалация, без дублирующего «почти».
 */
export function resolveDeveloperAlerts(facts: DeveloperAlertFacts): DeveloperAlert[] {
  const alerts: DeveloperAlert[] = [];

  if (facts.failedCount > 0 && facts.failedSinceLastAlert > 0 && cooledDown(facts, DEVELOPER_ALERT_TYPES.errors)) {
    alerts.push({
      type: DEVELOPER_ALERT_TYPES.errors,
      title: `Ошибки на платформе: ${facts.failedCount} за сутки`,
      body: "Загляните в журнал действий — там видно, какие вызовы упали и почему.",
      href: "/developer/panel/journal?outcome=failed&days=1"
    });
  }

  const limit = Math.max(1, facts.aiDailyLimit);

  if (facts.checksLastDay >= limit && cooledDown(facts, DEVELOPER_ALERT_TYPES.budgetOut)) {
    alerts.push({
      type: DEVELOPER_ALERT_TYPES.budgetOut,
      title: "Дневной бюджет ИИ исчерпан",
      body: `Проверки и подбор остановлены до сброса окна: ${facts.checksLastDay} из ${limit} за 24 часа.`,
      href: "/developer/panel"
    });
  } else if (facts.checksLastDay >= limit * BUDGET_WARN_RATIO && facts.checksLastDay < limit && cooledDown(facts, DEVELOPER_ALERT_TYPES.budgetWarn)) {
    alerts.push({
      type: DEVELOPER_ALERT_TYPES.budgetWarn,
      title: "Бюджет ИИ на исходе",
      body: `Использовано ${facts.checksLastDay} из ${limit} запусков за 24 часа — осталось меньше 20%.`,
      href: "/developer/panel"
    });
  }

  if (facts.staleCheckCount > 0 && cooledDown(facts, DEVELOPER_ALERT_TYPES.staleChecks)) {
    alerts.push({
      type: DEVELOPER_ALERT_TYPES.staleChecks,
      title: `Зависшие проверки: ${facts.staleCheckCount}`,
      body: "Проверки в очереди дольше 30 минут — ученики ждут. Кнопка «Разморозить» — в действиях панели.",
      href: "/developer/panel?tab=actions"
    });
  }

  if (facts.storageBytes > STORAGE_WARN_BYTES && cooledDown(facts, DEVELOPER_ALERT_TYPES.storage)) {
    const gb = (facts.storageBytes / (1024 * 1024 * 1024)).toFixed(1);
    alerts.push({
      type: DEVELOPER_ALERT_TYPES.storage,
      title: `Хранилище файлов разрослось: ${gb} ГБ`,
      body: "Проверьте срок хранения фото решений и запустите очистку в действиях панели.",
      href: "/developer/panel?tab=actions"
    });
  }

  return alerts;
}

const ensureRuns = new Map<string, { at: number; promise: Promise<void> }>();

export function ensureDeveloperAlerts(developerId: string): Promise<void> {
  const existing = ensureRuns.get(developerId);
  const now = Date.now();

  if (existing && now - existing.at < ENSURE_THROTTLE_MS) {
    return existing.promise;
  }

  const promise = runEnsureDeveloperAlerts(developerId).catch((error) => {
    logWarnEvent("developer_alerts.ensure.failed", { developerId }, error, "Failed to ensure developer alerts.");
  });

  ensureRuns.set(developerId, { at: now, promise });

  return promise;
}

type AuditDelegate = { count(args: unknown): Promise<number> };

async function countFailedAudit(where: Record<string, unknown>): Promise<number> {
  // Таблица журнала может быть ещё не мигрирована — не роняем уведомления.
  const delegate = (prisma as unknown as { auditLog?: AuditDelegate }).auditLog;

  if (!delegate) {
    return 0;
  }

  try {
    return await delegate.count({ where });
  } catch {
    return 0;
  }
}

async function runEnsureDeveloperAlerts(developerId: string): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const staleBefore = new Date(now.getTime() - STALE_CHECK_AGE_MS);

  const settings = await getSiteSettings();

  const [lastAlerts, failedCount, checksLastDay, staleCheckCount, storageAggregate] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: developerId, type: { in: Object.values(DEVELOPER_ALERT_TYPES) } },
      orderBy: { createdAt: "desc" },
      select: { type: true, createdAt: true }
    }),
    countFailedAudit({ outcome: "failed", createdAt: { gte: dayAgo } }),
    prisma.homeworkCheck.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.homeworkCheck
      .count({
        where: {
          status: { in: [SolutionCheckStatus.PENDING, SolutionCheckStatus.CHECKING] },
          createdAt: { lt: staleBefore }
        }
      })
      .catch(() => 0),
    prisma.storedFile.aggregate({ _sum: { size: true } })
  ]);

  const lastSentAt: Partial<Record<string, Date>> = {};

  for (const alert of lastAlerts) {
    if (!lastSentAt[alert.type]) {
      lastSentAt[alert.type] = alert.createdAt;
    }
  }

  const lastErrorsAt = lastSentAt[DEVELOPER_ALERT_TYPES.errors];
  const failedSinceLastAlert = lastErrorsAt
    ? await countFailedAudit({ outcome: "failed", createdAt: { gte: lastErrorsAt } })
    : failedCount;

  const alerts = resolveDeveloperAlerts({
    failedCount,
    failedSinceLastAlert,
    checksLastDay,
    aiDailyLimit: settings.aiDailyLimit,
    staleCheckCount,
    storageBytes: storageAggregate._sum.size ?? 0,
    lastSentAt,
    now
  });

  for (const alert of alerts) {
    await createNotification({
      userId: developerId,
      type: alert.type,
      title: alert.title,
      body: alert.body,
      href: alert.href
    });
  }
}
