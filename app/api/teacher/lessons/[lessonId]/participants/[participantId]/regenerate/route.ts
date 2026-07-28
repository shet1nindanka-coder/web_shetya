import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { LessonPlanUnavailableError, resolvePlannerGate } from "@/lib/lesson-plan-generate";
import { enqueueLessonPlan } from "@/lib/lesson-plan-queue";
import { logInfoEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string; participantId: string }> }
) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-plan", user.id, 10, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId, participantId } = await params;

  const participant = await prisma.lessonParticipant.findFirst({
    where: {
      id: participantId,
      lessonId,
      lesson: user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id }
    },
    select: { id: true, lessonId: true, issuedAssignmentId: true, lesson: { select: { kind: true } } }
  });

  if (!participant) {
    return NextResponse.json({ error: "Участник урока не найден." }, { status: 404 });
  }

  if (participant.issuedAssignmentId) {
    return NextResponse.json({ error: "ДЗ уже выдано. Сначала отмените его." }, { status: 409 });
  }

  const isHomework = participant.lesson.kind === "HOMEWORK";
  const settings = await getSiteSettingsUncached();
  const enabled = isHomework ? settings.homeworkPlanEnabled : settings.lessonPlanEnabled;

  if (!enabled || !resolvePlannerGate(settings)) {
    return NextResponse.json({ error: new LessonPlanUnavailableError().message }, { status: 503 });
  }

  // Сбрасываем состояние, чтобы UI показал «в процессе» до конца генерации.
  await prisma.lessonParticipant.update({
    where: { id: participant.id },
    data: { planGeneratedAt: null, planError: null }
  });

  enqueueLessonPlan(participant.lessonId, [participant.id], isHomework ? "HOMEWORK" : "LESSON");
  logInfoEvent("lesson_plan.regenerate_requested", {
    userId: user.id,
    lessonId: participant.lessonId,
    participantId: participant.id
  });

  return NextResponse.json({ ok: true });
}
