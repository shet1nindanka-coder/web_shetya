import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { MAX_PLAN_ITEMS } from "@/lib/lesson-plan";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Ручная правка набора: полная замена списка с сохранением порядка. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; participantId: string }> }
) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-items", user.id, 60, 60_000);

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
    select: {
      id: true,
      lessonId: true,
      items: { select: { homeworkNumberId: true, reason: true, minutes: true, comment: true } }
    }
  });

  if (!participant) {
    return NextResponse.json({ error: "Участник урока не найден." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { homeworkNumberIds?: string[] } | null;
  const requestedIds = Array.isArray(body?.homeworkNumberIds)
    ? body.homeworkNumberIds.map((value) => String(value).trim()).filter(Boolean)
    : null;

  if (!requestedIds) {
    return NextResponse.json({ error: "Передайте список номеров." }, { status: 400 });
  }

  const uniqueIds = Array.from(new Set(requestedIds)).slice(0, MAX_PLAN_ITEMS);

  const existingNumbers = await prisma.topicHomeworkNumber.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true }
  });
  const existingIdSet = new Set(existingNumbers.map((number) => number.id));
  const finalIds = uniqueIds.filter((id) => existingIdSet.has(id));

  // Свойства сохранённых ИИ-элементов не теряем при перестановке/удалении.
  const previousById = new Map(participant.items.map((item) => [item.homeworkNumberId, item]));

  try {
    await prisma.$transaction([
      prisma.lessonAssignmentItem.deleteMany({ where: { participantId: participant.id } }),
      ...(finalIds.length > 0
        ? [
            prisma.lessonAssignmentItem.createMany({
              data: finalIds.map((homeworkNumberId, order) => {
                const previous = previousById.get(homeworkNumberId);

                return {
                  participantId: participant.id,
                  homeworkNumberId,
                  order,
                  reason: previous?.reason ?? "NEW",
                  minutes: previous?.minutes ?? null,
                  comment: previous?.comment ?? null
                };
              })
            })
          ]
        : [])
    ]);

    logInfoEvent("lesson_plan.items_updated", {
      userId: user.id,
      lessonId: participant.lessonId,
      participantId: participant.id,
      items: finalIds.length
    });
  } catch (error) {
    logErrorEvent(
      "lesson_plan.items_update_failed",
      { userId: user.id, participantId: participant.id },
      error instanceof Error ? error : undefined,
      "Failed to update lesson items."
    );

    return NextResponse.json({ error: "Не удалось сохранить набор." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath(`/teacher/lessons/${participant.lessonId}`);

  return NextResponse.json({ ok: true, items: finalIds.length });
}
