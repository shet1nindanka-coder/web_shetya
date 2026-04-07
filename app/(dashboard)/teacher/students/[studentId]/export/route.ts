import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, sanitizeFileName } from "@/lib/utils";

export const runtime = "nodejs";

const statusLabels = {
  GREEN: "Зеленый",
  YELLOW: "Желтый",
  RED: "Красный"
} as const;

const CSV_DELIMITER = ";";

function normalizeCsvValue(value: string | number) {
  const stringValue = String(value);

  // Protect from CSV formula injection in spreadsheet apps.
  if (/^[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }

  return stringValue;
}

function escapeCsvValue(value: string | number) {
  const stringValue = normalizeCsvValue(value).replace(/"/g, '""');

  return `"${stringValue}"`;
}

function encodeWindows1251(text: string): Buffer {
  const bytes: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code >= 0x0410 && code <= 0x044f) {
      bytes.push(code - 0x0410 + 0xc0);
    } else if (code === 0x0401) {
      bytes.push(0xa8);
    } else if (code === 0x0451) {
      bytes.push(0xb8);
    } else if (code === 0xab) {
      bytes.push(0xab);
    } else if (code === 0xbb) {
      bytes.push(0xbb);
    } else if (code === 0x2013) {
      bytes.push(0x96);
    } else if (code === 0x2014) {
      bytes.push(0x97);
    } else if (code === 0x2116) {
      bytes.push(0xb9);
    } else {
      bytes.push(0x3f);
    }
  }

  return Buffer.from(bytes);
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

    const totalTopics = data.topics.length;
    let totalNumbers = 0;
    let totalMarked = 0;
    let totalSolved = 0;

    const rows = [
      ["Ученик", data.student.name],
      ["Логин", data.student.email],
      ["Тем", totalTopics],
      [],
      ["Тема", "Номер", "Статус", "Заметка", "Дедлайн", "Последнее обновление"]
    ];

    for (const topic of data.topics) {
      for (const number of topic.homeworkNumbers) {
        totalNumbers += 1;
        const studentStatus = number.statuses[0] ?? null;
        const statusValue = studentStatus?.status ?? null;
        const isSolved = statusValue === "GREEN" || statusValue === "YELLOW";

        if (statusValue) {
          totalMarked += 1;
        }

        if (isSolved) {
          totalSolved += 1;
        }

        rows.push([
          topic.title,
          number.number,
          statusValue ? statusLabels[statusValue] : "Не отмечено",
          data.notesEnabled ? ((studentStatus as { note?: string | null })?.note ?? "") : "",
          data.deadlinesEnabled
            ? ((studentStatus as { deadlineAt?: Date | null })?.deadlineAt ? formatDateTime((studentStatus as { deadlineAt?: Date | null }).deadlineAt ?? null) : "")
            : "",
          studentStatus?.updatedAt ? formatDateTime(studentStatus.updatedAt) : ""
        ]);
      }
    }

    rows.splice(3, 0, ["Решено", `${totalSolved}/${totalNumbers}`], ["Отмечено", `${totalMarked}/${totalNumbers}`]);

    const csvText = rows
      .map((row) => row.map((value) => escapeCsvValue(value ?? "")).join(CSV_DELIMITER))
      .join("\r\n");

    const csvBuffer = encodeWindows1251(csvText);
    const datePart = new Date().toISOString().slice(0, 10);
    const asciiFileName = `progress-${datePart}.csv`;

    return new NextResponse(new Uint8Array(csvBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiFileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Failed to export student progress CSV", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
