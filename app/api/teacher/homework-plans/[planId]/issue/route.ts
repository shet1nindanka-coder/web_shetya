import { LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { issueHomework } from "@/lib/homework-issue";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Выдать ДЗ по черновику: для каждого участника создаётся обычный
 * HomeworkAssignment. Выдача частично успешна по своей природе: конфликт
 * у одного ученика не срывает остальных. Повторное нажатие идемпотентно —
 * уже выданные участники пропускаются молча.
 */
export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:homework-plan", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { planId } = await params;
  const body = (await request.json().catch(() => null)) as { participantIds?: string[] } | null;
  const requestedIds = Array.isArray(body?.participantIds)
    ? body.participantIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const plan = await prisma.lesson.findFirst({
    where: {
      id: planId,
      kind: LessonKind.HOMEWORK,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: {
      id: true,
      title: true,
      topicId: true,
      deadlineAt: true,
      planParams: true,
      participants: {
        orderBy: { student: { name: "asc" } },
        select: {
          id: true,
          studentId: true,
          issuedAssignmentId: true,
          student: { select: { name: true } },
          items: {
            orderBy: { order: "asc" },
            select: { homeworkNumberId: true }
          }
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Черновик не найден." }, { status: 404 });
  }

  if (!plan.topicId || !plan.deadlineAt) {
    return NextResponse.json({ error: "У черновика нет темы или дедлайна." }, { status: 400 });
  }

  if (plan.deadlineAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Дедлайн уже прошёл — создайте новый черновик с актуальной датой." },
      { status: 400 }
    );
  }

  const requestedSet = new Set(requestedIds);
  const targets = plan.participants.filter(
    (participant) => requestedSet.size === 0 || requestedSet.has(participant.id)
  );
  const title = (plan.planParams as { title?: string } | null)?.title ?? plan.title;

  const issued: Array<{ participantId: string; studentId: string; name: string; assignmentId: string }> = [];
  const failed: Array<{ participantId: string; studentId: string; name: string; message: string }> = [];

  for (const participant of targets) {
    // Идемпотентность: уже выданных пропускаем молча.
    if (participant.issuedAssignmentId) {
      continue;
    }

    if (participant.items.length === 0) {
      failed.push({
        participantId: participant.id,
        studentId: participant.studentId,
        name: participant.student.name,
        message: "Набор пуст — добавьте номера."
      });
      continue;
    }

    try {
      const result = await issueHomework({
        studentId: participant.studentId,
        issuedBy: { id: user.id, role: user.role },
        topicId: plan.topicId,
        homeworkNumberIds: participant.items.map((item) => item.homeworkNumberId),
        deadlineAt: plan.deadlineAt,
        title
      });

      if (!result.ok) {
        failed.push({
          participantId: participant.id,
          studentId: participant.studentId,
          name: participant.student.name,
          message: result.message
        });
        continue;
      }

      await prisma.lessonParticipant.update({
        where: { id: participant.id },
        data: { issuedAssignmentId: result.assignmentId, issuedAt: new Date() }
      });
      issued.push({
        participantId: participant.id,
        studentId: participant.studentId,
        name: participant.student.name,
        assignmentId: result.assignmentId
      });
    } catch (error) {
      logErrorEvent(
        "homework_plan.issue_failed",
        { userId: user.id, planId: plan.id, participantId: participant.id },
        error instanceof Error ? error : undefined,
        "Homework plan issue crashed for a participant."
      );
      failed.push({
        participantId: participant.id,
        studentId: participant.studentId,
        name: participant.student.name,
        message: "Внутренняя ошибка — подробности в логах сервера."
      });
    }
  }

  logInfoEvent("homework_plan.issued", {
    userId: user.id,
    planId: plan.id,
    issued: issued.length,
    failed: failed.length
  });
  revalidateTeacherStudentsData();
  revalidatePath(`/teacher/homework-plans/${plan.id}`);
  revalidatePath("/teacher/homework-plans");

  return NextResponse.json({ ok: true, issued, failed });
}
