import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const SEP = ";";

const statusLabels: Record<string, string> = {
  GREEN: "Зеленый",
  YELLOW: "Желтый",
  RED: "Красный"
};

function cell(value: string | number | null | undefined): string {
  let text = String(value ?? "");

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  text = text.replace(/"/g, '""');

  return `"${text}"`;
}

function row(...values: Array<string | number | null | undefined>): string {
  return values.map((v) => cell(v)).join(SEP);
}

function emptyRow(): string {
  return "";
}

function isMissingColumn(error: unknown, column: "note" | "deadlineAt") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes(column)
  );
}

async function loadExportData(studentId: string) {
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
    const data = await loadExportData(studentId);

    if (!data) {
      return new NextResponse("Student not found", { status: 404 });
    }

    const exportDate = new Date();

    let totalNumbers = 0;
    let totalMarked = 0;
    let totalSolved = 0;
    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;

    const detailRows: Array<[string, number, string, string, string, string]> = [];

    for (const topic of data.topics) {
      for (const num of topic.homeworkNumbers) {
        totalNumbers += 1;
        const st = num.statuses[0] ?? null;
        const sv = st?.status ?? null;

        if (sv) {
          totalMarked += 1;
        }

        if (sv === "GREEN") {
          totalGreen += 1;
          totalSolved += 1;
        } else if (sv === "YELLOW") {
          totalYellow += 1;
          totalSolved += 1;
        } else if (sv === "RED") {
          totalRed += 1;
        }

        const note = data.notesEnabled ? ((st as { note?: string | null })?.note ?? "") : "";
        const deadline =
          data.deadlinesEnabled && (st as { deadlineAt?: Date | null })?.deadlineAt
            ? formatDateTime((st as { deadlineAt?: Date | null }).deadlineAt ?? null)
            : "";
        const updated = st?.updatedAt ? formatDateTime(st.updatedAt) : "";

        detailRows.push([
          topic.title,
          num.number,
          statusLabels[sv ?? ""] ?? "Не отмечено",
          deadline,
          note,
          updated
        ]);
      }
    }

    const percent = totalNumbers > 0 ? Math.round((totalSolved / totalNumbers) * 100) : 0;

    const lines: string[] = [
      `sep=${SEP}`,
      row("Отчёт по прогрессу ученика"),
      emptyRow(),
      row("Ученик", data.student.name),
      row("Логин", data.student.email),
      row("Дата экспорта", formatDateTime(exportDate)),
      emptyRow(),
      row("Сводка"),
      row("Показатель", "Значение"),
      row("Всего тем", data.topics.length),
      row("Всего номеров", totalNumbers),
      row("Решено", `${totalSolved} из ${totalNumbers}`),
      row("Прогресс", `${percent}%`),
      row("Зелёных", totalGreen),
      row("Жёлтых", totalYellow),
      row("Красных", totalRed),
      row("Без статуса", totalNumbers - totalMarked),
      emptyRow(),
      row("Детализация по номерам"),
      row("Тема", "Номер", "Статус", "Дедлайн", "Заметка", "Обновлено"),
      ...detailRows.map((detailRow) => row(...detailRow))
    ];

    const csvString = lines.join("\r\n");
    const bom = Buffer.from([0xff, 0xfe]);
    const body = Buffer.from(csvString, "utf16le");
    const output = Buffer.concat([bom, body]);

    const datePart = exportDate.toISOString().slice(0, 10);

    return new NextResponse(output, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-16le",
        "Content-Disposition": `attachment; filename="progress-${datePart}.csv"; filename*=UTF-8''progress-${datePart}.csv`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Failed to export student progress CSV", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
