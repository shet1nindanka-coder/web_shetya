"use server";

import { SolutionCheckStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { pruneExpiredHomeworkPhotos } from "@/lib/homework-photo-retention";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { tagUntaggedNumbers } from "@/lib/number-tagging";
import { resetPersistentRateLimit } from "@/lib/persistent-rate-limit";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import {
  getSiteSettingsUncached,
  invalidateSiteSettingsCache,
  parseSiteSettingsForm,
  saveSiteSettings,
  setInternalSettingValue
} from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";

const STALE_CHECK_UNFREEZE_MS = 15 * 60_000;

// Результат действия дев-панели: показывается на клиенте без перезагрузки страницы.
type ActionResult = { ok: boolean; message: string };

export async function saveSiteSettingsAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);
  const values = parseSiteSettingsForm(formData);

  try {
    await saveSiteSettings(values);
    logInfoEvent("site_settings.updated", { userId: user.id });
    return { ok: true, message: "Настройки сохранены и применены — подействуют в течение 15 секунд." };
  } catch (error) {
    logErrorEvent(
      "site_settings.update_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to save site settings."
    );
    return { ok: false, message: "Не удалось сохранить настройки. Применена ли миграция SiteSetting?" };
  }
}

export async function testAiConnectionAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  await requireUser(UserRole.DEVELOPER);
  const settings = await getSiteSettingsUncached();
  const config = settings.aiEnabled ? getAiCheckConfig(settings) : null;

  if (!config) {
    return { ok: false, message: "Автопроверка выключена или не настроен ключ/модель." };
  }

  const isReasoning = /(^|\/)(gpt-5|o\d)/i.test(config.model);
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Ответь строго одним словом: ok" }],
        ...(isReasoning ? { max_completion_tokens: 2000, reasoning_effort: "low" } : { max_tokens: 10 })
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    const elapsedMs = Date.now() - startedAt;

    if (response.ok) {
      return { ok: true, message: `Модель отвечает: ${config.model} · ${elapsedMs} мс.` };
    }

    const text = (await response.text().catch(() => "")).slice(0, 140);
    return { ok: false, message: `Модель недоступна: HTTP ${response.status} ${text}`.trim() + "." };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "таймаут 20 секунд"
      : error instanceof Error
        ? error.message.slice(0, 140)
        : "неизвестная ошибка";
    return { ok: false, message: `Модель недоступна: ${message}.` };
  }
}

export async function runRetentionNowAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);

  try {
    const result = await pruneExpiredHomeworkPhotos();
    await setInternalSettingValue("internal.retentionLastRunAt", new Date().toISOString());
    logInfoEvent("site_settings.retention_manual_run", { userId: user.id, ...result });
    return {
      ok: true,
      message: `Автоудаление выполнено: снято ссылок на фото — ${result.submissionPhotos + result.checkPhotos}, удалено файлов — ${result.files}.`
    };
  } catch (error) {
    logErrorEvent(
      "site_settings.retention_manual_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Manual retention run failed."
    );
    return { ok: false, message: "Автоудаление не выполнено — подробности в логах сервера." };
  }
}

export async function resetAiDailyBudgetAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);

  try {
    await resetPersistentRateLimit("api:homework-checks:global", "global");
    logInfoEvent("site_settings.ai_budget_reset", { userId: user.id });
    return { ok: true, message: "Дневной бюджет автопроверки сброшен." };
  } catch {
    return { ok: false, message: "Не удалось сбросить бюджет — подробности в логах сервера." };
  }
}

export async function unfreezeChecksAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);

  try {
    const threshold = new Date(Date.now() - STALE_CHECK_UNFREEZE_MS);
    const result = await prisma.homeworkCheck.updateMany({
      where: {
        status: { in: [SolutionCheckStatus.PENDING, SolutionCheckStatus.CHECKING] },
        createdAt: { lt: threshold }
      },
      data: {
        status: SolutionCheckStatus.FAILED,
        activeSlot: null,
        error: "Проверка снята разработчиком как зависшая. Запустите её заново.",
        checkedAt: new Date()
      }
    });
    logInfoEvent("site_settings.checks_unfrozen", { userId: user.id, count: result.count });
    return { ok: true, message: `Зависших проверок снято: ${result.count}.` };
  } catch (error) {
    logErrorEvent(
      "site_settings.unfreeze_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to unfreeze stale checks."
    );
    return { ok: false, message: "Не удалось снять зависшие проверки — подробности в логах сервера." };
  }
}

export async function flushCachesAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);

  try {
    revalidateAllPlatformData();
  } catch {
    // Вне request-контекста ревалидация недоступна, но из server action всегда доступна.
  }

  invalidateSiteSettingsCache();
  logInfoEvent("site_settings.caches_flushed", { userId: user.id });
  return { ok: true, message: "Кэши платформы сброшены." };
}

export async function tagNumbersDifficultyAction(
  _prevState: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const user = await requireUser(UserRole.DEVELOPER);
  const settings = await getSiteSettingsUncached();

  if (!settings.aiEnabled) {
    return { ok: false, message: "Автопроверка выключена — включите ИИ во вкладке «Настройки»." };
  }

  try {
    const result = await tagUntaggedNumbers();
    logInfoEvent("site_settings.numbers_tagged", { userId: user.id, ...result });

    if (result.tagged === 0 && result.remaining === 0 && result.failed === 0) {
      return {
        ok: true,
        message: result.skippedNoCondition
          ? `Все номера с условием уже размечены. Без условия (пропущены): ${result.skippedNoCondition}.`
          : "Все номера уже размечены."
      };
    }

    const parts = [`Размечено: ${result.tagged}.`];
    if (result.remaining > 0) parts.push(`Осталось: ${result.remaining} — нажмите ещё раз.`);
    if (result.failed > 0) parts.push(`Не получилось: ${result.failed}.`);
    if (result.skippedNoCondition > 0) parts.push(`Без условия (пропущены): ${result.skippedNoCondition}.`);

    return { ok: result.tagged > 0 || result.failed === 0, message: parts.join(" ") };
  } catch (error) {
    logErrorEvent(
      "site_settings.numbers_tagging_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Number difficulty tagging run failed."
    );
    return { ok: false, message: "Разметка не выполнена — подробности в логах сервера." };
  }
}

export async function broadcastNotificationAction(formData: FormData): Promise<ActionResult> {
  const developer = await requireUser(UserRole.DEVELOPER);
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 300);
  const toAll = formData.get("toAll") === "on";
  const selectedIds = formData
    .getAll("recipients")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!title || (!toAll && selectedIds.length === 0)) {
    return { ok: false, message: "Заполните заголовок и выберите получателей." };
  }

  // Отправляем только реальным ученикам: выбранные id перепроверяются по роли.
  const students = await prisma.user.findMany({
    where: {
      role: UserRole.STUDENT,
      ...(toAll ? {} : { id: { in: selectedIds } })
    },
    select: { id: true }
  });

  for (const student of students) {
    await createNotification({
      userId: student.id,
      type: "broadcast",
      title,
      body: body || null,
      href: null
    });
  }

  logInfoEvent("site_settings.broadcast_sent", {
    userId: developer.id,
    recipients: students.length,
    toAll
  });
  return { ok: true, message: `Уведомление отправлено ученикам: ${students.length}.` };
}
