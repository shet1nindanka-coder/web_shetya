"use server";

import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-monitoring";
import { deleteStoredFileRecordIfUnused } from "@/lib/stored-files";
import { removeStoredFile, saveUploadedFile } from "@/lib/storage";
import { createTopicHomeworkNumbersInBatches } from "@/lib/topic-homework-numbers";
import { parseNumbersInput } from "@/lib/utils";

const numberStatuses: HomeworkNumberStatus[] = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
];

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

function redirectTeacherTopicsWithStatus(params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `/teacher/topics?${query}` : "/teacher/topics");
}

function redirectTeacherTopicWithStatus(topicId: string, params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `/teacher/topics/${topicId}?${query}` : `/teacher/topics/${topicId}`);
}

function getTopicFileKind(value: FormDataEntryValue | null) {
  return value === "theory" || value === "homework" ? value : null;
}

async function cleanupUploadedStorageKeys(
  storageKeys: Array<string | null | undefined>,
  context: Record<string, unknown> = {}
) {
  const cleanupResults = await Promise.allSettled(storageKeys.map((storageKey) => removeStoredFile(storageKey)));

  cleanupResults.forEach((result, index) => {
    if (result.status === "rejected") {
      reportServerError(
        "Failed to cleanup uploaded file from storage.",
        {
          ...context,
          storageKey: storageKeys[index] ?? null
        },
        result.reason
      );
    }
  });
}

async function cleanupStoredFileIds(fileIds: Iterable<string>, context: Record<string, unknown> = {}) {
  const fileIdsList = Array.from(fileIds);
  const cleanupResults = await Promise.allSettled(fileIdsList.map((fileId) => deleteStoredFileRecordIfUnused(fileId)));

  cleanupResults.forEach((result, index) => {
    if (result.status === "rejected") {
      reportServerError(
        "Failed to cleanup stored file record after topic update.",
        {
          ...context,
          fileId: fileIdsList[index] ?? null
        },
        result.reason
      );
    }
  });
}

export async function createTopicAction(formData: FormData) {
  const user = await requireUser(UserRole.TEACHER);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const numbers = parseNumbersInput(String(formData.get("numbers") ?? ""));
  const theoryFileId = String(formData.get("theoryFileId") ?? "").trim();
  const homeworkFileId = String(formData.get("homeworkFileId") ?? "").trim();
  const theoryFile = formData.get("theoryFile");
  const homeworkFile = formData.get("homeworkFile");
  const usePreUploadedFiles = Boolean(theoryFileId && homeworkFileId);

  if (
    !title ||
    !description ||
    !numbers.length ||
    (!usePreUploadedFiles &&
      (!(theoryFile instanceof File) ||
        theoryFile.size === 0 ||
        !(homeworkFile instanceof File) ||
        homeworkFile.size === 0))
  ) {
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "invalid" }));
  }

  let theoryUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let homeworkUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let finalTheoryFileId = theoryFileId || null;
  let finalHomeworkFileId = homeworkFileId || null;

  if (usePreUploadedFiles) {
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
      redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "upload" }));
    }
  }

  if (!usePreUploadedFiles) {
    const validTheoryFile = theoryFile as File;
    const validHomeworkFile = homeworkFile as File;

    try {
      theoryUpload = await saveUploadedFile(validTheoryFile);
      homeworkUpload = await saveUploadedFile(validHomeworkFile);
    } catch (error) {
      reportServerError("Failed to upload files while creating topic.", { teacherId: user.id, title }, error);
      await cleanupUploadedStorageKeys([theoryUpload?.storageKey, homeworkUpload?.storageKey], {
        teacherId: user.id,
        title,
        stage: "create-topic-upload"
      });
      redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "upload" }));
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lastTopic = await tx.topic.findFirst({
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true }
      });

      if (theoryUpload) {
        const createdTheoryFile = await tx.storedFile.create({
          data: {
            ...theoryUpload,
            uploadedById: user.id
          }
        });

        finalTheoryFileId = createdTheoryFile.id;
      }

      if (homeworkUpload) {
        const createdHomeworkFile = await tx.storedFile.create({
          data: {
            ...homeworkUpload,
            uploadedById: user.id
          }
        });

        finalHomeworkFileId = createdHomeworkFile.id;
      }

      const createdTopic = await tx.topic.create({
        data: {
          title,
          description,
          displayOrder: (lastTopic?.displayOrder ?? 0) + 1,
          theoryFileId: finalTheoryFileId,
          homeworkFileId: finalHomeworkFileId
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
    });
  } catch (error) {
    reportServerError(
      "Failed to create topic in database.",
      {
        teacherId: user.id,
        title,
        numberCount: numbers.length
      },
      error
    );
    await cleanupUploadedStorageKeys([theoryUpload?.storageKey, homeworkUpload?.storageKey], {
      teacherId: user.id,
      title,
      stage: "create-topic-db"
    });

    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "save" }));
  }

  revalidateTopicRoutes();
  redirectTeacherTopicsWithStatus(new URLSearchParams({ created: "1" }));
}

export async function updateTopicAction(formData: FormData) {
  const user = await requireUser(UserRole.TEACHER);

  const topicId = String(formData.get("topicId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const numbers = parseNumbersInput(String(formData.get("numbers") ?? ""));
  const theoryFile = formData.get("theoryFile");
  const homeworkFile = formData.get("homeworkFile");

  if (!topicId || !title || !description || !numbers.length) {
    if (topicId) {
      redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ error: "invalid" }));
    }

    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "invalid" }));
  }

  const existingTopic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      theoryFileId: true,
      homeworkFileId: true,
      homeworkNumbers: {
        select: {
          id: true,
          number: true,
          displayOrder: true,
          answerFileId: true
        }
      }
    }
  });

  if (!existingTopic) {
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "save" }));
  }

  const topicToUpdate = existingTopic!;

  let theoryUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let homeworkUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;

  try {
    theoryUpload = theoryFile instanceof File && theoryFile.size > 0 ? await saveUploadedFile(theoryFile) : null;
    homeworkUpload =
      homeworkFile instanceof File && homeworkFile.size > 0 ? await saveUploadedFile(homeworkFile) : null;
  } catch (error) {
    reportServerError(
      "Failed to upload replacement file while updating topic.",
      { teacherId: user.id, topicId },
      error
    );
    await cleanupUploadedStorageKeys([theoryUpload?.storageKey, homeworkUpload?.storageKey], {
      teacherId: user.id,
      topicId,
      stage: "update-topic-upload"
    });
    redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ error: "upload" }));
  }

  let oldTheoryFileIdToDelete: string | null = null;
  let oldHomeworkFileIdToDelete: string | null = null;
  const removedAnswerFileIds = new Set<string>();

  try {
    await prisma.$transaction(async (tx) => {
      const createdTheoryFile = theoryUpload
        ? await tx.storedFile.create({
            data: {
              ...theoryUpload,
              uploadedById: user.id
            }
          })
        : null;

      const createdHomeworkFile = homeworkUpload
        ? await tx.storedFile.create({
            data: {
              ...homeworkUpload,
              uploadedById: user.id
            }
          })
        : null;

      let theoryFileId = topicToUpdate.theoryFileId;
      let homeworkFileId = topicToUpdate.homeworkFileId;

      if (createdTheoryFile) {
        theoryFileId = createdTheoryFile.id;
        oldTheoryFileIdToDelete = topicToUpdate.theoryFileId;
      }

      if (createdHomeworkFile) {
        homeworkFileId = createdHomeworkFile.id;
        oldHomeworkFileIdToDelete = topicToUpdate.homeworkFileId;
      }

      await tx.topic.update({
        where: { id: topicId },
        data: {
          title,
          description,
          theoryFileId,
          homeworkFileId
        }
      });

      const existingNumbersByValue = new Map(
        topicToUpdate.homeworkNumbers.map((number) => [number.number, number] as const)
      );
      const nextNumbersSet = new Set(numbers);
      const numbersToCreate: Array<{ number: number; displayOrder: number }> = [];
      const numberUpdates: Array<Promise<unknown>> = [];
      const numberIdsToDelete: string[] = [];

      for (const existingNumber of topicToUpdate.homeworkNumbers) {
        if (!nextNumbersSet.has(existingNumber.number)) {
          if (existingNumber.answerFileId) {
            removedAnswerFileIds.add(existingNumber.answerFileId);
          }

          numberIdsToDelete.push(existingNumber.id);
        }
      }

      if (numberIdsToDelete.length > 0) {
        await tx.topicHomeworkNumber.deleteMany({
          where: {
            id: {
              in: numberIdsToDelete
            }
          }
        });
      }

      for (const [index, number] of numbers.entries()) {
        const existingNumber = existingNumbersByValue.get(number);
        const nextDisplayOrder = index + 1;

        if (existingNumber) {
          if (existingNumber.displayOrder !== nextDisplayOrder) {
            numberUpdates.push(
              tx.topicHomeworkNumber.update({
                where: { id: existingNumber.id },
                data: {
                  displayOrder: nextDisplayOrder
                }
              })
            );
          }
        } else {
          numbersToCreate.push({
            number,
            displayOrder: nextDisplayOrder
          });
        }
      }

      if (numberUpdates.length > 0) {
        await Promise.all(numberUpdates);
      }

      await createTopicHomeworkNumbersInBatches(tx, topicId, numbersToCreate);
    });
  } catch (error) {
    reportServerError(
      "Failed to update topic in database.",
      {
        teacherId: user.id,
        topicId,
        title,
        numberCount: numbers.length
      },
      error
    );
    await cleanupUploadedStorageKeys([theoryUpload?.storageKey, homeworkUpload?.storageKey], {
      teacherId: user.id,
      topicId,
      stage: "update-topic-db"
    });
    redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ error: "save" }));
  }

  const fileIdsToCleanup: string[] = [
    ...Array.from(removedAnswerFileIds),
    ...[oldTheoryFileIdToDelete, oldHomeworkFileIdToDelete].flatMap((fileId) => (fileId ? [fileId] : []))
  ];

  await cleanupStoredFileIds(fileIdsToCleanup, { teacherId: user.id, topicId, stage: "update-topic-cleanup" });
  revalidateTopicRoutes(topicId);
  redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ saved: "1" }));
}

export async function deleteTopicFileAction(formData: FormData) {
  const user = await requireUser(UserRole.TEACHER);

  const topicId = String(formData.get("topicId") ?? "").trim();
  const fileKind = getTopicFileKind(formData.get("fileKind"));

  if (!topicId || !fileKind) {
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "save" }));
  }

  const targetFileKind = fileKind!;

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      theoryFileId: true,
      homeworkFileId: true
    }
  });

  if (!topic) {
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "save" }));
  }

  const topicToUpdate = topic!;
  const fileId = targetFileKind === "theory" ? topicToUpdate.theoryFileId : topicToUpdate.homeworkFileId;

  if (!fileId) {
    redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ fileDeleted: targetFileKind }));
  }

  try {
    await prisma.topic.update({
      where: { id: topicId },
      data: targetFileKind === "theory" ? { theoryFileId: null } : { homeworkFileId: null }
    });
  } catch (error) {
    reportServerError(
      "Failed to delete topic file reference.",
      { teacherId: user.id, topicId, fileKind: targetFileKind },
      error
    );
    redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ error: "fileDelete" }));
  }

  await cleanupStoredFileIds([fileId!], {
    teacherId: user.id,
    topicId,
    fileKind: targetFileKind,
    stage: "delete-topic-file"
  });
  revalidateTopicRoutes(topicId);
  redirectTeacherTopicWithStatus(topicId, new URLSearchParams({ fileDeleted: targetFileKind }));
}

export async function deleteTopicAction(formData: FormData) {
  const user = await requireUser(UserRole.TEACHER);

  const topicId = String(formData.get("topicId") ?? "");

  if (!topicId) {
    return;
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      theoryFile: true,
      homeworkFile: true,
      homeworkNumbers: {
        include: {
          answerFile: true
        }
      }
    }
  });

  if (!topic) {
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "delete" }));
  }

  const existingTopic = topic!;
  const fileIdsToCleanup = new Set<string>();

  if (existingTopic.theoryFileId) {
    fileIdsToCleanup.add(existingTopic.theoryFileId);
  }

  if (existingTopic.homeworkFileId) {
    fileIdsToCleanup.add(existingTopic.homeworkFileId);
  }

  for (const number of existingTopic.homeworkNumbers) {
    if (number.answerFileId) {
      fileIdsToCleanup.add(number.answerFileId);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.topic.delete({
        where: { id: topicId }
      });
    });
  } catch (error) {
    reportServerError("Failed to delete topic.", { teacherId: user.id, topicId }, error);
    redirectTeacherTopicsWithStatus(new URLSearchParams({ error: "delete" }));
  }

  await Promise.all(Array.from(fileIdsToCleanup).map((fileId) => deleteStoredFileRecordIfUnused(fileId)));

  revalidateTopicRoutes();
  redirectTeacherTopicsWithStatus(new URLSearchParams({ deleted: "1" }));
}

export async function setStudentNumberStatusAction(formData: FormData) {
  const user = await requireUser(UserRole.STUDENT);
  const topicId = String(formData.get("topicId") ?? "");
  const homeworkNumberId = String(formData.get("homeworkNumberId") ?? "");
  const status = String(formData.get("status") ?? "") as HomeworkNumberStatus;

  if (!topicId || !homeworkNumberId || !numberStatuses.includes(status)) {
    return;
  }

  await prisma.studentTopicNumberStatus.upsert({
    where: {
      studentId_homeworkNumberId: {
        studentId: user.id,
        homeworkNumberId
      }
    },
    update: {
      status
    },
    create: {
      studentId: user.id,
      homeworkNumberId,
      status
    }
  });

  revalidateTopicRoutes(topicId);
}
