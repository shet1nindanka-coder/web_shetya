import { LessonKind, Prisma, SolutionCheckStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import {
  failStaleLessonSubmissions,
  LESSON_CHECK_GLOBAL_BUDGET_IDENTIFIER,
  LESSON_CHECK_GLOBAL_BUDGET_SCOPE,
  LESSON_CHECK_GLOBAL_BUDGET_WINDOW_MS
} from "@/lib/lesson-item-check";
import {
  canSubmitLessonItem,
  isExtraPartUnlocked,
  LESSON_SUBMISSION_MAX_PHOTOS
} from "@/lib/lesson-live";
import { deriveLessonStatus } from "@/lib/lesson-status";
import { logInfoEvent, logWarnEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";
import { toStudentFacingResult } from "@/lib/solution-check-student-view";
import { enqueueLessonItemCheck, getHomeworkCheckQueueLength } from "@/lib/solution-check-queue";
import { removeStoredFile, saveUploadedFile } from "@/lib/storage";
import {
  MAX_UPLOAD_SIZE_BYTES,
  UploadValidationError,
  validateUploadMetadata
} from "@/lib/upload-validation";

export const runtime = "nodejs";

const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;
const MAX_BODY_SIZE = MAX_UPLOAD_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
const allowedPhotoExtensions = new Set([".png", ".jpg", ".jpeg"]);

function isMissingSubmissionTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("LessonItemSubmission") || error.message.includes("LessonSubmissionPhoto"))
  );
}

function getMultipartLengthError(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return NextResponse.json({ error: "Ожидается multipart-загрузка фотографий." }, { status: 415 });
  }

  const rawContentLength = request.headers.get("content-length");

  if (!rawContentLength || !/^\d+$/.test(rawContentLength)) {
    return NextResponse.json({ error: "Некорректный Content-Length." }, { status: 400 });
  }

  const contentLength = Number(rawContentLength);

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return NextResponse.json({ error: "Некорректный Content-Length." }, { status: 400 });
  }

  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Суммарный размер загрузки не должен превышать 15 МБ." }, { status: 413 });
  }

  return null;
}

async function cleanupStoredUploads(uploads: Array<Awaited<ReturnType<typeof saveUploadedFile>>>) {
  await Promise.allSettled(uploads.map((upload) => removeStoredFile(upload.storageKey)));
}

/** Сдача решения одного номера урока: фото + постановка ИИ-проверки в очередь. */
export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const settings = await getSiteSettings();

  if (getHomeworkCheckQueueLength() >= 20) {
    return NextResponse.json(
      { error: "Очередь проверки переполнена. Попробуйте через несколько минут." },
      { status: 503, headers: { "Retry-After": "120" } }
    );
  }

  // Почасовой лимит ученика — ранний: гасит долбёжку до всякой работы (SEC-006).
  const rateLimitResponse = await enforceApiRateLimit(
    "api:lesson-checks",
    user.id,
    settings.lessonCheckPerStudentHourlyLimit,
    60 * 60_000
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!settings.aiEnabled || !settings.lessonCheckEnabled || !getAiCheckConfig(settings)) {
    return NextResponse.json(
      { error: "Проверка классной работы сейчас отключена. Покажите решение учителю." },
      { status: 503 }
    );
  }

  const multipartLengthError = getMultipartLengthError(request);

  if (multipartLengthError) {
    return multipartLengthError;
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  const itemId = String(formData.get("itemId") ?? "").trim();
  const fileEntries = formData.getAll("files");

  if (
    !itemId ||
    !fileEntries.length ||
    fileEntries.some((entry) => !(entry instanceof File) || entry.size <= 0)
  ) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  const files = fileEntries as File[];

  if (files.length > LESSON_SUBMISSION_MAX_PHOTOS) {
    return NextResponse.json(
      { error: `К одному номеру можно прикрепить не больше ${LESSON_SUBMISSION_MAX_PHOTOS} фото.` },
      { status: 400 }
    );
  }

  const aggregateFileSize = files.reduce((total, file) => total + file.size, 0);

  if (!Number.isSafeInteger(aggregateFileSize) || aggregateFileSize > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "Суммарный размер фотографий не должен превышать 15 МБ." }, { status: 413 });
  }

  try {
    for (const file of files) {
      const { extension } = validateUploadMetadata(file.name, file.type, file.size);

      if (!allowedPhotoExtensions.has(extension)) {
        throw new UploadValidationError("Можно загружать только фото в формате PNG или JPG.");
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof UploadValidationError ? error.message : "Файл не прошёл проверку." },
      { status: 400 }
    );
  }

  // Скоупинг на уровне запроса: номер должен принадлежать участию ЭТОГО
  // ученика в уроке (SEC-002/003) — чужой набор неотличим от несуществующего.
  const item = await prisma.lessonAssignmentItem.findFirst({
    where: { id: itemId, participant: { studentId: user.id, lesson: { kind: LessonKind.LESSON } } },
    select: {
      id: true,
      isExtra: true,
      result: true,
      homeworkNumber: { select: { number: true, topic: { select: { id: true } } } },
      participant: {
        select: {
          id: true,
          joinedAt: true,
          lesson: {
            select: { id: true, teacherId: true, status: true, startsAt: true, finishedAt: true, durationMinutes: true }
          }
        }
      }
    }
  });

  if (!item) {
    return NextResponse.json({ error: "Номер урока не найден." }, { status: 404 });
  }

  const lesson = item.participant.lesson;

  if (deriveLessonStatus(lesson) !== "ACTIVE") {
    return NextResponse.json({ error: "Урок сейчас не идёт — сдать решение нельзя." }, { status: 409 });
  }

  // Освобождаем зависшие сдачи, иначе уникальный activeSlot вечно отвечает 409.
  await failStaleLessonSubmissions(lesson.id, user.id);

  // Состояние набора: закрытые номера не пересдаются, доп. часть заперта
  // до закрытия основной. Проверка на уровне API, а не UI.
  let participantItems: Array<{ id: string; isExtra: boolean; result: string | null; latestVerdict: string | null }>;

  try {
    const rows = await prisma.lessonAssignmentItem.findMany({
      where: { participantId: item.participant.id },
      select: {
        id: true,
        isExtra: true,
        result: true,
        submissions: {
          where: { status: SolutionCheckStatus.DONE },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { verdict: true }
        }
      }
    });

    participantItems = rows.map((row) => ({
      id: row.id,
      isExtra: row.isExtra,
      result: row.result,
      latestVerdict: row.submissions[0]?.verdict ?? null
    }));
  } catch (error) {
    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json(
        { error: "Таблица сдач ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
  }

  const currentItem = participantItems.find((row) => row.id === item.id);

  if (currentItem && !canSubmitLessonItem(currentItem)) {
    return NextResponse.json({ error: `№ ${item.homeworkNumber.number} уже принят.` }, { status: 409 });
  }

  if (item.isExtra && !isExtraPartUnlocked(participantItems)) {
    return NextResponse.json(
      { error: "Дополнительная часть откроется, когда будет закрыта основная." },
      { status: 409 }
    );
  }

  const storedUploads: Array<Awaited<ReturnType<typeof saveUploadedFile>>> = [];

  try {
    for (const file of files) {
      storedUploads.push(await saveUploadedFile(file));
    }
  } catch (error) {
    await cleanupStoredUploads(storedUploads);

    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  let submissionId: string;

  try {
    submissionId = await prisma.$transaction(
      async (transaction) => {
        const storedFileIds: string[] = [];

        for (const storedUpload of storedUploads) {
          const storedFile = await transaction.storedFile.create({
            data: {
              originalName: storedUpload.originalName,
              storageKey: storedUpload.storageKey,
              mimeType: storedUpload.mimeType,
              size: storedUpload.size,
              uploadedById: user.id
            },
            select: { id: true }
          });

          storedFileIds.push(storedFile.id);
        }

        const submission = await transaction.lessonItemSubmission.create({
          data: {
            itemId: item.id,
            activeSlot: 1,
            photos: {
              create: storedFileIds.map((fileId, order) => ({ fileId, order }))
            }
          },
          select: { id: true }
        });

        // Сдача — тоже «я в классе»: страхуемся, если join-роут не сработал.
        if (!item.participant.joinedAt) {
          await transaction.lessonParticipant.updateMany({
            where: { id: item.participant.id, joinedAt: null },
            data: { joinedAt: new Date() }
          });
        }

        return submission.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    await cleanupStoredUploads(storedUploads);

    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json(
        { error: "Таблица сдач ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Проверка этого номера уже идёт — дождитесь результата." }, { status: 409 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Другой запрос одновременно изменил сдачу. Повторите загрузку." },
        { status: 409 }
      );
    }

    throw error;
  }

  // Отдельный дневной кошелёк классной работы; списывается после создания
  // строки, с откатом при исчерпании (SEC-006, как у проверок ДЗ).
  const globalLimitResponse = await enforceApiRateLimit(
    LESSON_CHECK_GLOBAL_BUDGET_SCOPE,
    LESSON_CHECK_GLOBAL_BUDGET_IDENTIFIER,
    settings.lessonCheckDailyLimit,
    LESSON_CHECK_GLOBAL_BUDGET_WINDOW_MS
  );

  if (globalLimitResponse) {
    await prisma.lessonItemSubmission.delete({ where: { id: submissionId } }).catch((error: unknown) => {
      logWarnEvent(
        "lesson_check.budget_rollback_failed",
        { submissionId, studentId: user.id },
        error,
        "Failed to remove a lesson submission after the daily lesson AI budget was exhausted."
      );
    });

    return globalLimitResponse;
  }

  enqueueLessonItemCheck(submissionId);

  revalidatePath("/student/lesson");
  revalidatePath(`/teacher/lessons/${lesson.id}`);

  publishDashboardRealtimeEvent({
    kind: "lesson-activity",
    lessonId: lesson.id,
    teacherId: lesson.teacherId,
    studentId: user.id
  });

  logInfoEvent("lesson_check.enqueued", {
    submissionId,
    lessonId: lesson.id,
    studentId: user.id,
    number: item.homeworkNumber.number,
    photosCount: files.length
  });

  return NextResponse.json({ ok: true, submissionId });
}

/** Поллинг-фолбэк вкладки урока: последние сдачи ученика по номерам занятия. */
export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-check-status", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const url = new URL(request.url);
  const lessonId = String(url.searchParams.get("lessonId") ?? "").trim();

  if (!lessonId) {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  await failStaleLessonSubmissions(lessonId, user.id);

  let submissions: Array<{
    id: string;
    itemId: string;
    status: SolutionCheckStatus;
    verdict: string | null;
    recognizedAnswer: string | null;
    comment: string | null;
    error: string | null;
    submittedAt: Date;
    checkedAt: Date | null;
    item: { homeworkNumber: { number: string } };
  }>;

  try {
    submissions = await prisma.lessonItemSubmission.findMany({
      where: { item: { participant: { lessonId, studentId: user.id } } },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        itemId: true,
        status: true,
        verdict: true,
        recognizedAnswer: true,
        comment: true,
        error: true,
        submittedAt: true,
        checkedAt: true,
        item: { select: { homeworkNumber: { select: { number: true } } } }
      }
    });
  } catch (error) {
    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json({ submissions: [] });
    }

    throw error;
  }

  const latestByItemId = new Map<string, (typeof submissions)[number]>();

  for (const submission of submissions) {
    if (!latestByItemId.has(submission.itemId)) {
      latestByItemId.set(submission.itemId, submission);
    }
  }

  const latest = Array.from(latestByItemId.values());

  // Свежезавершённые проверки: страница серверная, кэши надо подтолкнуть
  // (воркер мог отработать вне request-контекста, где revalidate недоступен).
  const recentTerminal = latest.some(
    (submission) =>
      (submission.status === SolutionCheckStatus.DONE || submission.status === SolutionCheckStatus.FAILED) &&
      submission.checkedAt &&
      Date.now() - submission.checkedAt.getTime() < 5 * 60_000
  );

  if (recentTerminal && url.searchParams.get("consume") === "1") {
    revalidateAllPlatformData();
    revalidatePath("/student/lesson");
    revalidatePath(`/teacher/lessons/${lessonId}`);
  }

  return NextResponse.json({
    submissions: latest.map((submission) => {
      // Ученику — причёсанный вид, как у автопроверки ДЗ (PROD-011):
      // UNCERTAIN получает нейтральный комментарий, диагностика не отдаётся.
      const facing =
        submission.status === SolutionCheckStatus.DONE && submission.verdict
          ? toStudentFacingResult({
              number: submission.item.homeworkNumber.number,
              verdict: submission.verdict as "CORRECT" | "INCORRECT" | "UNCERTAIN",
              recognizedAnswer: submission.recognizedAnswer,
              comment: submission.comment
            })
          : null;

      return {
        id: submission.id,
        itemId: submission.itemId,
        status: submission.status,
        verdict: facing?.verdict ?? null,
        recognizedAnswer: facing?.recognizedAnswer ?? null,
        comment: facing?.comment ?? null,
        error: submission.status === SolutionCheckStatus.FAILED ? submission.error : null,
        submittedAt: submission.submittedAt.toISOString(),
        checkedAt: submission.checkedAt ? submission.checkedAt.toISOString() : null
      };
    })
  });
}
