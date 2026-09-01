import { LessonKind, Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Снапшот активности урока для поллинг-фолбэка панели (основной канал — SSE).
 * Отдаёт компактную сигнатуру: сдачи и вход учеников; доска сравнивает её и
 * делает router.refresh() при изменении.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-live", user.id, 120, 60_000);

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
      finishedAt: true,
      participants: { select: { id: true, joinedAt: true } }
    }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  let submissionSignature = "";

  try {
    const submissions = await prisma.lessonItemSubmission.findMany({
      where: { item: { participant: { lessonId: lesson.id } } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: { id: true, itemId: true, status: true, submittedAt: true, checkedAt: true }
    });

    submissionSignature = submissions
      .map(
        (submission) =>
          `${submission.itemId}:${submission.status}:${submission.submittedAt.getTime()}:${submission.checkedAt?.getTime() ?? 0}`
      )
      .join("|");
  } catch (error) {
    // До миграции сдач таблицы нет — сигнатура пустая, поллинг работает.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022"))
    ) {
      throw error;
    }
  }

  const signature = [
    lesson.finishedAt?.getTime() ?? 0,
    lesson.participants
      .map((participant) => `${participant.id}:${participant.joinedAt?.getTime() ?? 0}`)
      .join("|"),
    submissionSignature
  ].join("#");

  return NextResponse.json({ signature });
}
