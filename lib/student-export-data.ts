import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const statusLabels: Record<string, string> = {
  GREEN: "Решён сразу и верно",
  YELLOW: "Решён после самопроверки",
  RED: "Нужен разбор с преподавателем"
};

function isMissingColumn(error: unknown, column: "note" | "deadlineAt") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes(column)
  );
}

export async function loadExportData(studentId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: UserRole.STUDENT },
    select: { id: true, name: true, email: true }
  });

  if (!student) {
    return null;
  }

  let notesEnabled = true;
  let deadlinesEnabled = true;

  const query = () =>
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        title: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            number: true,
            statuses: {
              where: { studentId },
              select: {
                status: true,
                ...(notesEnabled ? { note: true } : {}),
                ...(deadlinesEnabled ? { deadlineAt: true } : {}),
                updatedAt: true
              }
            }
          }
        }
      }
    });

  let topics: Awaited<ReturnType<typeof query>>;

  try {
    topics = await query();
  } catch (error) {
    const noteMissing = isMissingColumn(error, "note");
    const deadlineMissing = isMissingColumn(error, "deadlineAt");

    if (!noteMissing && !deadlineMissing) {
      throw error;
    }

    notesEnabled = !noteMissing;
    deadlinesEnabled = !deadlineMissing;
    topics = await query();
  }

  return { student, topics, notesEnabled, deadlinesEnabled };
}

export type StudentExportData = NonNullable<Awaited<ReturnType<typeof loadExportData>>>;
