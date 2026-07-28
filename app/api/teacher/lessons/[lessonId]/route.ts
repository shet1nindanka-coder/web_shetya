import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-delete", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: { id: true }
  });

  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  try {
    // Участники и их задания удаляются каскадом (onDelete: Cascade).
    await prisma.lesson.delete({ where: { id: lesson.id } });
    logInfoEvent("lesson_plan.lesson_deleted", { userId: user.id, lessonId: lesson.id });
  } catch (error) {
    logErrorEvent(
      "lesson_plan.lesson_delete_failed",
      { userId: user.id, lessonId: lesson.id },
      error instanceof Error ? error : undefined,
      "Failed to delete lesson."
    );

    return NextResponse.json({ error: "Не удалось удалить урок." }, { status: 500 });
  }

  revalidateTeacherStudentsData();
  revalidatePath("/teacher/lessons");

  return NextResponse.json({ ok: true });
}
