import { AuditCategory, LessonKind, LessonStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { auditCurrentUser } from "@/lib/audit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { deriveLessonStatus } from "@/lib/lesson-status";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Досрочное завершение урока. Старт — автоматический по расписанию (startsAt),
 * поэтому «начать» руками нельзя; завершить раньше времени — можно:
 * finishedAt перекрывает расписание в deriveLessonStatus.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-finish", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      kind: LessonKind.LESSON,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: {
      id: true,
      title: true,
      teacherId: true,
      status: true,
      startsAt: true,
      finishedAt: true,
      durationMinutes: true
    }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  if (deriveLessonStatus(lesson) !== "ACTIVE") {
    return NextResponse.json({ error: "Урок сейчас не идёт — завершать нечего." }, { status: 409 });
  }

  try {
    await prisma.lesson.update({
      where: { id: lesson.id },
      // Хранимый status тоже двигаем: у урока без расписания он остаётся
      // фолбэком производной.
      data: { finishedAt: new Date(), status: LessonStatus.FINISHED }
    });
  } catch (error) {
    logErrorEvent(
      "lesson_live.finish_failed",
      { userId: user.id, lessonId: lesson.id },
      error instanceof Error ? error : undefined,
      "Failed to finish lesson."
    );

    return NextResponse.json({ error: "Не удалось завершить урок." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath(`/teacher/lessons/${lesson.id}`);
  revalidatePath("/teacher/lessons");
  revalidatePath("/student/lesson");

  publishDashboardRealtimeEvent({
    kind: "lesson-activity",
    lessonId: lesson.id,
    teacherId: lesson.teacherId
  });

  await auditCurrentUser({
    category: AuditCategory.DATA,
    action: "lesson.finish",
    targetType: "Lesson",
    targetId: lesson.id,
    targetLabel: lesson.title,
    summary: "Урок завершён досрочно"
  });

  logInfoEvent("lesson_live.finished", { userId: user.id, lessonId: lesson.id });

  return NextResponse.json({ ok: true });
}
