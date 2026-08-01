import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const statusLabels: Record<string, string> = {
  GREEN: "Решён сразу и верно",
  YELLOW: "Решён после самопроверки",
  RED: "Нужен разбор с преподавателем"
};

function isMissingColumn(error: unknown, column: "note" | "deadlineAt" | "statusChangedAt") {
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
  let statusChangedEnabled = true;

  const query = () =>
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        title: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            statuses: {
              where: { studentId },
              select: {
                status: true,
                ...(notesEnabled ? { note: true } : {}),
                ...(deadlinesEnabled ? { deadlineAt: true } : {}),
                ...(statusChangedEnabled ? { statusChangedAt: true } : {}),
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
    const statusChangedMissing = isMissingColumn(error, "statusChangedAt");

    if (!noteMissing && !deadlineMissing && !statusChangedMissing) {
      throw error;
    }

    notesEnabled = !noteMissing;
    deadlinesEnabled = !deadlineMissing;
    statusChangedEnabled = !statusChangedMissing;
    topics = await query();
  }

  return { student, topics, notesEnabled, deadlinesEnabled };
}

export type StudentExportData = NonNullable<Awaited<ReturnType<typeof loadExportData>>>;
