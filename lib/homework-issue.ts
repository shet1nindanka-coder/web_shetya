import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

/*
 * Единая точка создания HomeworkAssignment: вызывается ручным роутом
 * /api/teacher/homeworks и выдачей ИИ-черновиков. Поведение перенесено из
 * роута без изменений: проверка темы, конфликт по уже выданным номерам,
 * транзакция с зеркалированием дедлайна, уведомление, ревалидация, realtime.
 */

export type IssueHomeworkInput = {
  studentId: string;
  topicId: string;
  homeworkNumberIds: string[];
  deadlineAt: Date;
  title: string | null;
};

export type IssueHomeworkResult =
  | { ok: true; assignmentId: string; homeworkNumberIds: string[] }
  | {
      ok: false;
      code: "invalid" | "not_found" | "conflict" | "unavailable";
      message: string;
      conflictNumbers?: number[];
      reason?: "table" | "deadlineColumn";
    };

function isMissingHomeworkAssignmentTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkAssignment") || error.message.includes("HomeworkCheckPhoto"))
  );
}

function isMissingStudentDeadlineColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes("deadlineAt")
  );
}

function revalidateHomeworkRoutes(studentId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/student/homeworks");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/teacher/students/${studentId}/assign`);
}

export async function issueHomework(input: IssueHomeworkInput): Promise<IssueHomeworkResult> {
  const studentId = input.studentId.trim();
  const topicId = input.topicId.trim();
  const homeworkNumberIds = Array.from(
    new Set(input.homeworkNumberIds.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  const title = input.title ? input.title.trim().slice(0, 200) : "";
  const deadlineAt = input.deadlineAt;

  if (!studentId || !topicId || !homeworkNumberIds.length || !deadlineAt || Number.isNaN(deadlineAt.getTime())) {
    return { ok: false, code: "invalid", message: "Некорректные данные для ДЗ." };
  }

  const [student, foundNumbers] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, role: UserRole.STUDENT },
      select: { id: true }
    }),
    prisma.topicHomeworkNumber.findMany({
      where: { id: { in: homeworkNumberIds }, topicId },
      select: { id: true, number: true }
    })
  ]);

  if (!student || foundNumbers.length !== homeworkNumberIds.length) {
    return { ok: false, code: "not_found", message: "Ученик или номер задания не найден." };
  }

  // Запрещаем выдавать один и тот же номер этому ученику в двух активных ДЗ:
  // дедлайн зеркалируется в одно поле StudentTopicNumberStatus на пару (ученик, номер),
  // поэтому пересечение номеров рассинхронизирует дедлайны. Проще не допускать дубль.
  let conflictingNumbers: number[] = [];

  try {
    const alreadyAssigned = await prisma.homeworkAssignmentNumber.findMany({
      where: {
        homeworkNumberId: { in: homeworkNumberIds },
        assignment: { studentId }
      },
      select: { homeworkNumber: { select: { number: true } } }
    });
    conflictingNumbers = Array.from(new Set(alreadyAssigned.map((entry) => entry.homeworkNumber.number))).sort(
      (left, right) => left - right
    );
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return {
        ok: false,
        code: "unavailable",
        reason: "table",
        message: "Таблица ДЗ ещё не создана в PostgreSQL. Сначала примените миграцию."
      };
    }

    throw error;
  }

  if (conflictingNumbers.length > 0) {
    const plural = conflictingNumbers.length > 1;

    return {
      ok: false,
      code: "conflict",
      conflictNumbers: conflictingNumbers,
      message: `${plural ? "Номера" : "Номер"} ${conflictingNumbers.join(", ")} уже ${
        plural ? "выданы" : "выдан"
      } этому ученику в другом ДЗ. Уберите ${plural ? "их" : "его"} или сначала отмените то ДЗ.`
    };
  }

  let assignmentId: string;

  try {
    const [assignment] = await prisma.$transaction([
      prisma.homeworkAssignment.create({
        data: {
          studentId,
          topicId,
          title: title || null,
          deadlineAt,
          numbers: {
            create: homeworkNumberIds.map((homeworkNumberId) => ({ homeworkNumberId }))
          }
        },
        select: { id: true }
      }),
      ...homeworkNumberIds.map((homeworkNumberId) =>
        prisma.studentTopicNumberStatus.upsert({
          where: {
            studentId_homeworkNumberId: { studentId, homeworkNumberId }
          },
          update: { deadlineAt },
          create: { studentId, homeworkNumberId, status: null, deadlineAt }
        })
      )
    ]);

    assignmentId = assignment.id;
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return {
        ok: false,
        code: "unavailable",
        reason: "table",
        message: "Таблица ДЗ ещё не создана в PostgreSQL. Сначала примените миграцию."
      };
    }

    if (isMissingStudentDeadlineColumnError(error)) {
      return {
        ok: false,
        code: "unavailable",
        reason: "deadlineColumn",
        message: "Колонка deadlineAt ещё не добавлена в PostgreSQL. Сначала примените миграцию."
      };
    }

    throw error;
  }

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { title: true } });
  const numbersLabel = foundNumbers
    .map((entry) => entry.number)
    .sort((left, right) => left - right)
    .join(", ");
  const deadlineLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(deadlineAt);

  await createNotification({
    userId: studentId,
    type: "homework-assigned",
    title: `Учитель выдал ДЗ по теме «${topic?.title ?? "Тема"}»`,
    body: `${homeworkNumberIds.length > 1 ? "Номера" : "Номер"} ${numbersLabel} · дедлайн ${deadlineLabel}`,
    href: "/student/homeworks"
  });

  revalidateHomeworkRoutes(studentId);
  publishDashboardRealtimeEvent({
    kind: "student-deadlines-changed",
    studentId,
    topicId
  });
  logInfoEvent("homework.assign.succeeded", {
    studentId,
    topicId,
    assignmentId,
    numbersCount: homeworkNumberIds.length
  });

  return { ok: true, assignmentId, homeworkNumberIds };
}
