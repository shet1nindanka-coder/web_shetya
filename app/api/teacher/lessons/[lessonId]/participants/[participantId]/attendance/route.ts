import { AttendanceStatus, LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowed = Object.values(AttendanceStatus);

/** Ручная отметка посещаемости участника занятия (таблица на странице группы). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; participantId: string }> }
) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-attendance", user.id, 240, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId, participantId } = await params;
  const body = (await request.json().catch(() => null)) as { attendance?: unknown } | null;
  const attendance = body?.attendance as AttendanceStatus | undefined;

  if (!attendance || !allowed.includes(attendance)) {
    return NextResponse.json({ error: "Некорректная отметка." }, { status: 400 });
  }

  // Чужой урок для учителя неотличим от несуществующего (SEC-002).
  const participant = await prisma.lessonParticipant.findFirst({
    where: {
      id: participantId,
      lessonId,
      lesson: { kind: LessonKind.LESSON, ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id }) }
    },
    select: { id: true, studentId: true, lesson: { select: { id: true, teacherId: true, groupId: true } } }
  });

  if (!participant) {
    return NextResponse.json({ error: "Участник занятия не найден." }, { status: 404 });
  }

  try {
    await prisma.lessonParticipant.update({ where: { id: participant.id }, data: { attendance } });
  } catch (error) {
    logErrorEvent(
      "lesson_live.attendance_update_failed",
      { userId: user.id, participantId: participant.id },
      error instanceof Error ? error : undefined,
      "Failed to save attendance."
    );

    return NextResponse.json({ error: "Не удалось сохранить отметку." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath(`/teacher/lessons/${lessonId}`);

  if (participant.lesson.groupId) {
    revalidatePath(`/teacher/groups/${participant.lesson.groupId}`);
  }

  publishDashboardRealtimeEvent({
    kind: "lesson-activity",
    lessonId: participant.lesson.id,
    teacherId: participant.lesson.teacherId,
    studentId: participant.studentId
  });

  logInfoEvent("lesson_live.attendance_set", { userId: user.id, lessonId, participantId: participant.id, attendance });

  return NextResponse.json({ ok: true, attendance });
}
