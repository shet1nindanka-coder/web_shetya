"use server";

import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteStoredFileRecordIfUnused } from "@/lib/stored-files";
import { removeStoredFile, saveUploadedFile } from "@/lib/storage";
import { parseNumbersInput } from "@/lib/utils";

const numberStatuses: HomeworkNumberStatus[] = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
];

function revalidateTopicRoutes(topicId?: string) {
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
      console.error("Failed to upload files while creating topic.", error);
      await Promise.all([removeStoredFile(theoryUpload?.storageKey), removeStoredFile(homeworkUpload?.storageKey)]);
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

      await tx.topic.create({
        data: {
          title,
          description,
          displayOrder: (lastTopic?.displayOrder ?? 0) + 1,
          theoryFileId: finalTheoryFileId,
          homeworkFileId: finalHomeworkFileId,
          homeworkNumbers: {
            create: numbers.map((number, index) => ({
              number,
              displayOrder: index + 1
            }))
          }
        }
      });
    });
  } catch (error) {
    console.error("Failed to create topic in database.", error);
    await Promise.all([
      removeStoredFile(theoryUpload?.storageKey),
      removeStoredFile(homeworkUpload?.storageKey)
    ]);

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
  const removeTheoryFile = String(formData.get("removeTheoryFile") ?? "") === "on";
  const removeHomeworkFile = String(formData.get("removeHomeworkFile") ?? "") === "on";
  const theoryFile = formData.get("theoryFile");
  const homeworkFile = formData.get("homeworkFile");

  if (!topicId || !title || !description || !numbers.length) {
    return;
  }

  const existingTopic = await prisma.topic.findUnique({
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

  if (!existingTopic) {
    return;
  }

  let theoryUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let homeworkUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;

  try {
    theoryUpload = theoryFile instanceof File && theoryFile.size > 0 ? await saveUploadedFile(theoryFile) : null;
    homeworkUpload =
      homeworkFile instanceof File && homeworkFile.size > 0 ? await saveUploadedFile(homeworkFile) : null;
  } catch (error) {
    await Promise.all([removeStoredFile(theoryUpload?.storageKey), removeStoredFile(homeworkUpload?.storageKey)]);
    throw error;
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

      let theoryFileId = existingTopic.theoryFileId;
      let homeworkFileId = existingTopic.homeworkFileId;

      if (createdTheoryFile) {
        theoryFileId = createdTheoryFile.id;
        oldTheoryFileIdToDelete = existingTopic.theoryFileId;
      } else if (removeTheoryFile) {
        theoryFileId = null;
        oldTheoryFileIdToDelete = existingTopic.theoryFileId;
      }

      if (createdHomeworkFile) {
        homeworkFileId = createdHomeworkFile.id;
        oldHomeworkFileIdToDelete = existingTopic.homeworkFileId;
      } else if (removeHomeworkFile) {
        homeworkFileId = null;
        oldHomeworkFileIdToDelete = existingTopic.homeworkFileId;
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
        existingTopic.homeworkNumbers.map((number) => [number.number, number] as const)
      );
      const nextNumbersSet = new Set(numbers);

      for (const existingNumber of existingTopic.homeworkNumbers) {
        if (!nextNumbersSet.has(existingNumber.number)) {
          if (existingNumber.answerFileId) {
            removedAnswerFileIds.add(existingNumber.answerFileId);
          }

          await tx.topicHomeworkNumber.delete({
            where: { id: existingNumber.id }
          });
        }
      }

      for (const [index, number] of numbers.entries()) {
        const existingNumber = existingNumbersByValue.get(number);

        if (existingNumber) {
          await tx.topicHomeworkNumber.update({
            where: { id: existingNumber.id },
            data: {
              displayOrder: index + 1
            }
          });
        } else {
          await tx.topicHomeworkNumber.create({
            data: {
              topicId,
              number,
              displayOrder: index + 1
            }
          });
        }
      }
    });
  } catch (error) {
    await Promise.all([
      removeStoredFile(theoryUpload?.storageKey),
      removeStoredFile(homeworkUpload?.storageKey)
    ]);

    throw error;
  }

  await deleteStoredFileRecordIfUnused(oldTheoryFileIdToDelete);
  await deleteStoredFileRecordIfUnused(oldHomeworkFileIdToDelete);
  await Promise.all(Array.from(removedAnswerFileIds).map((fileId) => deleteStoredFileRecordIfUnused(fileId)));
  revalidateTopicRoutes(topicId);
}

export async function deleteTopicAction(formData: FormData) {
  await requireUser(UserRole.TEACHER);

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
    console.error("Failed to delete topic.", error);
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
