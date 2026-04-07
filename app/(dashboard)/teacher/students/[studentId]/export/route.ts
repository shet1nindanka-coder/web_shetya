import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const TAB = "\t";

const statusLabels: Record<string, string> = {
  GREEN: "Зеленый",
  YELLOW: "Желтый",
  RED: "Красный"
};

function sanitizeCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function isMissingStudentStatusColumnError(error: unknown, column: "note" | "deadlineAt") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes(column)
  );
}

async function loadStudentExportData(studentId: string) {
  const student = await prisma.user.findFirstOrThrow({
    where: {
      id: studentId,
      role: UserRole.STUDENT
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  let notesEnabled = true;
  let deadlinesEnabled = true;

  const fetchTopics = () =>
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
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
                updatedAt: true
              }
            }
          }
        }
      }
    });

  let topics: Awaited<ReturnType<typeof fetchTopics>>;

  try {
    topics = await fetchTopics();
  } catch (error) {
    const noteMissing = isMissingStudentStatusColumnError(error, "note");
    const deadlineMissing = isMissingStudentStatusColumnError(error, "deadlineAt");

    if (!noteMissing && !deadlineMissing) {
      throw error;
    }

    notesEnabled = !noteMissing;
    deadlinesEnabled = !deadlineMissing;
    topics = await fetchTopics();
  }

  return {
    student,
    topics,
    notesEnabled,
    deadlinesEnabled
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await tryGetCurrentUser();

    if (!user || user.role !== UserRole.TEACHER) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { studentId } = await params;
    const data = await loadStudentExportData(studentId);

    let totalNumbers = 0;
    let totalMarked = 0;
    let totalSolved = 0;

    const dataRows: string[][] = [];

    for (const topic of data.topics) {
      for (const number of topic.homeworkNumbers) {
        totalNumbers += 1;
        const studentStatus = number.statuses[0] ?? null;
        const statusValue = studentStatus?.status ?? null;

        if (statusValue) {
          totalMarked += 1;
        }

        if (statusValue === "GREEN" || statusValue === "YELLOW") {
          totalSolved += 1;
        }

        dataRows.push([
          sanitizeCell(topic.title),
          sanitizeCell(number.number),
          sanitizeCell(statusValue ? statusLabels[statusValue] ?? statusValue : "Не отмечено"),
          sanitizeCell(data.notesEnabled ? (studentStatus as { note?: string | null })?.note : ""),
          sanitizeCell(
            data.deadlinesEnabled && (studentStatus as { deadlineAt?: Date | null })?.deadlineAt
              ? formatDateTime((studentStatus as { deadlineAt?: Date | null }).deadlineAt ?? null)
              : ""
          ),
          sanitizeCell(studentStatus?.updatedAt ? formatDateTime(studentStatus.updatedAt) : "")
        ]);
      }
    }

    const lines: string[] = [
      ["ПРОГРЕСС УЧЕНИКА"].join(TAB),
      "",
      ["Ученик", sanitizeCell(data.student.name)].join(TAB),
      ["Логин", sanitizeCell(data.student.email)].join(TAB),
      ["Тем", String(data.topics.length)].join(TAB),
      ["Решено", `${totalSolved} из ${totalNumbers}`].join(TAB),
      ["Отмечено", `${totalMarked} из ${totalNumbers}`].join(TAB),
      "",
      ["Тема", "Номер", "Статус", "Заметка", "Дедлайн", "Последнее обновление"].join(TAB),
      ...dataRows.map((row) => row.join(TAB))
    ];

    const tsvString = lines.join("\r\n");

    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = encoder.encode(tsvString);
    const result = new Uint8Array(bom.length + body.length);
    result.set(bom);
    result.set(body, bom.length);

    const datePart = new Date().toISOString().slice(0, 10);

    return new NextResponse(result, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="progress-${datePart}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Failed to export student progress CSV", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
