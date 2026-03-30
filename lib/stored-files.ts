import { prisma } from "@/lib/prisma";
import { removeStoredFile } from "@/lib/storage";

function scheduleStoredFileCleanup(storageKey: string) {
  void removeStoredFile(storageKey).catch((error) => {
    console.error("Failed to remove file from storage after deleting DB record.", error);
  });
}

export async function countStoredFileUsages(fileId: string) {
  const [topicUsageCount, answerUsageCount] = await Promise.all([
    prisma.topic.count({
      where: {
        OR: [{ theoryFileId: fileId }, { homeworkFileId: fileId }]
      }
    }),
    prisma.topicHomeworkNumber.count({
      where: {
        answerFileId: fileId
      }
    })
  ]);

  return topicUsageCount + answerUsageCount;
}

export async function deleteStoredFileRecordIfUnused(fileId: string | null | undefined) {
  if (!fileId) {
    return;
  }

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file) {
    return;
  }

  const usageCount = await countStoredFileUsages(fileId);

  if (usageCount > 0) {
    return;
  }

  await prisma.storedFile.delete({
    where: { id: fileId }
  });

  scheduleStoredFileCleanup(file.storageKey);
}

export async function deleteOwnedStoredFileIfUnused(fileId: string | null | undefined, userId: string) {
  if (!fileId) {
    return;
  }

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file || file.uploadedById !== userId) {
    return;
  }

  await deleteStoredFileRecordIfUnused(fileId);
}
