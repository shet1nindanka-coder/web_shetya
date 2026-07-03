import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { moveTopicByDirection } from "@/lib/teacher-topic-selection";

export const runtime = "nodejs";

function revalidateTopicRoutes() {
  revalidateAllPlatformData();
  publishDashboardRealtimeEvent({ kind: "topic-content-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath("/teacher/students");
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:topics-order", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        topicId?: string;
        direction?: string;
      }
    | null;

  const topicId = String(body?.topicId ?? "").trim();
  const direction = body?.direction === "up" || body?.direction === "down" ? body.direction : null;

  if (!topicId || !direction) {
    return NextResponse.json({ error: "Некорректный запрос на изменение порядка тем." }, { status: 400 });
  }

  try {
    const topics = await prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true
      }
    });

    const reordered = moveTopicByDirection(topics, topicId, direction);

    if (!reordered.moved) {
      return NextResponse.json({
        orderedTopicIds: topics.map((topic) => topic.id),
        moved: false
      });
    }

    await prisma.$transaction(
      reordered.topics.map((topic, index) =>
        prisma.topic.update({
          where: { id: topic.id },
          data: {
            displayOrder: index + 1
          }
        })
      )
    );

    revalidateTopicRoutes();

    logInfoEvent(
      "teacher.topic_order.succeeded",
      {
        ...requestContext,
        userId: user.id,
        topicId,
        direction,
        orderedTopicIds: reordered.topics.map((topic) => topic.id)
      },
      "Teacher topic order was updated successfully."
    );

    return NextResponse.json({
      orderedTopicIds: reordered.topics.map((topic) => topic.id),
      moved: true
    });
  } catch (error) {
    logErrorEvent(
      "teacher.topic_order.failed",
      {
        ...requestContext,
        userId: user.id,
        topicId,
        direction
      },
      error,
      "Failed to update topic order."
    );

    return NextResponse.json({ error: "Не удалось сохранить новый порядок тем." }, { status: 500 });
  }
}
