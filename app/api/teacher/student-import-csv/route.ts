import { HomeworkNumberStatus, Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, HomeworkNumberStatus> = {
  "зеленый": HomeworkNumberStatus.GREEN,
  "зелёный": HomeworkNumberStatus.GREEN,
  "green": HomeworkNumberStatus.GREEN,
  "желтый": HomeworkNumberStatus.YELLOW,
  "жёлтый": HomeworkNumberStatus.YELLOW,
  "yellow": HomeworkNumberStatus.YELLOW,
  "красный": HomeworkNumberStatus.RED,
  "red": HomeworkNumberStatus.RED
};

async function readUploadedText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function parseCsvLines(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || /^sep\s*=/i.test(trimmed)) {
      continue;
    }

    const sep = trimmed.includes("\t") ? "\t" : trimmed.includes(";") ? ";" : ",";
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < trimmed.length && trimmed[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === sep) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    result.push(cells);
  }

  return result;
}

function parseDeadline(value: string | undefined): Date | null {
  if (!value || !value.trim()) {
    return null;
  }

  const cleaned = value.trim();

  // Try ISO format first
  const isoDate = new Date(cleaned);

  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try dd.mm.yyyy HH:MM format (Russian)
  const ruMatch = cleaned.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);

  if (ruMatch) {
    const [, day, month, year, hours, minutes] = ruMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      hours ? Number(hours) : 0,
      minutes ? Number(minutes) : 0
    );

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

type ImportRow = {
  topicTitle: string;
  number: number;
  status: HomeworkNumberStatus | null;
  note: string;
  deadline: Date | null;
};

function findDataHeaderRow(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map((c) => c.toLowerCase().replace(/[^a-zа-яё]/g, ""));

    if (
      lower.some((c) => c === "тема" || c === "theme") &&
      lower.some((c) => c === "номер" || c === "number")
    ) {
      return i;
    }
  }

  return -1;
}

function parseDataRows(rows: string[][], headerIndex: number): ImportRow[] {
  const header = rows[headerIndex].map((c) => c.toLowerCase().trim());
  const topicCol = header.findIndex((c) => c.includes("тема") || c === "theme");
  const numberCol = header.findIndex((c) => c.includes("номер") || c === "number");
  const statusCol = header.findIndex((c) => c.includes("статус") || c === "status");
  const noteCol = header.findIndex((c) => c.includes("заметк") || c === "note");
  const deadlineCol = header.findIndex((c) => c.includes("дедлайн") || c.includes("deadline"));

  if (topicCol === -1 || numberCol === -1) {
    return [];
  }

  const result: ImportRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const topicTitle = row[topicCol]?.trim();
    const numberStr = row[numberCol]?.trim();

    if (!topicTitle || !numberStr) {
      continue;
    }

    const num = parseInt(numberStr, 10);

    if (Number.isNaN(num) || num <= 0) {
      continue;
    }

    const statusRaw = statusCol >= 0 ? row[statusCol]?.trim().toLowerCase() : "";
    const status = statusRaw ? (STATUS_MAP[statusRaw] ?? null) : null;
    const note = noteCol >= 0 ? (row[noteCol]?.trim() ?? "") : "";
    const deadline = deadlineCol >= 0 ? parseDeadline(row[deadlineCol]) : null;

    // Skip rows with "Не отмечено" status — these have no status to import
    if (statusRaw === "не отмечено") {
      continue;
    }

    if (!status && !note && !deadline) {
      continue;
    }

    result.push({
      topicTitle,
      number: num,
      status,
      note: note.slice(0, 240),
      deadline
    });
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const user = await tryGetCurrentUser();

    if (!user || user.role !== UserRole.TEACHER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const studentId = formData.get("studentId");
    const file = formData.get("file");

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Не указан ID ученика." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не найден." }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (максимум 2 МБ)." }, { status: 400 });
    }

    // Verify student exists
    const student = await prisma.user.findUnique({ where: { id: studentId } });

    if (!student) {
      return NextResponse.json({ error: "Ученик не найден." }, { status: 404 });
    }

    const text = await readUploadedText(file);
    const allRows = parseCsvLines(text);

    if (allRows.length < 2) {
      return NextResponse.json({ error: "CSV файл пуст или содержит только заголовки." }, { status: 400 });
    }

    const headerIndex = findDataHeaderRow(allRows);

    if (headerIndex === -1) {
      return NextResponse.json(
        { error: "Не удалось найти заголовок таблицы. Убедитесь, что CSV содержит столбцы «Тема» и «Номер»." },
        { status: 400 }
      );
    }

    const dataRows = parseDataRows(allRows, headerIndex);

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: "Не найдено строк с данными для импорта." },
        { status: 400 }
      );
    }

    // Load all topics and homework numbers
    const topics = await prisma.topic.findMany({
      select: {
        id: true,
        title: true,
        homeworkNumbers: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    // Build lookup: topicTitle -> { number -> homeworkNumberId }
    const topicMap = new Map<string, Map<number, string>>();

    for (const topic of topics) {
      const numberMap = new Map<number, string>();

      for (const hw of topic.homeworkNumbers) {
        numberMap.set(hw.number, hw.id);
      }

      topicMap.set(topic.title.trim().toLowerCase(), numberMap);
    }

    // Check for deadlineAt column support
    let deadlinesEnabled = true;

    // Match rows to homework numbers
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of dataRows) {
      const numberMap = topicMap.get(row.topicTitle.toLowerCase());

      if (!numberMap) {
        skipped++;

        if (errors.length < 5) {
          errors.push(`Тема «${row.topicTitle}» не найдена.`);
        }

        continue;
      }

      const homeworkNumberId = numberMap.get(row.number);

      if (!homeworkNumberId) {
        skipped++;

        if (errors.length < 5) {
          errors.push(`Номер ${row.number} в теме «${row.topicTitle}» не найден.`);
        }

        continue;
      }

      try {
        const updateData: Prisma.StudentTopicNumberStatusUpdateInput = {};
        const createData: Prisma.StudentTopicNumberStatusCreateInput = {
          student: { connect: { id: studentId } },
          homeworkNumber: { connect: { id: homeworkNumberId } }
        };

        if (row.status) {
          updateData.status = row.status;
          createData.status = row.status;
        }

        if (row.note) {
          updateData.note = row.note;
          createData.note = row.note;
        }

        if (row.deadline && deadlinesEnabled) {
          updateData.deadlineAt = row.deadline;
          createData.deadlineAt = row.deadline;
        }

        await prisma.studentTopicNumberStatus.upsert({
          where: {
            studentId_homeworkNumberId: {
              studentId,
              homeworkNumberId
            }
          },
          update: updateData,
          create: createData
        });

        imported++;
      } catch (error) {
        // If deadlineAt column is missing, retry without it
        if (
          deadlinesEnabled &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2022" &&
          error.message.includes("deadlineAt")
        ) {
          deadlinesEnabled = false;

          // Retry this row without deadline
          try {
            const retryUpdate: Prisma.StudentTopicNumberStatusUpdateInput = {};
            const retryCreate: Prisma.StudentTopicNumberStatusCreateInput = {
              student: { connect: { id: studentId } },
              homeworkNumber: { connect: { id: homeworkNumberId } }
            };

            if (row.status) {
              retryUpdate.status = row.status;
              retryCreate.status = row.status;
            }

            if (row.note) {
              retryUpdate.note = row.note;
              retryCreate.note = row.note;
            }

            await prisma.studentTopicNumberStatus.upsert({
              where: {
                studentId_homeworkNumberId: {
                  studentId,
                  homeworkNumberId
                }
              },
              update: retryUpdate,
              create: retryCreate
            });

            imported++;
          } catch {
            skipped++;
          }
        } else {
          skipped++;

          if (errors.length < 5) {
            errors.push(`Ошибка для номера ${row.number} в теме «${row.topicTitle}».`);
          }
        }
      }
    }

    revalidateAllPlatformData();

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: dataRows.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Failed to import student progress CSV", error);
    return NextResponse.json({ error: "Не удалось обработать файл." }, { status: 500 });
  }
}
