"use server";

import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
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

  if (topicId) {
    revalidatePath(`/student/topics/${topicId}`);
    revalidatePath(`/teacher/topics/${topicId}`);
  }
}

function redirectTeacherWithStatus(params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `/teacher?${query}` : "/teacher");
}

async function deleteStoredFileRecordIfUnused(fileId: string | null | undefined) {
  if (!fileId) {
    return;
  }

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file) {
    return;
  }

  const usageCount = await prisma.topic.count({
    where: {
      OR: [{ theoryFileId: fileId }, { homeworkFileId: fileId }]
    }
  });

  if (usageCount === 0) {
    await prisma.storedFile.delete({
      where: { id: fileId }
    });
    await removeStoredFile(file.storageKey);
  }
}

export async function createTopicAction(formData: FormData) {
  const user = await requireUser(UserRole.TEACHER);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const numbers = parseNumbersInput(String(formData.get("numbers") ?? ""));
  const theoryFile = formData.get("theoryFile");
  const homeworkFile = formData.get("homeworkFile");

  if (
    !title ||
    !description ||
    !numbers.length ||
    !(theoryFile instanceof File) ||
    theoryFile.size === 0 ||
    !(homeworkFile instanceof File) ||
    homeworkFile.size === 0
  ) {
    redirectTeacherWithStatus(new URLSearchParams({ error: "invalid" }));
  }

  const validTheoryFile = theoryFile as File;
  const validHomeworkFile = homeworkFile as File;

  let theoryUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let homeworkUpload: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;

  try {
    theoryUpload = await saveUploadedFile(validTheoryFile);
    homeworkUpload = await saveUploadedFile(validHomeworkFile);
  } catch (error) {
    console.error("Failed to upload files while creating topic.", error);
    await Promise.all([removeStoredFile(theoryUpload?.storageKey), removeStoredFile(homeworkUpload?.storageKey)]);
    redirectTeacherWithStatus(new URLSearchParams({ error: "upload" }));
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lastTopic = await tx.topic.findFirst({
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true }
      });

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

      await tx.topic.create({
        data: {
          title,
          description,
          displayOrder: (lastTopic?.displayOrder ?? 0) + 1,
          theoryFileId: createdTheoryFile?.id,
          homeworkFileId: createdHomeworkFile?.id,
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

    redirectTeacherWithStatus(new URLSearchParams({ error: "save" }));
  }

  revalidateTopicRoutes();
  redirectTeacherWithStatus(new URLSearchParams({ created: "1" }));
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
      homeworkNumbers: true
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
      homeworkFile: true
    }
  });

  if (!topic) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.topic.delete({
      where: { id: topicId }
    });

    if (topic.theoryFileId) {
      await tx.storedFile.delete({
        where: { id: topic.theoryFileId }
      });
    }

    if (topic.homeworkFileId) {
      await tx.storedFile.delete({
        where: { id: topic.homeworkFileId }
      });
    }
  });

  await Promise.all([
    removeStoredFile(topic.theoryFile?.storageKey),
    removeStoredFile(topic.homeworkFile?.storageKey)
  ]);

  revalidateTopicRoutes();
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
