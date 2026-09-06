import { LessonItemResult, LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { runProgressTransaction } from "@/lib/progress-write";

export const runtime = "nodejs";

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
  try {
    await runProgressTransaction(async (tx, writeProgress) => {
      const current = await tx.lessonAssignmentItem.findUniqueOrThrow({ where: { id: item.id }, select: { result: true } });
      await tx.lessonAssignmentItem.update({
        where: { id: item.id },
        data: { result }
      });
      await writeProgress({
        studentId, homeworkNumberId: item.homeworkNumberId,
        source: "lesson_teacher", result, previousResult: current.result,
        actor: user, references: { lessonId, itemId: item.id }
      });
    });
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
