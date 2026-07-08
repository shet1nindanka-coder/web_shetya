import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { createTopicHomeworkNumbersInBatches } from "@/lib/topic-homework-numbers";
import { normalizeMultilineText, normalizeSingleLineText, parseNumbersInput } from "@/lib/utils";

export const runtime = "nodejs";

function revalidateTopicRoutes(topicId?: string) {
  revalidateAllPlatformData();
  publishDashboardRealtimeEvent({ kind: "topic-content-changed", topicId });
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath("/teacher/students");

  if (topicId) {
    revalidatePath("/student/homeworks");
    revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:topics-create", user.id, 12, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        numbers?: string;
        theoryFileId?: string;
        homeworkFileId?: string;
      }
    | null;

  const title = normalizeSingleLineText(String(body?.title ?? ""));
  const description = normalizeMultilineText(String(body?.description ?? ""));
  const numbers = parseNumbersInput(String(body?.numbers ?? ""));
  const theoryFileId = String(body?.theoryFileId ?? "").trim();
  const homeworkFileId = String(body?.homeworkFileId ?? "").trim();

  if (!title || !description || !numbers.length || !theoryFileId || !homeworkFileId) {
    return NextResponse.json(
      {
        error: "Проверьте форму: название, описание, оба файла и список номеров обязательны."
      },
      { status: 400 }
    );
  }

  const uploadedFiles = await prisma.storedFile.findMany({
    where: {
      id: { in: [theoryFileId, homeworkFileId] },
      uploadedById: user.id
    },
    select: {
      id: true
    }
  });

  if (uploadedFiles.length !== 2) {
    return NextResponse.json(
      {
        error: "Файлы не найдены или уже недоступны. Загрузите их заново."
      },
      { status: 400 }
    );
  }

  try {
    const topic = await prisma.$transaction(async (tx) => {
      const lastTopic = await tx.topic.findFirst({
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true }
      });

      const createdTopic = await tx.topic.create({
        data: {
          title,
          description,
          displayOrder: (lastTopic?.displayOrder ?? 0) + 1,
          theoryFileId,
          homeworkFileId
        },
        select: {
          id: true
        }
      });

      await createTopicHomeworkNumbersInBatches(
        tx,
        createdTopic.id,
        numbers.map((number, index) => ({
          number,
          displayOrder: index + 1
        }))
      );

      return createdTopic;
    });

    revalidateTopicRoutes(topic.id);

    logInfoEvent(
      "teacher.topic_api.create.succeeded",
      {
        ...requestContext,
        userId: user.id,
        topicId: topic.id,
        title,
        numberCount: numbers.length
      },
      "Topic was created through the teacher API route."
    );

    return NextResponse.json({
      redirectTo: "/teacher/topics?created=1"
    });
  } catch (error) {
    logErrorEvent(
      "teacher.topic_api.create.failed",
      {
        ...requestContext,
        userId: user.id,
        title,
        numberCount: numbers.length
      },
      error,
      "Failed to create topic from the teacher API route."
    );

    return NextResponse.json(
      {
        error: "Не удалось сохранить тему в базе данных. Проверьте подключение к PostgreSQL."
      },
      { status: 500 }
    );
  }
}
