import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent } from "@/lib/logger";
import { MAX_DIFFICULTY, MIN_DIFFICULTY } from "@/lib/number-tagging";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/teacher/topics");
  revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:number-difficulty", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        homeworkNumberId?: string;
        difficulty?: number | null;
      }
    | null;

  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const difficultyRaw = body?.difficulty ?? null;
  const difficulty =
    difficultyRaw === null
      ? null
      : Number.isInteger(difficultyRaw) && difficultyRaw >= MIN_DIFFICULTY && difficultyRaw <= MAX_DIFFICULTY
        ? difficultyRaw
        : undefined;

  if (!homeworkNumberId || difficulty === undefined) {
    return NextResponse.json({ error: "Укажите сложность от 1 до 10 или сбросьте её." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findUnique({
    where: { id: homeworkNumberId },
    select: { id: true, topicId: true }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        difficulty,
        // Сброс сложности возвращает номер в очередь ИИ-разметки.
        difficultySource: difficulty === null ? null : "manual"
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.difficulty.save.failed",
      {
        ...requestContext,
        userId: user.id,
        homeworkNumberId,
        topicId: homeworkNumber.topicId
      },
      error,
      "Failed to save number difficulty."
    );

    return NextResponse.json({ error: "Не удалось сохранить сложность." }, { status: 500 });
  }

  revalidateTopicRoutes(homeworkNumber.topicId);

  return NextResponse.json({
    difficulty,
    difficultySource: difficulty === null ? null : "manual"
  });
}
