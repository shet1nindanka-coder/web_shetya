import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logError } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { createTopicHomeworkNumbersInBatches } from "@/lib/topic-homework-numbers";
import { parseNumbersInput } from "@/lib/utils";

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
    revalidatePath(`/student/topics/${topicId}`);
    revalidatePath(`/teacher/topics/${topicId}`);
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
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

    return NextResponse.json({
      redirectTo: "/teacher/topics?created=1"
    });
  } catch (error) {
    logError(
      "Failed to create topic from API route.",
      {
        ...requestContext,
        userId: user.id,
        title,
        numberCount: numbers.length
      },
      error
    );

    return NextResponse.json(
      {
        error: "Не удалось сохранить тему в базе данных. Проверьте подключение к PostgreSQL."
      },
      { status: 500 }
    );
  }
}
