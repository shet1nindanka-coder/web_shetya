import { AuditCategory, LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { auditCurrentUser } from "@/lib/audit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Назначить или перенести время урока. Старт живого урока автоматический
 * (по startsAt), поэтому у ручной сборки без времени это единственный способ
 * стать «идущей» и появиться у ученика во вкладке «Урок».
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-schedule", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;
  const body = (await request.json().catch(() => null)) as { startsAt?: string } | null;
  const startsAtRaw = String(body?.startsAt ?? "").trim();
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;

  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Некорректные дата и время урока." }, { status: 400 });
  }

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      kind: LessonKind.LESSON,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: { id: true, title: true, teacherId: true, finishedAt: true }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  if (lesson.finishedAt) {
    return NextResponse.json({ error: "Урок уже завершён — время не переносится." }, { status: 409 });
  }

  try {
    await prisma.lesson.update({ where: { id: lesson.id }, data: { startsAt } });
  } catch (error) {
    logErrorEvent(
      "lesson_live.schedule_failed",
      { userId: user.id, lessonId: lesson.id },
      error instanceof Error ? error : undefined,
      "Failed to schedule lesson."
    );

    return NextResponse.json({ error: "Не удалось назначить время урока." }, { status: 500 });
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
    action: "lesson.schedule",
    targetType: "Lesson",
    targetId: lesson.id,
    targetLabel: lesson.title,
    summary: `Время урока: ${formatDateTime(startsAt)}`
  });

  logInfoEvent("lesson_live.scheduled", { userId: user.id, lessonId: lesson.id, startsAt: startsAt.toISOString() });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-delete", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: { id: true }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  try {
    // Участники и их задания удаляются каскадом (onDelete: Cascade).
    await prisma.lesson.delete({ where: { id: lesson.id } });
    logInfoEvent("lesson_plan.lesson_deleted", { userId: user.id, lessonId: lesson.id });
  } catch (error) {
    logErrorEvent(
      "lesson_plan.lesson_delete_failed",
      { userId: user.id, lessonId: lesson.id },
      error instanceof Error ? error : undefined,
      "Failed to delete lesson."
    );

    return NextResponse.json({ error: "Не удалось удалить урок." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath("/teacher/lessons");

  return NextResponse.json({ ok: true });
}
