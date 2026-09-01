import { LessonKind, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { deriveLessonStatus } from "@/lib/lesson-status";
import { logInfoEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * «Я в классе»: вкладка урока зовёт этот роут при открытии идущего занятия.
 * Первый вызов ставит joinedAt — панель учителя видит, кто уже за партой,
 * и от этого момента считается простой.
 */
export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-join", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as { lessonId?: string } | null;
  const lessonId = String(body?.lessonId ?? "").trim();

  if (!lessonId) {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  const participant = await prisma.lessonParticipant.findFirst({
    where: { lessonId, studentId: user.id, lesson: { kind: LessonKind.LESSON } },
    select: {
      id: true,
      joinedAt: true,
      lesson: {
        select: { id: true, teacherId: true, status: true, startsAt: true, finishedAt: true, durationMinutes: true }
      }
    }
  });

  if (!participant) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  if (deriveLessonStatus(participant.lesson) !== "ACTIVE") {
    return NextResponse.json({ error: "Урок сейчас не идёт." }, { status: 409 });
  }

  if (!participant.joinedAt) {
    await prisma.lessonParticipant.update({
      where: { id: participant.id },
      data: { joinedAt: new Date() }
    });

    publishDashboardRealtimeEvent({
      kind: "lesson-activity",
      lessonId: participant.lesson.id,
      teacherId: participant.lesson.teacherId,
      studentId: user.id
    });

    logInfoEvent("lesson_live.joined", { studentId: user.id, lessonId: participant.lesson.id });
  }

  return NextResponse.json({ ok: true });
}
