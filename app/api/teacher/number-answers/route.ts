import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFileRecordIfUnused } from "@/lib/stored-files";
import { isImageMime } from "@/lib/utils";

export const runtime = "nodejs";

function revalidateTopicRoutes(topicId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        homeworkNumberId?: string;
        fileId?: string;
      }
    | null;

  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const fileId = String(body?.fileId ?? "").trim();

  if (!homeworkNumberId || !fileId) {
    return NextResponse.json({ error: "Номер и файл ответа обязательны." }, { status: 400 });
  }

  const [homeworkNumber, storedFile] = await Promise.all([
    prisma.topicHomeworkNumber.findUnique({
      where: { id: homeworkNumberId },
      select: {
        id: true,
        topicId: true,
        answerFileId: true
      }
    }),
    prisma.storedFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        uploadedAt: true,
        uploadedById: true
      }
    })
  ]);

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  if (!storedFile || storedFile.uploadedById !== user.id) {
    return NextResponse.json({ error: "Файл ответа не найден." }, { status: 400 });
  }

  if (!isImageMime(storedFile.mimeType)) {
    return NextResponse.json({ error: "Для ответа можно использовать только PNG или JPG." }, { status: 400 });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        answerFileId: fileId
      }
    });
  } catch (error) {
    console.error("Failed to attach answer file to homework number.", error);
    return NextResponse.json({ error: "Не удалось сохранить ответ к номеру." }, { status: 500 });
  }

  if (homeworkNumber.answerFileId && homeworkNumber.answerFileId !== fileId) {
    await deleteStoredFileRecordIfUnused(homeworkNumber.answerFileId);
  }

  revalidateTopicRoutes(homeworkNumber.topicId);

  return NextResponse.json({
    answerFile: {
      id: storedFile.id,
      originalName: storedFile.originalName,
      mimeType: storedFile.mimeType,
      size: storedFile.size,
      uploadedAt: storedFile.uploadedAt.toISOString()
    }
  });
}

export async function DELETE(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      answerFileId: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
  }

  if (!homeworkNumber.answerFileId) {
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.topicHomeworkNumber.update({
      where: { id: homeworkNumberId },
      data: {
        answerFileId: null
      }
    });
  } catch (error) {
    console.error("Failed to remove answer file from homework number.", error);
    return NextResponse.json({ error: "Не удалось удалить ответ к номеру." }, { status: 500 });
  }

  await deleteStoredFileRecordIfUnused(homeworkNumber.answerFileId);
  revalidateTopicRoutes(homeworkNumber.topicId);

  return NextResponse.json({ success: true });
}
