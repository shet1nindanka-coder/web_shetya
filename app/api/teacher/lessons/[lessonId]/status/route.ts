import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Прогресс фоновой генерации: клиент поллит раз в 2 секунды до pending === 0. */
export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
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
          student: { select: { name: true } },
          _count: { select: { items: true } }
        }
      }
    }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  const participants = lesson.participants.map((participant) => ({
    participantId: participant.id,
    studentId: participant.studentId,
    name: participant.student.name,
    planGeneratedAt: participant.planGeneratedAt,
    planError: participant.planError,
    itemsCount: participant._count.items
  }));

  const ready = participants.filter((participant) => participant.planGeneratedAt).length;
  const failed = participants.filter((participant) => !participant.planGeneratedAt && participant.planError).length;

  return NextResponse.json({
    total: participants.length,
    ready,
    failed,
    pending: participants.length - ready - failed,
    participants
  });
}
