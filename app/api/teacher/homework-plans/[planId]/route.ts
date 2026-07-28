import { LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Удалить черновик ДЗ. Уже выданные HomeworkAssignment не трогаем. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:homework-plan", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { planId } = await params;

  const plan = await prisma.lesson.findFirst({
    where: {
      id: planId,
      kind: LessonKind.HOMEWORK,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: { id: true }
  });

  if (!plan) {
    return NextResponse.json({ error: "Черновик не найден." }, { status: 404 });
  }

  try {
    await prisma.lesson.delete({ where: { id: plan.id } });
    logInfoEvent("homework_plan.deleted", { userId: user.id, planId: plan.id });
  } catch (error) {
    logErrorEvent(
      "homework_plan.delete_failed",
      { userId: user.id, planId: plan.id },
      error instanceof Error ? error : undefined,
      "Failed to delete homework plan."
    );

    return NextResponse.json({ error: "Не удалось удалить черновик." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath("/teacher/homework-plans");

  return NextResponse.json({ ok: true });
}
