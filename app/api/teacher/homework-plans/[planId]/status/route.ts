import { LessonKind, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Прогресс генерации черновика ДЗ: клиент поллит раз в 2 секунды. */
export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await params;

  const plan = await prisma.lesson.findFirst({
    where: {
      id: planId,
      kind: LessonKind.HOMEWORK,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: {
      id: true,
      participants: {
        orderBy: { student: { name: "asc" } },
        select: {
          id: true,
          studentId: true,
          planGeneratedAt: true,
          planError: true,
          issuedAssignmentId: true,
          issuedAt: true,
          student: { select: { name: true } },
          _count: { select: { items: true } }
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Черновик не найден." }, { status: 404 });
  }

  const participants = plan.participants.map((participant) => ({
    participantId: participant.id,
    studentId: participant.studentId,
    name: participant.student.name,
    planGeneratedAt: participant.planGeneratedAt,
    planError: participant.planError,
    issuedAssignmentId: participant.issuedAssignmentId,
    issuedAt: participant.issuedAt,
    itemsCount: participant._count.items
  }));

  const ready = participants.filter((participant) => participant.planGeneratedAt).length;
  const failed = participants.filter((participant) => !participant.planGeneratedAt && participant.planError).length;
  const issued = participants.filter((participant) => participant.issuedAssignmentId).length;

  return NextResponse.json({
    total: participants.length,
    ready,
    failed,
    issued,
    pending: participants.length - ready - failed,
    participants
  });
}
