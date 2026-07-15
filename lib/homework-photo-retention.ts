import { logErrorEvent, logInfoEvent } from "@/lib/logger";

const DEFAULT_RETENTION_DAYS = 365;
const BATCH_SIZE = 200;
const MAX_BATCHES_PER_SWEEP = 20;

// Срок хранения фото решений (текущих и снапшотов проверок).
// HOMEWORK_PHOTO_RETENTION_DAYS: положительное число — срок в днях,
// 0 или отрицательное — автоудаление выключено, не задано — 365 дней.
export function getHomeworkPhotoRetentionDays(rawValue = process.env.HOMEWORK_PHOTO_RETENTION_DAYS) {
  if (rawValue === undefined || rawValue.trim() === "") {
    return DEFAULT_RETENTION_DAYS;
  }

  const raw = Number(rawValue);

  if (!Number.isFinite(raw)) {
    return DEFAULT_RETENTION_DAYS;
  }

  return raw > 0 ? Math.floor(raw) : null;
}

async function pruneBatch(cutoff: Date) {
  // Prisma и stored-files тянутся лениво, чтобы модуль можно было
  // импортировать в юнит-тестах без подключения к БД.
  const { prisma } = await import("@/lib/prisma");
  const { deleteStoredFileRecordIfUnused } = await import("@/lib/stored-files");

  const [submissionPhotos, checkPhotos] = await Promise.all([
    prisma.homeworkSubmissionPhoto.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, fileId: true },
      take: BATCH_SIZE
    }),
    prisma.homeworkCheckPhoto.findMany({
      where: { check: { createdAt: { lt: cutoff } } },
      select: { id: true, fileId: true },
      take: BATCH_SIZE
    })
  ]);

  if (submissionPhotos.length === 0 && checkPhotos.length === 0) {
    return { submissionPhotos: 0, checkPhotos: 0, files: 0 };
  }

  if (submissionPhotos.length > 0) {
    await prisma.homeworkSubmissionPhoto.deleteMany({
      where: { id: { in: submissionPhotos.map((photo) => photo.id) } }
    });
  }

  if (checkPhotos.length > 0) {
    await prisma.homeworkCheckPhoto.deleteMany({
      where: { id: { in: checkPhotos.map((photo) => photo.id) } }
    });
  }

  const fileIds = Array.from(new Set([...submissionPhotos, ...checkPhotos].map((photo) => photo.fileId)));
  let files = 0;

  for (const fileId of fileIds) {
    try {
      await deleteStoredFileRecordIfUnused(fileId);
      files += 1;
    } catch (error) {
      logErrorEvent(
        "retention.photo_file_delete_failed",
        { fileId },
        error instanceof Error ? error : undefined,
        "Failed to delete expired homework photo file."
      );
    }
  }

  return { submissionPhotos: submissionPhotos.length, checkPhotos: checkPhotos.length, files };
}

export async function pruneExpiredHomeworkPhotos(now = new Date()) {
  const retentionDays = getHomeworkPhotoRetentionDays();

  if (!retentionDays) {
    return { submissionPhotos: 0, checkPhotos: 0, files: 0 };
  }

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const total = { submissionPhotos: 0, checkPhotos: 0, files: 0 };

  for (let batch = 0; batch < MAX_BATCHES_PER_SWEEP; batch += 1) {
    const result = await pruneBatch(cutoff);
    total.submissionPhotos += result.submissionPhotos;
    total.checkPhotos += result.checkPhotos;
    total.files += result.files;

    if (result.submissionPhotos === 0 && result.checkPhotos === 0) {
      break;
    }
  }

  if (total.submissionPhotos > 0 || total.checkPhotos > 0) {
    logInfoEvent("retention.homework_photos_pruned", {
      retentionDays,
      cutoff: cutoff.toISOString(),
      ...total
    });
  }

  return total;
}
