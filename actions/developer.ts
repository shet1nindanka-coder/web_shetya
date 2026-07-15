"use server";

import { SolutionCheckStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { pruneExpiredHomeworkPhotos } from "@/lib/homework-photo-retention";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
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

const PANEL_PATH = "/developer/panel";
const STALE_CHECK_UNFREEZE_MS = 15 * 60_000;

export async function saveSiteSettingsAction(formData: FormData) {
  const user = await requireUser(UserRole.DEVELOPER);
  const values = parseSiteSettingsForm(formData);
  let failed = false;

  try {
    await saveSiteSettings(values);
    logInfoEvent("site_settings.updated", { userId: user.id });
  } catch (error) {
    failed = true;
    logErrorEvent(
      "site_settings.update_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to save site settings."
    );
  }

  redirect(failed ? `${PANEL_PATH}?error=save` : `${PANEL_PATH}?saved=1`);
}

export async function testAiConnectionAction() {
  await requireUser(UserRole.DEVELOPER);
  const settings = await getSiteSettingsUncached();
  const config = settings.aiEnabled ? getAiCheckConfig(settings) : null;

  if (!config) {
    redirect(`${PANEL_PATH}?ai=off`);
  }

  const isReasoning = /(^|\/)(gpt-5|o\d)/i.test(config.model);
  const startedAt = Date.now();
  let query: string;

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
      query = `ai=ok&aiInfo=${encodeURIComponent(`${config.model} · ${elapsedMs} мс`)}`;
    } else {
      const text = (await response.text().catch(() => "")).slice(0, 140);
      query = `ai=fail&aiInfo=${encodeURIComponent(`HTTP ${response.status} ${text}`.trim())}`;
    }
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "таймаут 20 секунд"
      : error instanceof Error
        ? error.message.slice(0, 140)
        : "неизвестная ошибка";
    query = `ai=fail&aiInfo=${encodeURIComponent(message)}`;
  }

  redirect(`${PANEL_PATH}?${query}`);
}

export async function runRetentionNowAction() {
  const user = await requireUser(UserRole.DEVELOPER);
  let query = "error=retention";

  try {
    const result = await pruneExpiredHomeworkPhotos();
    await setInternalSettingValue("internal.retentionLastRunAt", new Date().toISOString());
    logInfoEvent("site_settings.retention_manual_run", { userId: user.id, ...result });
    query = `retention=${result.submissionPhotos + result.checkPhotos}&retentionFiles=${result.files}`;
  } catch (error) {
    logErrorEvent(
      "site_settings.retention_manual_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Manual retention run failed."
    );
  }

  redirect(`${PANEL_PATH}?${query}`);
}

export async function resetAiDailyBudgetAction() {
  const user = await requireUser(UserRole.DEVELOPER);
  let failed = false;

  try {
    await resetPersistentRateLimit("api:homework-checks:global", "global");
    logInfoEvent("site_settings.ai_budget_reset", { userId: user.id });
  } catch {
    failed = true;
  }

  redirect(failed ? `${PANEL_PATH}?error=budget` : `${PANEL_PATH}?done=budget`);
}

export async function unfreezeChecksAction() {
  const user = await requireUser(UserRole.DEVELOPER);
  let query = "error=unfreeze";

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
    query = `unfrozen=${result.count}`;
  } catch (error) {
    logErrorEvent(
      "site_settings.unfreeze_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to unfreeze stale checks."
    );
  }

  redirect(`${PANEL_PATH}?${query}`);
}

export async function flushCachesAction() {
  const user = await requireUser(UserRole.DEVELOPER);

  try {
    revalidateAllPlatformData();
  } catch {
    // Вне request-контекста ревалидация недоступна, но из server action всегда доступна.
  }

  invalidateSiteSettingsCache();
  logInfoEvent("site_settings.caches_flushed", { userId: user.id });
  redirect(`${PANEL_PATH}?done=caches`);
}

export async function broadcastNotificationAction(formData: FormData) {
  const developer = await requireUser(UserRole.DEVELOPER);
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 300);
  const toAll = formData.get("toAll") === "on";
  const selectedIds = formData
    .getAll("recipients")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!title || (!toAll && selectedIds.length === 0)) {
    redirect(`${PANEL_PATH}?error=invalid`);
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
  redirect(`${PANEL_PATH}?broadcast=${students.length}`);
}
