import { HomeworkNumberStatus, LessonItemResult, LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Итог урока → статус ученика: решил — зелёный, с ошибками — жёлтый, не решил — красный
// (красный возвращает номер в кандидаты будущих подборов). «Не успел» (SKIPPED)
// статус не трогает: до номера не дошли, и домашний прогресс по нему остаётся каким был.
const RESULT_TO_STATUS: Partial<Record<LessonItemResult, HomeworkNumberStatus>> = {
  [LessonItemResult.SOLVED]: HomeworkNumberStatus.GREEN,
  [LessonItemResult.PARTIAL]: HomeworkNumberStatus.YELLOW,
  [LessonItemResult.NOT_SOLVED]: HomeworkNumberStatus.RED
};

const allowedResults = Object.values(LessonItemResult);

/** Итог урока по одному номеру. Снятие итога (result: null) очищает и статус номера. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; participantId: string; itemId: string }> }
) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-item-result", user.id, 240, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId, participantId, itemId } = await params;

  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const resultProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "result"));
  const result = (body?.result ?? null) as LessonItemResult | null;

  if (!resultProvided || (result !== null && !allowedResults.includes(result))) {
    return NextResponse.json({ error: "Некорректный итог." }, { status: 400 });
  }

  const item = await prisma.lessonAssignmentItem.findFirst({
    where: {
      id: itemId,
      participantId,
      participant: {
        lessonId,
        lesson: {
          kind: LessonKind.LESSON,
          ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
        }
      }
    },
    select: {
      id: true,
      result: true,
      homeworkNumberId: true,
      participant: { select: { studentId: true, lesson: { select: { teacherId: true } } } },
      homeworkNumber: { select: { topicId: true } }
    }
  });

  if (!item) {
    return NextResponse.json({ error: "Задача урока не найдена." }, { status: 404 });
  }

  const studentId = item.participant.studentId;
  // Статус зеркалится только для итогов, у которых он есть; снятие итога
  // очищает статус лишь если прежний итог его выставлял (после «не успел»
  // чистить нечего — иначе стёрли бы домашний прогресс ученика).
  const status = result === null ? null : (RESULT_TO_STATUS[result] ?? null);
  const touchesStatus =
    result === null ? item.result !== null && item.result !== LessonItemResult.SKIPPED : status !== null;

  try {
    await prisma.$transaction([
      prisma.lessonAssignmentItem.update({
        where: { id: item.id },
        data: { result }
      }),
      // Зеркало в статус ученика — как у выдачи ДЗ с дедлайнами: кабинет ученика,
      // карта тем и подбор видят итог урока сразу.
      ...(touchesStatus
        ? [
            prisma.studentTopicNumberStatus.upsert({
              where: { studentId_homeworkNumberId: { studentId, homeworkNumberId: item.homeworkNumberId } },
              update: { status, statusChangedAt: new Date() },
              create: { studentId, homeworkNumberId: item.homeworkNumberId, status, statusChangedAt: new Date() }
            })
          ]
        : [])
    ]);
  } catch (error) {
    logErrorEvent(
      "lesson_plan.result_update_failed",
      { userId: user.id, itemId: item.id },
      error instanceof Error ? error : undefined,
      "Failed to save lesson item result."
    );

    return NextResponse.json({ error: "Не удалось сохранить итог." }, { status: 500 });
  }

  revalidateAllPlatformData();
  revalidatePath(`/teacher/lessons/${lessonId}`);
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/student");
  revalidatePath("/student/lesson");

  publishDashboardRealtimeEvent({
    kind: "student-progress-changed",
    studentId,
    topicId: item.homeworkNumber.topicId
  });
  // Вкладка «Урок» у ученика серверная: ручная переразметка должна доехать
  // до неё сразу (student-progress-changed ученику refresh не делает — только стрик).
  publishDashboardRealtimeEvent({
    kind: "lesson-activity",
    lessonId,
    teacherId: item.participant.lesson.teacherId,
    studentId
  });

  logInfoEvent("lesson_plan.result_set", {
    userId: user.id,
    lessonId,
    participantId,
    itemId: item.id,
    result: result ?? "CLEARED"
  });

  return NextResponse.json({ ok: true, result });
}
