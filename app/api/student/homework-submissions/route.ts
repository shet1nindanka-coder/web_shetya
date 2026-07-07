import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { deleteOwnedStoredFileIfUnused } from "@/lib/stored-files";
import { getFileExtension, getMimeTypeFromExtension } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_PHOTOS_PER_ASSIGNMENT = 10;
const MAX_PHOTO_SIZE = 15 * 1024 * 1024;
const allowedPhotoMimeTypes = new Set(["image/png", "image/jpeg"]);

function isMissingSubmissionTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkAssignment") || error.message.includes("HomeworkSubmissionPhoto"))
  );
}

function revalidateSubmissionRoutes(studentId: string, topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/student");
  revalidatePath("/student/deadlines");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:homework-submissions", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!assignmentId || !files.length) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  for (const file of files) {
    const mimeType = file.type || getMimeTypeFromExtension(getFileExtension(file.name));

    if (!allowedPhotoMimeTypes.has(mimeType)) {
      return NextResponse.json({ error: "Можно загружать только фото в формате PNG или JPG." }, { status: 400 });
    }

    if (file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Файл слишком большой. Максимальный размер — 15 МБ." }, { status: 400 });
    }
  }

  let assignment: { id: string; topicId: string; photosCount: number } | null;

  try {
    const found = await prisma.homeworkAssignment.findFirst({
      where: {
        id: assignmentId,
        studentId: user.id
      },
      select: {
        id: true,
        topicId: true,
        _count: {
          select: { photos: true }
        }
      }
    });

    assignment = found ? { id: found.id, topicId: found.topicId, photosCount: found._count.photos } : null;
  } catch (error) {
    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json(
        { error: "Таблица фото ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!assignment) {
    return NextResponse.json({ error: "ДЗ не найдено." }, { status: 404 });
  }

  if (assignment.photosCount + files.length > MAX_PHOTOS_PER_ASSIGNMENT) {
    return NextResponse.json(
      { error: `К одному ДЗ можно прикрепить не больше ${MAX_PHOTOS_PER_ASSIGNMENT} фото.` },
      { status: 400 }
    );
  }

  const createdPhotos: Array<{ id: string; fileId: string }> = [];

  for (const file of files) {
    const storedUpload = await saveUploadedFile(file);
    const photo = await prisma.homeworkSubmissionPhoto.create({
      data: {
        assignmentId: assignment.id,
        file: {
          create: {
            originalName: storedUpload.originalName,
            storageKey: storedUpload.storageKey,
            mimeType: storedUpload.mimeType,
            size: storedUpload.size,
            uploadedById: user.id
          }
        }
      },
      select: {
        id: true,
        fileId: true
      }
    });

    createdPhotos.push(photo);
  }

  revalidateSubmissionRoutes(user.id, assignment.topicId);
  publishDashboardRealtimeEvent({
    kind: "student-progress-changed",
    studentId: user.id,
    topicId: assignment.topicId
  });
  logInfoEvent("homework.submission.uploaded", {
    studentId: user.id,
    assignmentId: assignment.id,
    photosCount: createdPhotos.length
  });

  return NextResponse.json({ ok: true, photos: createdPhotos });
}

export async function DELETE(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:homework-submissions", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as { photoId?: string } | null;
  const photoId = String(body?.photoId ?? "").trim();

  if (!photoId) {
    return NextResponse.json({ error: "Некорректные данные для удаления фото." }, { status: 400 });
  }

  let photo: { id: string; fileId: string; assignmentId: string; topicId: string } | null;

  try {
    const found = await prisma.homeworkSubmissionPhoto.findFirst({
      where: {
        id: photoId,
        assignment: {
          studentId: user.id
        }
      },
      select: {
        id: true,
        fileId: true,
        assignment: {
          select: {
            id: true,
            topicId: true
          }
        }
      }
    });

    photo = found
      ? { id: found.id, fileId: found.fileId, assignmentId: found.assignment.id, topicId: found.assignment.topicId }
      : null;
  } catch (error) {
    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json(
        { error: "Таблица фото ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!photo) {
    return NextResponse.json({ error: "Фото не найдено." }, { status: 404 });
  }

  await prisma.homeworkSubmissionPhoto.delete({ where: { id: photo.id } });
  await deleteOwnedStoredFileIfUnused(photo.fileId, user.id);

  revalidateSubmissionRoutes(user.id, photo.topicId);
  publishDashboardRealtimeEvent({
    kind: "student-progress-changed",
    studentId: user.id,
    topicId: photo.topicId
  });
  logInfoEvent("homework.submission.deleted", {
    studentId: user.id,
    assignmentId: photo.assignmentId,
    photoId: photo.id
  });

  return NextResponse.json({ ok: true });
}
