import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { removeStoredFile, saveUploadedFile } from "@/lib/storage";
import { deleteOwnedStoredFileIfUnused } from "@/lib/stored-files";
import {
  MAX_UPLOAD_SIZE_BYTES,
  UploadValidationError,
  validateUploadMetadata
} from "@/lib/upload-validation";

export const runtime = "nodejs";

const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;
const MAX_STUDENT_UPLOAD_BODY_SIZE = MAX_UPLOAD_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
const allowedPhotoExtensions = new Set([".png", ".jpg", ".jpeg"]);

class AssignmentNotFoundError extends Error {}
class PhotoLimitExceededError extends Error {}

function getMultipartLengthError(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return NextResponse.json({ error: "Ожидается multipart-загрузка фотографий." }, { status: 415 });
  }

  const rawContentLength = request.headers.get("content-length");

  if (!rawContentLength) {
    return NextResponse.json({ error: "Для загрузки фотографий обязателен Content-Length." }, { status: 411 });
  }

  if (!/^\d+$/.test(rawContentLength)) {
    return NextResponse.json({ error: "Некорректный Content-Length." }, { status: 400 });
  }

  const contentLength = Number(rawContentLength);

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return NextResponse.json({ error: "Некорректный Content-Length." }, { status: 400 });
  }

  if (contentLength > MAX_STUDENT_UPLOAD_BODY_SIZE) {
    return NextResponse.json({ error: "Суммарный размер загрузки не должен превышать 15 МБ." }, { status: 413 });
  }

  return null;
}

async function cleanupStoredUploads(uploads: Array<Awaited<ReturnType<typeof saveUploadedFile>>>) {
  await Promise.allSettled(uploads.map((upload) => removeStoredFile(upload.storageKey)));
}

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
  revalidatePath("/student/homeworks");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function POST(request: Request) {
  const { maxPhotosPerAssignment: maxPhotos } = await getSiteSettings();
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:homework-submissions", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const multipartLengthError = getMultipartLengthError(request);

  if (multipartLengthError) {
    return multipartLengthError;
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const fileEntries = formData.getAll("files");

  if (
    !assignmentId ||
    !fileEntries.length ||
    fileEntries.some((entry) => !(entry instanceof File) || entry.size <= 0)
  ) {
    return NextResponse.json({ error: "Некорректные данные для загрузки фото." }, { status: 400 });
  }

  const files = fileEntries as File[];
  const aggregateFileSize = files.reduce((total, file) => total + file.size, 0);

  if (!Number.isSafeInteger(aggregateFileSize) || aggregateFileSize > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "Суммарный размер фотографий не должен превышать 15 МБ." }, { status: 413 });
  }

  try {
    for (const file of files) {
      const { extension } = validateUploadMetadata(file.name, file.type, file.size);

      if (!allowedPhotoExtensions.has(extension)) {
        throw new UploadValidationError("Можно загружать только фото в формате PNG или JPG.");
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof UploadValidationError ? error.message : "Файл не прошёл проверку." },
      { status: 400 }
    );
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

  if (assignment.photosCount + files.length > maxPhotos) {
    return NextResponse.json(
      { error: `К одному ДЗ можно прикрепить не больше ${maxPhotos} фото.` },
      { status: 400 }
    );
  }

  const storedUploads: Array<Awaited<ReturnType<typeof saveUploadedFile>>> = [];

  try {
    for (const file of files) {
      storedUploads.push(await saveUploadedFile(file));
    }
  } catch (error) {
    await cleanupStoredUploads(storedUploads);

    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  let createdPhotos: Array<{ id: string; fileId: string }>;

  try {
    createdPhotos = await prisma.$transaction(
      async (transaction) => {
        const currentAssignment = await transaction.homeworkAssignment.findFirst({
          where: {
            id: assignment.id,
            studentId: user.id
          },
          select: {
            id: true,
            _count: {
              select: { photos: true }
            }
          }
        });

        if (!currentAssignment) {
          throw new AssignmentNotFoundError();
        }

        if (currentAssignment._count.photos + storedUploads.length > maxPhotos) {
          throw new PhotoLimitExceededError();
        }

        const photos: Array<{ id: string; fileId: string }> = [];

        for (const storedUpload of storedUploads) {
          const storedFile = await transaction.storedFile.create({
            data: {
              originalName: storedUpload.originalName,
              storageKey: storedUpload.storageKey,
              mimeType: storedUpload.mimeType,
              size: storedUpload.size,
              uploadedById: user.id
            },
            select: { id: true }
          });
          const photo = await transaction.homeworkSubmissionPhoto.create({
            data: {
              assignmentId: currentAssignment.id,
              fileId: storedFile.id
            },
            select: {
              id: true,
              fileId: true
            }
          });

          photos.push(photo);
        }

        return photos;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    // Транзакция либо создала все записи, либо ни одной. При любом конфликте
    // удаляем уже записанные storage-объекты, чтобы они не стали сиротами.
    await cleanupStoredUploads(storedUploads);

    if (error instanceof AssignmentNotFoundError) {
      return NextResponse.json({ error: "ДЗ не найдено." }, { status: 404 });
    }

    if (error instanceof PhotoLimitExceededError) {
      return NextResponse.json(
        { error: `К одному ДЗ можно прикрепить не больше ${maxPhotos} фото.` },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Другой запрос одновременно изменил фотографии. Повторите загрузку." },
        { status: 409 }
      );
    }

    if (isMissingSubmissionTableError(error)) {
      return NextResponse.json(
        { error: "Таблица фото ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
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
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:homework-submissions", user.id, 60, 60_000);

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
