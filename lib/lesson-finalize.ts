import { AuditCategory, LessonItemResult, LessonKind, LessonStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { mirrorLessonResultToStatus } from "@/lib/lesson-item-check";
import { decideEndOfLessonResult } from "@/lib/lesson-live";
import { deriveLessonStatus } from "@/lib/lesson-status";
import { logInfoEvent, logWarnEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

/*
 * Закрытие итогов завершённого урока (правило владельца): урок кончился —
 * номер, который ученик вообще не сдавал, получает «не успел» (мог не дойти
 * и до основной части), сдавал без зачёта — «не решил».
 *
 * Старт и конец урока считаются по расписанию, поэтому «момента завершения»
 * как события нет. Закрытие ленивое: вызывается при открытии доски, списка
 * уроков и вкладки ученика — и только для уроков, закончившихся недавно.
 * Окно нужно, чтобы исторические уроки, размеченные (или не размеченные)
 * до появления живого урока, не получили задним числом красные статусы.
 * Хранимый Lesson.status = FINISHED служит меткой «итоги закрыты».
 */
export const LESSON_FINALIZE_WINDOW_MS = 48 * 60 * 60_000;
// Верхняя граница длительности урока (lib/lesson-plan.ts, MAX_DURATION_MINUTES).
const MAX_LESSON_DURATION_MS = 240 * 60_000;

function isRecoverableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")
  );
}

/** Закрывает итоги одного урока. Идемпотентно: повторный вызов ничего не меняет. */
export async function finalizeLessonResults(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, kind: LessonKind.LESSON },
    select: {
      id: true,
      title: true,
      teacherId: true,
      status: true,
      startsAt: true,
      finishedAt: true,
      durationMinutes: true,
      participants: {
        select: {
          id: true,
          studentId: true,
          items: {
            select: {
              id: true,
              isExtra: true,
              result: true,
              homeworkNumberId: true,
              // Любая сдача, даже неудачная: «не сдавал» — значит, фото не отправлял вовсе.
              submissions: { take: 1, select: { id: true } }
            }
          }
        }
      }
    }
  });

  if (!lesson || lesson.status === LessonStatus.FINISHED) {
    return { finalized: false, notSolved: 0, skipped: 0 };
  }

  if (deriveLessonStatus(lesson) !== "FINISHED") {
    return { finalized: false, notSolved: 0, skipped: 0 };
  }

  const updates: Array<{ itemId: string; studentId: string; homeworkNumberId: string; result: LessonItemResult }> = [];

  for (const participant of lesson.participants) {
    for (const item of participant.items) {
      const decision = decideEndOfLessonResult({
        currentResult: item.result,
        hasSubmission: item.submissions.length > 0
      });

      if (decision) {
        updates.push({
          itemId: item.id,
          studentId: participant.studentId,
          homeworkNumberId: item.homeworkNumberId,
          result: decision === "SKIPPED" ? LessonItemResult.SKIPPED : LessonItemResult.NOT_SOLVED
        });
      }
    }
  }

  await prisma.$transaction([
    // Только поверх пустого итога: учитель мог разметить номер между чтением и записью.
    ...updates.map((update) =>
      prisma.lessonAssignmentItem.updateMany({
        where: { id: update.itemId, result: null },
        data: { result: update.result }
      })
    ),
    prisma.lesson.update({ where: { id: lesson.id }, data: { status: LessonStatus.FINISHED } })
  ]);

  for (const update of updates) {
    if (update.result === LessonItemResult.NOT_SOLVED) {
      await mirrorLessonResultToStatus({
        studentId: update.studentId,
        homeworkNumberId: update.homeworkNumberId,
        result: update.result
      });
    }
  }

  const notSolved = updates.filter((update) => update.result === LessonItemResult.NOT_SOLVED).length;
  const skipped = updates.length - notSolved;

  if (updates.length > 0) {
    try {
      revalidateAllPlatformData();
    } catch {
      // Вне request-контекста ревалидация может быть недоступна.
    }

    publishDashboardRealtimeEvent({ kind: "lesson-activity", lessonId: lesson.id, teacherId: lesson.teacherId });
  }

  await writeAuditLog({
    category: AuditCategory.DATA,
    action: "lesson.auto_results",
    targetType: "Lesson",
    targetId: lesson.id,
    targetLabel: lesson.title,
    summary: `Итоги закрыты автоматически: не решил — ${notSolved}, не успел — ${skipped}`,
    meta: { notSolved, skipped }
  });
  logInfoEvent("lesson_live.results_finalized", { lessonId: lesson.id, notSolved, skipped });

  return { finalized: true, notSolved, skipped };
}

/**
 * Ленивое закрытие недавно закончившихся уроков в заданном скоупе.
 * Ошибки гасятся: закрытие итогов не должно ронять страницу.
 */
export async function finalizeRecentlyFinishedLessons(scope: {
  lessonId?: string;
  teacherId?: string;
  studentId?: string;
}) {
  const now = Date.now();

  try {
    const candidates = await prisma.lesson.findMany({
      where: {
        kind: LessonKind.LESSON,
        status: { not: LessonStatus.FINISHED },
        ...(scope.lessonId ? { id: scope.lessonId } : {}),
        ...(scope.teacherId ? { teacherId: scope.teacherId } : {}),
        ...(scope.studentId ? { participants: { some: { studentId: scope.studentId } } } : {}),
        OR: [
          { finishedAt: { gte: new Date(now - LESSON_FINALIZE_WINDOW_MS) } },
          {
            startsAt: {
              lte: new Date(now),
              gte: new Date(now - LESSON_FINALIZE_WINDOW_MS - MAX_LESSON_DURATION_MS)
            }
          }
        ]
      },
      select: { id: true, status: true, startsAt: true, finishedAt: true, durationMinutes: true },
      take: 50
    });

    for (const lesson of candidates) {
      if (deriveLessonStatus(lesson, now) !== "FINISHED") {
        continue;
      }

      const endedAt = lesson.finishedAt
        ? lesson.finishedAt.getTime()
        : (lesson.startsAt?.getTime() ?? 0) + Math.max(0, lesson.durationMinutes) * 60_000;

      if (endedAt < now - LESSON_FINALIZE_WINDOW_MS) {
        continue;
      }

      await finalizeLessonResults(lesson.id);
    }
  } catch (error) {
    if (!isRecoverableError(error)) {
      logWarnEvent(
        "lesson_live.finalize_failed",
        { scope },
        error instanceof Error ? error : undefined,
        "Failed to finalize finished lessons."
      );
    }
  }
}
