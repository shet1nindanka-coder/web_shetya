import {
  AuditCategory,
  HomeworkNumberStatus,
  LessonItemResult,
  SolutionCheckStatus,
  SolutionVerdict,
  UserRole
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { releasePersistentRateLimitHit } from "@/lib/persistent-rate-limit";
import { prisma } from "@/lib/prisma";
import {
  callModel,
  getAiCheckConfig,
  storedFileToDataUrl
} from "@/lib/solution-check";
import {
  normalizeCheckResultsByConfidence,
  parseCheckResponse
} from "@/lib/solution-check-parse";
import { decideAutoLessonResult } from "@/lib/lesson-live";

/*
 * ИИ-проверка сдачи классной работы (вкладка «Урок»).
 *
 * Отличие от автопроверки ДЗ (lib/solution-check.ts): гранулярность — ОДИН
 * номер урока, а не пачка фото на всё задание. Панель учителя получает честные
 * времена по каждому номеру, а запрос к модели несёт 1–3 фото вместо десяти.
 * Системный промпт, сжатие фото, вызов модели и парсер переиспользуются.
 */

// Отдельный кошелёк: классная работа не сжигает дневной бюджет проверок ДЗ.
export const LESSON_CHECK_GLOBAL_BUDGET_SCOPE = "api:lesson-checks:global";
export const LESSON_CHECK_GLOBAL_BUDGET_IDENTIFIER = "global";
export const LESSON_CHECK_GLOBAL_BUDGET_WINDOW_MS = 24 * 60 * 60_000;

// Пороги зависших сдач — те же, что у проверок ДЗ, и по тем же причинам.
const STALE_PENDING_MS = 15 * 60_000;
const STALE_CHECKING_MS = 45 * 60_000;

const STALE_ERROR_TEXT = "Проверка прервалась (перезапуск сервера). Сдайте номер заново.";

// Итог урока → статус номера ученика: та же таблица, что у ручной разметки
// (app/api/teacher/lessons/**/result/route.ts).
const RESULT_TO_STATUS: Partial<Record<LessonItemResult, HomeworkNumberStatus>> = {
  [LessonItemResult.SOLVED]: HomeworkNumberStatus.GREEN,
  [LessonItemResult.PARTIAL]: HomeworkNumberStatus.YELLOW,
  [LessonItemResult.NOT_SOLVED]: HomeworkNumberStatus.RED
};

/**
 * Помечает FAILED зависшие сдачи ученика на уроке (очередь in-memory и
 * теряется при рестарте). Бюджет возвращается только за PENDING — модель
 * по ним не вызывалась.
 */
export async function failStaleLessonSubmissions(lessonId: string, studentId: string) {
  const pendingThreshold = new Date(Date.now() - STALE_PENDING_MS);
  const checkingThreshold = new Date(Date.now() - STALE_CHECKING_MS);
  const scope = {
    item: { participant: { lessonId, studentId } }
  };
  const failData = {
    status: SolutionCheckStatus.FAILED,
    activeSlot: null,
    error: STALE_ERROR_TEXT,
    checkedAt: new Date()
  };

  try {
    const [stalePending] = await Promise.all([
      prisma.lessonItemSubmission.updateMany({
        where: { ...scope, status: SolutionCheckStatus.PENDING, submittedAt: { lt: pendingThreshold } },
        data: failData
      }),
      prisma.lessonItemSubmission.updateMany({
        where: { ...scope, status: SolutionCheckStatus.CHECKING, submittedAt: { lt: checkingThreshold } },
        data: failData
      })
    ]);

    if (stalePending.count > 0) {
      await releasePersistentRateLimitHit({
        scope: LESSON_CHECK_GLOBAL_BUDGET_SCOPE,
        identifier: LESSON_CHECK_GLOBAL_BUDGET_IDENTIFIER,
        windowMs: LESSON_CHECK_GLOBAL_BUDGET_WINDOW_MS,
        amount: stalePending.count
      }).catch(() => undefined);
    }
  } catch (error) {
    // До применения миграции таблицы может не быть — не мешаем основному потоку.
    logWarnEvent(
      "lesson_check.stale_sweep_failed",
      { lessonId, studentId },
      error instanceof Error ? error : undefined,
      "Failed to sweep stale lesson submissions."
    );
  }
}

function buildLessonUserText(input: {
  topicTitle: string;
  number: string;
  conditionLatex: string | null;
  answerLatex: string | null;
}) {
  return [
    `Тема: «${input.topicTitle}». Проверь номер из классной работы по фото решения.`,
    "",
    `Номер ${input.number}:`,
    `  Условие: ${input.conditionLatex?.trim() || "не задано"}`,
    `  Эталонный ответ: ${input.answerLatex?.trim() || "не задан (если решение не видно, ставь UNCERTAIN)"}`,
    "",
    "Всего номеров: 1. Фото решения приложены ниже."
  ].join("\n");
}

/**
 * Зеркалит автоитог в StudentTopicNumberStatus — той же таблицей и тем же
 * «силовым» upsert, что и ручная разметка учителя: итог урока — самый свежий
 * сигнал о номере. «Не успел» статус не трогает.
 */
export async function mirrorLessonResultToStatus(input: {
  studentId: string;
  homeworkNumberId: string;
  result: LessonItemResult;
}) {
  const status = RESULT_TO_STATUS[input.result];

  if (!status) {
    return false;
  }

  await prisma.studentTopicNumberStatus.upsert({
    where: {
      studentId_homeworkNumberId: { studentId: input.studentId, homeworkNumberId: input.homeworkNumberId }
    },
    update: { status, statusChangedAt: new Date() },
    create: {
      studentId: input.studentId,
      homeworkNumberId: input.homeworkNumberId,
      status,
      statusChangedAt: new Date()
    }
  });

  return true;
}

export async function runLessonItemCheck(submissionId: string) {
  const { getSiteSettingsUncached } = await import("@/lib/site-settings");
  const settings = await getSiteSettingsUncached();
  const config =
    settings.aiEnabled && settings.lessonCheckEnabled ? getAiCheckConfig(settings) : null;

  const submission = await prisma.lessonItemSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      activeSlot: true,
      submittedAt: true,
      photos: {
        orderBy: { order: "asc" },
        select: { file: { select: { storageKey: true, mimeType: true } } }
      },
      item: {
        select: {
          id: true,
          result: true,
          homeworkNumber: {
            select: {
              id: true,
              number: true,
              conditionLatex: true,
              answerLatex: true,
              topic: { select: { id: true, title: true } }
            }
          },
          participant: {
            select: {
              id: true,
              studentId: true,
              student: { select: { name: true } },
              lesson: { select: { id: true, teacherId: true } }
            }
          }
        }
      }
    }
  });

  if (
    !submission ||
    submission.status !== SolutionCheckStatus.PENDING ||
    submission.activeSlot !== 1
  ) {
    return;
  }

  const item = submission.item;
  const number = item.homeworkNumber;
  const participant = item.participant;
  const lesson = participant.lesson;
  const studentName = participant.student.name;

  // Слот дневного бюджета занял POST-роут; возвращаем его только если до
  // модели дело не дошло (та же логика, что у автопроверки ДЗ, PROD-010).
  let modelCallStarted = false;
  const modelStartedAt = Date.now();
  let aiInputTokens = 0;
  let aiOutputTokens = 0;
  let aiCalls = 0;

  const failSubmission = async (message: string) => {
    await prisma.lessonItemSubmission.updateMany({
      where: {
        id: submissionId,
        status: { in: [SolutionCheckStatus.PENDING, SolutionCheckStatus.CHECKING] }
      },
      data: {
        status: SolutionCheckStatus.FAILED,
        activeSlot: null,
        error: message.slice(0, 500),
        checkedAt: new Date()
      }
    });

    if (!modelCallStarted) {
      await releasePersistentRateLimitHit({
        scope: LESSON_CHECK_GLOBAL_BUDGET_SCOPE,
        identifier: LESSON_CHECK_GLOBAL_BUDGET_IDENTIFIER,
        windowMs: LESSON_CHECK_GLOBAL_BUDGET_WINDOW_MS
      }).catch((error: unknown) => {
        logWarnEvent(
          "lesson_check.budget_release_failed",
          { submissionId },
          error,
          "Failed to release a lesson AI budget slot after a pre-model failure."
        );
      });
    }
  };

  if (!config) {
    await failSubmission(
      settings.aiEnabled && settings.lessonCheckEnabled
        ? "Проверка не настроена: нет AI_CHECK_API_KEY или модели."
        : "Проверка классной работы отключена разработчиком."
    );
    return;
  }

  if (submission.photos.length === 0) {
    await failSubmission("Нет фото решения.");
    return;
  }

  const claimed = await prisma.lessonItemSubmission.updateMany({
    where: { id: submissionId, status: SolutionCheckStatus.PENDING, activeSlot: 1 },
    data: { status: SolutionCheckStatus.CHECKING, modelUsed: config.model }
  });

  if (claimed.count !== 1) {
    return;
  }

  logInfoEvent("lesson_check.started", {
    submissionId,
    lessonId: lesson.id,
    studentId: participant.studentId,
    number: number.number,
    photosCount: submission.photos.length
  });

  try {
    const imageUrls: string[] = [];

    for (const photo of submission.photos) {
      const dataUrl = await storedFileToDataUrl(photo.file.storageKey, photo.file.mimeType);

      if (dataUrl) {
        imageUrls.push(dataUrl);
      }
    }

    if (imageUrls.length === 0) {
      await failSubmission("Не удалось прочитать фото решения из хранилища.");
      return;
    }

    const userText = buildLessonUserText({
      topicTitle: number.topic.title,
      number: number.number,
      conditionLatex: number.conditionLatex,
      answerLatex: number.answerLatex
    });
    const validNumbers = [number.number];

    modelCallStarted = true;

    let modelResponse = await callModel(config, userText, imageUrls);
    aiInputTokens += modelResponse.inputTokens ?? 0;
    aiOutputTokens += modelResponse.outputTokens ?? 0;
    aiCalls += 1;

    let results;

    try {
      results = parseCheckResponse(modelResponse.content, validNumbers);
    } catch {
      logWarnEvent("lesson_check.retry", { submissionId }, undefined, "Model returned invalid JSON, retrying once.");
      modelResponse = await callModel(
        config,
        userText,
        imageUrls,
        "Предыдущий ответ не удалось разобрать. Верни СТРОГО один JSON-объект по формату, без текста вокруг."
      );
      aiInputTokens += modelResponse.inputTokens ?? 0;
      aiOutputTokens += modelResponse.outputTokens ?? 0;
      aiCalls += 1;
      results = parseCheckResponse(modelResponse.content, validNumbers);
    }

    results = normalizeCheckResultsByConfidence(results, settings.aiMinConfidence);
    const result = results[0];

    if (!result) {
      await failSubmission("Модель не вернула вердикт по номеру.");
      return;
    }

    const verdict = result.verdict as SolutionVerdict;

    // Автоитог: «решил» с первой попытки, «с ошибками» — если раньше были
    // неверные сдачи, «не решил» — при ошибке. Читаем актуальный итог и историю
    // прямо перед записью: учитель мог разметить номер, пока шла проверка.
    const [currentItem, incorrectBefore] = await Promise.all([
      prisma.lessonAssignmentItem.findUnique({ where: { id: item.id }, select: { result: true } }),
      prisma.lessonItemSubmission.count({
        where: { itemId: item.id, id: { not: submissionId }, verdict: SolutionVerdict.INCORRECT }
      })
    ]);
    const autoResult = decideAutoLessonResult({
      verdict,
      currentResult: currentItem?.result ?? null,
      hadIncorrectBefore: incorrectBefore > 0
    });
    const prefillResult = autoResult ? (autoResult as LessonItemResult) : null;
    const resultBefore = currentItem?.result ?? null;

    const finalized = await prisma.$transaction(async (transaction) => {
      const transition = await transaction.lessonItemSubmission.updateMany({
        where: { id: submissionId, status: SolutionCheckStatus.CHECKING, activeSlot: 1 },
        data: {
          status: SolutionCheckStatus.DONE,
          activeSlot: null,
          checkedAt: new Date(),
          verdict,
          recognizedAnswer: result.recognizedAnswer,
          comment: result.comment,
          confidence: result.confidence,
          errorKind: result.errorKind,
          errorNote: result.errorNote,
          injectionSuspected: result.injectionSuspected,
          injectionNote: result.injectionNote
        }
      });

      if (transition.count !== 1) {
        return false;
      }

      if (prefillResult) {
        // Гонка с ручной отметкой: пишем только поверх того итога, который видели.
        const applied = await transaction.lessonAssignmentItem.updateMany({
          where: { id: item.id, result: resultBefore },
          data: { result: prefillResult }
        });

        return applied.count === 1 ? "with-result" : "verdict-only";
      }

      return "verdict-only";
    });

    if (!finalized) {
      return;
    }

    let statusApplied = false;

    if (prefillResult && finalized === "with-result") {
      statusApplied = await mirrorLessonResultToStatus({
        studentId: participant.studentId,
        homeworkNumberId: number.id,
        result: prefillResult
      });
    }

    publishDashboardRealtimeEvent({
      kind: "lesson-activity",
      lessonId: lesson.id,
      teacherId: lesson.teacherId,
      studentId: participant.studentId
    });

    if (statusApplied) {
      publishDashboardRealtimeEvent({
        kind: "student-progress-changed",
        studentId: participant.studentId,
        topicId: number.topic.id
      });
    }

    try {
      revalidateAllPlatformData();
    } catch {
      // Вне request-контекста ревалидация может быть недоступна — страховка в GET-роуте статуса.
    }

    logInfoEvent("lesson_check.succeeded", {
      submissionId,
      lessonId: lesson.id,
      verdict,
      prefillResult,
      statusApplied,
      inputTokens: modelResponse.inputTokens,
      outputTokens: modelResponse.outputTokens
    });

    // Актор — ученик, сдавший номер: инициатор расхода именно он.
    await writeAuditLog({
      category: AuditCategory.AI,
      action: "lesson_item.check",
      actorId: participant.studentId,
      actorName: studentName,
      actorRole: UserRole.STUDENT,
      targetType: "LessonAssignmentItem",
      targetId: item.id,
      targetLabel: `№ ${number.number} · ${number.topic.title}`,
      summary: `Классная работа: № ${number.number} — ${
        verdict === SolutionVerdict.CORRECT ? "верно" : verdict === SolutionVerdict.INCORRECT ? "с ошибкой" : "не распознано"
      }`,
      model: config.model,
      inputTokens: aiInputTokens || null,
      outputTokens: aiOutputTokens || null,
      durationMs: Date.now() - modelStartedAt,
      meta: { submissionId, lessonId: lesson.id, aiCalls, photos: submission.photos.length }
    });
  } catch (error) {
    logErrorEvent("lesson_check.failed", { submissionId, lessonId: lesson.id }, error, "Lesson item check failed.");

    await writeAuditLog({
      category: AuditCategory.AI,
      action: "lesson_item.check",
      outcome: "failed",
      actorId: participant.studentId,
      actorName: studentName,
      actorRole: UserRole.STUDENT,
      targetType: "LessonAssignmentItem",
      targetId: item.id,
      targetLabel: `№ ${number.number} · ${number.topic.title}`,
      summary: "Проверка классной работы не удалась",
      model: config.model,
      inputTokens: aiInputTokens || null,
      outputTokens: aiOutputTokens || null,
      durationMs: Date.now() - modelStartedAt,
      error,
      meta: { submissionId, lessonId: lesson.id, aiCalls, modelCallStarted }
    });

    await failSubmission(error instanceof Error ? error.message : "Не удалось проверить решение.");

    publishDashboardRealtimeEvent({
      kind: "lesson-activity",
      lessonId: lesson.id,
      teacherId: lesson.teacherId,
      studentId: participant.studentId
    });
  }
}
