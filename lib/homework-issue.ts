import { HomeworkNumberStatus, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { recomputeMirroredDeadlines } from "@/lib/homework-deadline-mirror";
import { logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { compareHomeworkNumbers } from "@/lib/utils";

/*
 * Единая точка создания HomeworkAssignment: вызывается ручным роутом
 * /api/teacher/homeworks и выдачей ИИ-черновиков. Проверка темы, отсев уже
 * решённых номеров, транзакция с пересчётом зеркала дедлайнов, уведомление,
 * ревалидация, realtime.
 */

export type IssueHomeworkInput = {
  studentId: string;
  /** Кто выдаёт: TEACHER выдаёт только своим ученикам, DEVELOPER — любым (SEC-003). */
  issuedBy?: { id: string; role: UserRole };
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
      conflictNumbers?: string[];
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
      where: {
        id: studentId,
        role: UserRole.STUDENT,
        ...(input.issuedBy && input.issuedBy.role === UserRole.TEACHER ? { teacherId: input.issuedBy.id } : {})
      },
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

  // Повторно не выдаём только уже решённые номера: GREEN — решил сразу,
  // YELLOW — решил после самопроверки. Нерешённый (RED) и неотмеченный номер
  // выдать снова можно и нужно — это основной сценарий «дай перерешать».
  //
  // Раньше блокировался любой когда-либо выданный номер, из-за чего перевыдача
  // была невозможна без отмены старого ДЗ. Дедлайн при пересечении номеров
  // больше не теряется: его пересчитывает recomputeMirroredDeadlines.
  let solvedNumbers: string[] = [];

  try {
    const solvedStatuses = await prisma.studentTopicNumberStatus.findMany({
      where: {
        studentId,
        homeworkNumberId: { in: homeworkNumberIds },
        status: { in: [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW] }
      },
      select: { homeworkNumber: { select: { number: true } } }
    });
    solvedNumbers = Array.from(new Set(solvedStatuses.map((entry) => entry.homeworkNumber.number))).sort(
      compareHomeworkNumbers
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

  if (solvedNumbers.length > 0) {
    const plural = solvedNumbers.length > 1;

    return {
      ok: false,
      code: "conflict",
      conflictNumbers: solvedNumbers,
      message: `${plural ? "Номера" : "Номер"} ${solvedNumbers.join(", ")} ученик уже ${
        plural ? "решил" : "решил"
      } — повторно ${plural ? "их" : "его"} не выдаём. Уберите ${
        plural ? "их" : "его"
      } из набора или сбросьте статус на карточке ученика.`
    };
  }

  let assignmentId: string;

  try {
    assignmentId = await prisma.$transaction(async (tx) => {
      const assignment = await tx.homeworkAssignment.create({
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
      });

      // Строки статуса должны существовать до пересчёта зеркала: сам пересчёт
      // ничего не создаёт, он только приводит deadlineAt к правильному значению.
      await tx.studentTopicNumberStatus.createMany({
        data: homeworkNumberIds.map((homeworkNumberId) => ({
          studentId,
          homeworkNumberId,
          status: null,
          deadlineAt
        })),
        skipDuplicates: true
      });

      await recomputeMirroredDeadlines(tx, studentId, homeworkNumberIds);

      return assignment.id;
    });
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
    .sort(compareHomeworkNumbers)
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
