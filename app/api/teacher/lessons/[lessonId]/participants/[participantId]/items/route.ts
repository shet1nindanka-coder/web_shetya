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
      issuedAssignmentId: true,
      items: { select: { homeworkNumberId: true, reason: true, minutes: true, comment: true, isExtra: true, result: true } }
    }
  });

  if (!participant) {
    return NextResponse.json({ error: "Участник урока не найден." }, { status: 404 });
  }

  if (participant.issuedAssignmentId) {
    return NextResponse.json({ error: "ДЗ уже выдано. Сначала отмените его." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as
    | { homeworkNumberIds?: string[]; extraHomeworkNumberIds?: string[] }
    | null;
  const requestedIds = Array.isArray(body?.homeworkNumberIds)
    ? body.homeworkNumberIds.map((value) => String(value).trim()).filter(Boolean)
    : null;
  const requestedExtraIds = Array.isArray(body?.extraHomeworkNumberIds)
    ? body.extraHomeworkNumberIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (!requestedIds) {
    return NextResponse.json({ error: "Передайте список номеров." }, { status: 400 });
  }

  const uniqueIds = Array.from(new Set(requestedIds)).slice(0, MAX_PLAN_ITEMS);
  const mainIdSet = new Set(uniqueIds);
  // Номер не может быть одновременно в основной и дополнительной части — основная в приоритете.
  const uniqueExtraIds = Array.from(new Set(requestedExtraIds))
    .filter((id) => !mainIdSet.has(id))
    .slice(0, MAX_PLAN_ITEMS);

  const existingNumbers = await prisma.topicHomeworkNumber.findMany({
    where: { id: { in: [...uniqueIds, ...uniqueExtraIds] } },
    select: { id: true }
  });
  const existingIdSet = new Set(existingNumbers.map((number) => number.id));
  const finalIds = uniqueIds.filter((id) => existingIdSet.has(id));
  const finalExtraIds = uniqueExtraIds.filter((id) => existingIdSet.has(id));

  // Свойства сохранённых ИИ-элементов не теряем при перестановке/удалении.
  const previousById = new Map(participant.items.map((item) => [item.homeworkNumberId, item]));

  try {
    const rows = [
      ...finalIds.map((homeworkNumberId, order) => {
        const previous = previousById.get(homeworkNumberId);

        return {
          participantId: participant.id,
          homeworkNumberId,
          order,
          reason: previous?.reason ?? ("NEW" as const),
          minutes: previous?.minutes ?? null,
          comment: previous?.comment ?? null,
          result: previous?.result ?? null,
          isExtra: false
        };
      }),
      ...finalExtraIds.map((homeworkNumberId, order) => {
        const previous = previousById.get(homeworkNumberId);

        return {
          participantId: participant.id,
          homeworkNumberId,
          order: finalIds.length + order,
          reason: previous?.reason ?? ("NEW" as const),
          minutes: previous?.minutes ?? null,
          comment: previous?.comment ?? null,
          result: previous?.result ?? null,
          isExtra: true
        };
      })
    ];

    await prisma.$transaction([
      prisma.lessonAssignmentItem.deleteMany({ where: { participantId: participant.id } }),
      ...(rows.length > 0 ? [prisma.lessonAssignmentItem.createMany({ data: rows })] : [])
    ]);

    logInfoEvent("lesson_plan.items_updated", {
      userId: user.id,
      lessonId: participant.lessonId,
      participantId: participant.id,
      items: finalIds.length + finalExtraIds.length
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
