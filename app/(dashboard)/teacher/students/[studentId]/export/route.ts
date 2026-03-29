import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { formatDateTime, sanitizeFileName } from "@/lib/utils";

export const runtime = "nodejs";

const statusLabels = {
  GREEN: "Зеленый",
  YELLOW: "Желтый",
  RED: "Красный"
} as const;

function escapeCsvValue(value: string | number) {
  const stringValue = String(value).replace(/"/g, '""');

  return `"${stringValue}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { studentId } = await params;
  const data = await getTeacherStudentDetail(studentId);

  const rows = [
    ["Ученик", data.student.name],
    ["Логин", data.student.email],
    ["Тем", data.stats.totalTopics],
    ["Решено", `${data.stats.totalSolved}/${data.stats.totalNumbers}`],
    ["Отмечено", `${data.stats.totalMarked}/${data.stats.totalNumbers}`],
    [],
    ["Тема", "Номер", "Статус", "Заметка", "Дедлайн", "Последнее обновление"]
  ];

  for (const topic of data.topics) {
    for (const number of topic.numbers) {
      rows.push([
        topic.title,
        number.number,
        number.studentStatus?.status ? statusLabels[number.studentStatus.status] : "Не отмечено",
        number.studentStatus?.note ?? "",
        number.studentStatus?.deadlineAt ? formatDateTime(number.studentStatus.deadlineAt) : "",
        number.studentStatus?.updatedAt ? formatDateTime(number.studentStatus.updatedAt) : ""
      ]);
    }
  }

  const csv = `\uFEFF${rows
    .map((row) => row.map((value) => escapeCsvValue(value ?? "")).join(","))
    .join("\n")}`;

  const fileName = sanitizeFileName(
    `progress-${data.student.name || "student"}-${new Date().toISOString().slice(0, 10)}.csv`
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
