import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logErrorEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { normalizeMultilineText } from "@/lib/utils";

export const runtime = "nodejs";

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:number-conditions", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        homeworkNumberId?: string;
        conditionLatex?: string;
      }
    | null;

  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const conditionLatex = normalizeMultilineText(String(body?.conditionLatex ?? ""));

  if (!homeworkNumberId || !conditionLatex) {
    return NextResponse.json({ error: "Введите LaTeX-условие для номера." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findUnique({
    where: { id: homeworkNumberId },
    select: {
      id: true,
      topicId: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        conditionLatex
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.condition.save.failed",
      {
        ...requestContext,
        userId: user.id,
        homeworkNumberId,
        topicId: homeworkNumber.topicId
      },
      error,
      "Failed to save homework condition."
    );

    return NextResponse.json({ error: "Не удалось сохранить условие к номеру." }, { status: 500 });
  }

  revalidateTopicRoutes(homeworkNumber.topicId);
  publishDashboardRealtimeEvent({
    kind: "topic-content-changed",
    topicId: homeworkNumber.topicId
  });

  return NextResponse.json({
    conditionLatex
  });
}

export async function DELETE(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:number-conditions", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        homeworkNumberId?: string;
      }
    | null;

  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();

  if (!homeworkNumberId) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findUnique({
    where: { id: homeworkNumberId },
    select: {
      id: true,
      topicId: true,
      conditionLatex: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  if (!homeworkNumber.conditionLatex) {
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        conditionLatex: null
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.condition.delete.failed",
      {
        ...requestContext,
        userId: user.id,
        homeworkNumberId,
        topicId: homeworkNumber.topicId
      },
      error,
      "Failed to remove homework condition."
    );

    return NextResponse.json({ error: "Не удалось удалить условие к номеру." }, { status: 500 });
  }

  revalidateTopicRoutes(homeworkNumber.topicId);
  publishDashboardRealtimeEvent({
    kind: "topic-content-changed",
    topicId: homeworkNumber.topicId
  });

  return NextResponse.json({ success: true });
}
