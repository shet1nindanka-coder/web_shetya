import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logErrorEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { deleteStoredFileRecordIfUnused } from "@/lib/stored-files";

export const runtime = "nodejs";

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath("/student/homeworks");
  revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:number-answers", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        homeworkNumberId?: string;
        answerLatex?: string;
      }
    | null;

  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const answerLatex = String(body?.answerLatex ?? "").trim();

  if (!homeworkNumberId || !answerLatex) {
    return NextResponse.json({ error: "Введите LaTeX-ответ для номера." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findUnique({
    where: { id: homeworkNumberId },
    select: {
      id: true,
      topicId: true,
      answerFileId: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        answerLatex,
        answerFileId: null
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.answer.save.failed",
      {
        ...requestContext,
        userId: user.id,
        homeworkNumberId,
        topicId: homeworkNumber.topicId
      },
      error,
      "Failed to save homework answer."
    );
    return NextResponse.json({ error: "Не удалось сохранить ответ к номеру." }, { status: 500 });
  }

  if (homeworkNumber.answerFileId) {
    await deleteStoredFileRecordIfUnused(homeworkNumber.answerFileId);
  }

  revalidateTopicRoutes(homeworkNumber.topicId);
  publishDashboardRealtimeEvent({
    kind: "topic-content-changed",
    topicId: homeworkNumber.topicId
  });

  return NextResponse.json({
    answerLatex
  });
}

export async function DELETE(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:number-answers", user.id, 60, 60_000);

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
      answerFileId: true,
      answerLatex: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  if (!homeworkNumber.answerFileId && !homeworkNumber.answerLatex) {
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        answerLatex: null,
        answerFileId: null
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.answer.delete.failed",
      {
        ...requestContext,
        userId: user.id,
        homeworkNumberId,
        topicId: homeworkNumber.topicId
      },
      error,
      "Failed to remove homework answer."
    );
    return NextResponse.json({ error: "Не удалось удалить ответ к номеру." }, { status: 500 });
  }

  await deleteStoredFileRecordIfUnused(homeworkNumber.answerFileId);
  revalidateTopicRoutes(homeworkNumber.topicId);
  publishDashboardRealtimeEvent({
    kind: "topic-content-changed",
    topicId: homeworkNumber.topicId
  });

  return NextResponse.json({ success: true });
}
