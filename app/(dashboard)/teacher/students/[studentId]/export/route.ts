import ExcelJS from "exceljs";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { loadExportData, statusLabels } from "@/lib/student-export-data";
import { getProgressTimeline } from "@/lib/platform-data";
import { computeStudentStreak } from "@/lib/student-streak";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const colors = {
  navy: "14161A",
  text: "2C2E33",
  muted: "6A6E75",
  border: "ECECEE",
  softBorder: "F0F0F1",
  headerBg: "EAF7F0",
  titleBg: "D9F3E7",
  blue: "16B07E",
  blueSoft: "D9F3E7",
  green: "1B9E63",
  greenSoft: "EAF7EF",
  yellow: "C98A1E",
  yellowSoft: "FEF4E3",
  red: "D64550",
  redSoft: "FCEDED",
  slateSoft: "F8F9FA",
  track: "EFEFF1"
} as const;

type AssignmentRow = {
  number: number;
  statusLabel: string;
  statusKey: string;
  note: string;
  updated: string;
};

type DetailRow = {
  topicTitle: string;
  assignmentKey: string;
  number: number;
  statusKey: string;
  statusLabel: string;
  deadline: string;
  note: string;
  updated: string;
};

type AssignmentSummary = {
  topicTitle: string;
  label: string;
  assignmentKey: string;
  deadlineAt: string | null;
  totalNumbers: number;
  solvedNumbers: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  unmarkedCount: number;
  state: string;
  stateKind: "done" | "progress" | "attention" | "muted";
  note: string;
};

function buildAssignmentState(summary: {
  totalNumbers: number;
  solvedNumbers: number;
  redCount: number;
  markedCount: number;
}) {
  if (summary.redCount > 0) {
    return {
      label: "Нужен разбор",
      kind: "attention" as const
    };
  }

  if (summary.totalNumbers > 0 && summary.solvedNumbers === summary.totalNumbers) {
    return {
      label: "Выполнено",
      kind: "done" as const
    };
  }

  if (summary.markedCount > 0) {
    return {
      label: "В работе",
      kind: "progress" as const
    };
  }

  return {
    label: "Пока не начато",
    kind: "muted" as const
  };
}

function buildAssignmentNote(summary: {
  totalNumbers: number;
  solvedNumbers: number;
  redCount: number;
  unmarkedCount: number;
  deadlineAt: string | null;
}) {
  if (!summary.deadlineAt) {
    if (summary.solvedNumbers === 0 && summary.redCount === 0) {
      return "Эти номера пока не были оформлены как отдельное домашнее задание.";
    }

    return `Свободная работа по теме: выполнено ${summary.solvedNumbers} из ${summary.totalNumbers}.`;
  }

  if (summary.redCount > 0) {
    return `${summary.redCount} ${
      summary.redCount === 1 ? "номер требует" : summary.redCount < 5 ? "номера требуют" : "номеров требуют"
    } разбора, выполнено ${summary.solvedNumbers} из ${summary.totalNumbers}.`;
  }

  if (summary.solvedNumbers === summary.totalNumbers) {
    return `Домашнее задание закрыто полностью: выполнены все ${summary.totalNumbers} номеров.`;
  }

  if (summary.solvedNumbers > 0) {
    return `Выполнено ${summary.solvedNumbers} из ${summary.totalNumbers}, без отметки остаётся ${summary.unmarkedCount}.`;
  }

  return "К этому домашнему заданию ученик пока не приступал.";
}

function applyBaseCellStyle(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, color: { argb: colors.text } };
  cell.alignment = { vertical: "middle" };
  cell.border = {
    bottom: { style: "thin", color: { argb: colors.border } }
  };
}

function setTitleRow(worksheet: ExcelJS.Worksheet, rowNumber: number, title: string, columnsCount: number) {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnsCount);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = title;
  cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: colors.navy } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.titleBg } };
  cell.alignment = { vertical: "middle" };
  cell.border = {
    top: { style: "thin", color: { argb: colors.softBorder } },
    bottom: { style: "thin", color: { argb: colors.softBorder } },
    left: { style: "thin", color: { argb: colors.softBorder } },
    right: { style: "thin", color: { argb: colors.softBorder } }
  };
  worksheet.getRow(rowNumber).height = 28;
}

function setSectionLabel(worksheet: ExcelJS.Worksheet, rowNumber: number, label: string) {
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = label;
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: colors.navy } };
}

function setTableHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: colors.navy } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: colors.border } },
      bottom: { style: "thin", color: { argb: colors.border } },
      left: { style: "thin", color: { argb: colors.softBorder } },
      right: { style: "thin", color: { argb: colors.softBorder } }
    };
  });
  row.height = 22;
}

function setDataRow(row: ExcelJS.Row, zebra = false) {
  row.eachCell((cell) => {
    applyBaseCellStyle(cell);

    if (zebra) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.slateSoft } };
    }
  });
  row.height = 22;
}

function setStatusCellStyle(cell: ExcelJS.Cell, statusKey: string) {
  applyBaseCellStyle(cell);

  if (statusKey === "GREEN") {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: colors.green } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.greenSoft } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "BBF7D0" } }
    };
    return;
  }

  if (statusKey === "YELLOW") {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: colors.yellow } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.yellowSoft } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FDE68A" } }
    };
    return;
  }

  if (statusKey === "RED") {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: colors.red } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.redSoft } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FECACA" } }
    };
  }
}

function setAssignmentStateStyle(cell: ExcelJS.Cell, kind: AssignmentSummary["stateKind"]) {
  applyBaseCellStyle(cell);
  cell.font = { name: "Calibri", size: 11, bold: true };
  cell.alignment = { horizontal: "center", vertical: "middle" };

  if (kind === "done") {
    cell.font.color = { argb: colors.green };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.greenSoft } };
    return;
  }

  if (kind === "progress") {
    cell.font.color = { argb: colors.blue };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.blueSoft } };
    return;
  }

  if (kind === "attention") {
    cell.font.color = { argb: colors.red };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.redSoft } };
    return;
  }

  cell.font.color = { argb: colors.muted };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.slateSoft } };
}

function addProgressBarRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  count: number,
  total: number,
  fillColor: string
) {
  const row = worksheet.getRow(rowNumber);
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  const segments = 12;
  const filledSegments = total > 0 ? Math.round((count / total) * segments) : 0;

  worksheet.getCell(rowNumber, 1).value = label;
  worksheet.getCell(rowNumber, 2).value = `${count} из ${total}`;
  worksheet.getCell(rowNumber, 3).value = `${percent}%`;

  for (let index = 0; index < segments; index += 1) {
    const cell = worksheet.getCell(rowNumber, 4 + index);
    cell.value = "";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index < filledSegments ? fillColor : colors.track }
    };
    cell.border = {
      top: { style: "thin", color: { argb: colors.softBorder } },
      bottom: { style: "thin", color: { argb: colors.softBorder } },
      left: { style: "thin", color: { argb: colors.softBorder } },
      right: { style: "thin", color: { argb: colors.softBorder } }
    };
  }

  [1, 2, 3].forEach((column) => applyBaseCellStyle(worksheet.getCell(rowNumber, column)));
  worksheet.getCell(rowNumber, 3).alignment = { horizontal: "right", vertical: "middle" };
  row.height = 20;
}

function setSummarySheet(
  worksheet: ExcelJS.Worksheet,
  {
    studentName,
    studentEmail,
    exportDateLabel,
    totalNumbers,
    totalSolved,
    totalGreen,
    totalYellow,
    totalRed,
    totalMarked,
    issuedAssignments,
    doneAssignments,
    inProgressAssignments,
    attentionAssignments,
    currentStreak,
    solvedThisWeek
  }: {
    studentName: string;
    studentEmail: string;
    exportDateLabel: string;
    totalNumbers: number;
    totalSolved: number;
    totalGreen: number;
    totalYellow: number;
    totalRed: number;
    totalMarked: number;
    issuedAssignments: number;
    doneAssignments: number;
    inProgressAssignments: number;
    attentionAssignments: number;
    currentStreak: number;
    solvedThisWeek: number;
  }
) {
  worksheet.views = [{ showGridLines: false }];
  worksheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  worksheet.columns = [
    { width: 28 },
    { width: 18 },
    { width: 12 },
    ...Array.from({ length: 12 }, () => ({ width: 4 }))
  ];

  setTitleRow(worksheet, 1, "Отчёт по прогрессу ученика", 15);

  setSectionLabel(worksheet, 3, "Ученик");
  const infoRows = [
    ["Имя", studentName],
    ["Логин", studentEmail],
    ["Дата экспорта", exportDateLabel]
  ];

  infoRows.forEach(([label, value], index) => {
    const rowNumber = 4 + index;
    worksheet.getCell(rowNumber, 1).value = label;
    worksheet.getCell(rowNumber, 2).value = value;
    worksheet.getCell(rowNumber, 1).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: colors.muted }
    };
    applyBaseCellStyle(worksheet.getCell(rowNumber, 1));
    applyBaseCellStyle(worksheet.getCell(rowNumber, 2));
  });

  setSectionLabel(worksheet, 8, "Домашние задания");
  const assignmentRows = [
    ["Выдано ДЗ", issuedAssignments],
    ["Выполнено", doneAssignments],
    ["В работе", inProgressAssignments],
    ["Нужен разбор", attentionAssignments]
  ];

  assignmentRows.forEach(([label, value], index) => {
    const rowNumber = 9 + index;
    worksheet.getCell(rowNumber, 1).value = label;
    worksheet.getCell(rowNumber, 2).value = value;
    applyBaseCellStyle(worksheet.getCell(rowNumber, 1));
    applyBaseCellStyle(worksheet.getCell(rowNumber, 2));
    worksheet.getCell(rowNumber, 2).font = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: colors.navy }
    };
  });

  setSectionLabel(worksheet, 14, "Активность");
  const activityRows = [
    ["Огонёк (дней подряд)", currentStreak],
    ["Закрыто за последние 7 дней", solvedThisWeek]
  ];

  activityRows.forEach(([label, value], index) => {
    const rowNumber = 15 + index;
    worksheet.getCell(rowNumber, 1).value = label;
    worksheet.getCell(rowNumber, 2).value = value;
    applyBaseCellStyle(worksheet.getCell(rowNumber, 1));
    applyBaseCellStyle(worksheet.getCell(rowNumber, 2));
    worksheet.getCell(rowNumber, 2).font = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: colors.blue }
    };
  });

  setSectionLabel(worksheet, 18, "Наглядный прогресс по номерам");
  addProgressBarRow(worksheet, 19, "Решены с первого раза", totalGreen, totalNumbers, colors.green);
  addProgressBarRow(worksheet, 20, "Решены после самопроверки", totalYellow, totalNumbers, colors.yellow);
  addProgressBarRow(worksheet, 21, "Требуют разбора", totalRed, totalNumbers, colors.red);
  addProgressBarRow(
    worksheet,
    22,
    "Пока без отметки",
    totalNumbers - totalMarked,
    totalNumbers,
    colors.muted
  );
  addProgressBarRow(worksheet, 23, "Общий прогресс", totalSolved, totalNumbers, colors.blue);

  setSectionLabel(worksheet, 25, "Как читать отчёт");
  const explanations = [
    "Решён сразу и верно: ученик выполнил номер без ошибок.",
    "Решён после самопроверки: номер удалось довести до правильного решения после доработки.",
    "Нужен разбор с преподавателем: по этому номеру сейчас нужна помощь на занятии."
  ];

  explanations.forEach((text, index) => {
    const rowNumber = 26 + index;
    worksheet.mergeCells(rowNumber, 1, rowNumber, 15);
    const cell = worksheet.getCell(rowNumber, 1);
    cell.value = text;
    cell.font = { name: "Calibri", size: 11, color: { argb: colors.text } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: colors.softBorder } }
    };
  });
}

function setHomeworkSheet(worksheet: ExcelJS.Worksheet, assignments: AssignmentSummary[]) {
  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  worksheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 44 }
  ];

  worksheet.autoFilter = "A2:H2";
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  setTitleRow(worksheet, 1, "Домашние задания", 8);
  const headerRow = worksheet.getRow(2);
  headerRow.values = [
    "Тема",
    "Домашнее задание",
    "Дедлайн",
    "Выполнено",
    "Нужен разбор",
    "Без отметки",
    "Итог",
    "Пояснение для родителей"
  ];
  setTableHeader(headerRow);

  assignments.forEach((assignment, index) => {
    const rowNumber = index + 3;
    const row = worksheet.getRow(rowNumber);
    row.values = [
      assignment.topicTitle,
      assignment.label,
      assignment.deadlineAt ?? "Без дедлайна",
      `${assignment.solvedNumbers} из ${assignment.totalNumbers}`,
      assignment.redCount,
      assignment.unmarkedCount,
      assignment.state,
      assignment.note
    ];
    setDataRow(row, index % 2 === 1);
    worksheet.getCell(rowNumber, 7).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(rowNumber, 8).alignment = { wrapText: true, vertical: "middle" };
    setAssignmentStateStyle(worksheet.getCell(rowNumber, 7), assignment.stateKind);
  });
}

function setDetailsSheet(
  worksheet: ExcelJS.Worksheet,
  detailRows: Array<DetailRow & { assignmentLabel: string }>
) {
  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  worksheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 10 },
    { width: 26 },
    { width: 18 },
    { width: 42 },
    { width: 18 }
  ];

  worksheet.autoFilter = "A2:G2";
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  setTitleRow(worksheet, 1, "Номера по домашним заданиям", 7);
  const headerRow = worksheet.getRow(2);
  headerRow.values = ["Тема", "ДЗ", "Номер", "Результат", "Дедлайн", "Комментарий ученика", "Обновлено"];
  setTableHeader(headerRow);

  detailRows.forEach((rowData, index) => {
    const rowNumber = index + 3;
    const row = worksheet.getRow(rowNumber);
    row.values = [
      rowData.topicTitle,
      rowData.assignmentLabel,
      rowData.number,
      rowData.statusLabel,
      rowData.deadline || "Без дедлайна",
      rowData.note || "—",
      rowData.updated
    ];
    setDataRow(row, index % 2 === 1);
    worksheet.getCell(rowNumber, 6).alignment = { wrapText: true, vertical: "middle" };
    setStatusCellStyle(worksheet.getCell(rowNumber, 4), rowData.statusKey);
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  let studentId = "unknown";

  try {
    const user = await tryGetCurrentUser();

    if (!user || user.role !== UserRole.TEACHER) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    ({ studentId } = await params);
    const data = await loadExportData(studentId);

    if (!data) {
      logWarnEvent(
        "student.export.missing",
        {
          userId: user.id,
          studentId,
          method: request.method,
          path: new URL(request.url).pathname
        },
        undefined,
        "Student progress export was requested for a missing student."
      );
      return new NextResponse("Student not found", { status: 404 });
    }

    const exportDate = new Date();
    const exportDateLabel = formatDateTime(exportDate);
    const period = new URL(request.url).searchParams.get("period");

    if (period === "week") {
      const since = new Date(exportDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      type WeeklyRow = {
        topicTitle: string;
        number: number;
        statusKey: string;
        statusLabel: string;
        note: string;
        updatedAt: Date;
      };

      const weeklyRows: WeeklyRow[] = [];

      for (const topic of data.topics) {
        for (const numberEntry of topic.homeworkNumbers) {
          const statusEntry = numberEntry.statuses[0] ?? null;

          if (!statusEntry?.status || !statusEntry.updatedAt || statusEntry.updatedAt < since) {
            continue;
          }

          weeklyRows.push({
            topicTitle: topic.title,
            number: numberEntry.number,
            statusKey: statusEntry.status,
            statusLabel: statusLabels[statusEntry.status] ?? "Пока без отметки",
            note: data.notesEnabled ? ((statusEntry as { note?: string | null })?.note ?? "") : "",
            updatedAt: statusEntry.updatedAt
          });
        }
      }

      weeklyRows.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

      const [timeline, streak] = await Promise.all([
        getProgressTimeline(studentId, 7),
        computeStudentStreak(studentId).catch(() => null)
      ]);

      const greenCount = weeklyRows.filter((row) => row.statusKey === "GREEN").length;
      const yellowCount = weeklyRows.filter((row) => row.statusKey === "YELLOW").length;
      const redCount = weeklyRows.filter((row) => row.statusKey === "RED").length;
      const activeDays = timeline.filter((entry) => entry.closedCount > 0 || entry.redCount > 0).length;
      const periodLabel = `${formatDateTime(since).split(",")[0]} — ${formatDateTime(exportDate).split(",")[0]}`;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "TutorFlow";
      workbook.created = exportDate;
      workbook.modified = exportDate;

      const weekSheet = workbook.addWorksheet("Неделя");
      weekSheet.views = [{ showGridLines: false }];
      weekSheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      weekSheet.columns = [{ width: 30 }, { width: 16 }, { width: 14 }, { width: 14 }];

      setTitleRow(weekSheet, 1, "Активность за 7 дней", 4);

      setSectionLabel(weekSheet, 3, "Ученик");
      const infoRows: Array<[string, string]> = [
        ["Имя", data.student.name],
        ["Логин", data.student.email],
        ["Период", periodLabel]
      ];

      infoRows.forEach(([label, value], index) => {
        const rowNumber = 4 + index;
        weekSheet.getCell(rowNumber, 1).value = label;
        weekSheet.getCell(rowNumber, 2).value = value;
        weekSheet.getCell(rowNumber, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: colors.muted } };
        applyBaseCellStyle(weekSheet.getCell(rowNumber, 1));
        applyBaseCellStyle(weekSheet.getCell(rowNumber, 2));
      });

      setSectionLabel(weekSheet, 8, "Итоги недели");
      const summaryRows: Array<[string, number | string]> = [
        ["Закрыто номеров", greenCount + yellowCount],
        ["Из них с первого раза", greenCount],
        ["После самопроверки", yellowCount],
        ["Отмечено «нужен разбор»", redCount],
        ["Дней с активностью", `${activeDays} из 7`],
        ["Огонёк сейчас", `${streak?.currentStreak ?? 0} дн.`]
      ];

      summaryRows.forEach(([label, value], index) => {
        const rowNumber = 9 + index;
        weekSheet.getCell(rowNumber, 1).value = label;
        weekSheet.getCell(rowNumber, 2).value = value;
        applyBaseCellStyle(weekSheet.getCell(rowNumber, 1));
        applyBaseCellStyle(weekSheet.getCell(rowNumber, 2));
        weekSheet.getCell(rowNumber, 2).font = { name: "Calibri", size: 12, bold: true, color: { argb: colors.navy } };
      });

      setSectionLabel(weekSheet, 16, "По дням");
      const daysHeader = weekSheet.getRow(17);
      daysHeader.values = ["Дата", "День", "Закрыто", "Красных"];
      setTableHeader(daysHeader);

      timeline.forEach((entry, index) => {
        const rowNumber = 18 + index;
        const row = weekSheet.getRow(rowNumber);
        const entryDate = new Date(`${entry.date}T12:00:00`);
        row.values = [
          new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(entryDate),
          new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(entryDate),
          entry.closedCount,
          entry.redCount
        ];
        setDataRow(row, index % 2 === 1);
        weekSheet.getCell(rowNumber, 3).font = {
          name: "Calibri",
          size: 11,
          bold: entry.closedCount > 0,
          color: { argb: entry.closedCount > 0 ? colors.green : colors.muted }
        };
        weekSheet.getCell(rowNumber, 4).font = {
          name: "Calibri",
          size: 11,
          bold: entry.redCount > 0,
          color: { argb: entry.redCount > 0 ? colors.red : colors.muted }
        };
      });

      const doneSheet = workbook.addWorksheet("Что сделано");
      doneSheet.views = [{ state: "frozen", ySplit: 2 }];
      doneSheet.autoFilter = "A2:E2";
      doneSheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      doneSheet.columns = [{ width: 18 }, { width: 28 }, { width: 10 }, { width: 26 }, { width: 44 }];

      setTitleRow(doneSheet, 1, "Разобранные номера за неделю", 5);
      const doneHeader = doneSheet.getRow(2);
      doneHeader.values = ["Когда", "Тема", "Номер", "Результат", "Комментарий ученика"];
      setTableHeader(doneHeader);

      if (weeklyRows.length === 0) {
        doneSheet.mergeCells(3, 1, 3, 5);
        const cell = doneSheet.getCell(3, 1);
        cell.value = "За эту неделю ученик не отметил ни одного номера.";
        cell.font = { name: "Calibri", size: 11, color: { argb: colors.muted } };
        cell.alignment = { vertical: "middle" };
      } else {
        weeklyRows.forEach((rowData, index) => {
          const rowNumber = index + 3;
          const row = doneSheet.getRow(rowNumber);
          row.values = [
            formatDateTime(rowData.updatedAt),
            rowData.topicTitle,
            rowData.number,
            rowData.statusLabel,
            rowData.note || "—"
          ];
          setDataRow(row, index % 2 === 1);
          doneSheet.getCell(rowNumber, 5).alignment = { wrapText: true, vertical: "middle" };
          setStatusCellStyle(doneSheet.getCell(rowNumber, 4), rowData.statusKey);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const datePart = exportDate.toISOString().slice(0, 10);
      const asciiName = data.student.name.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 30);
      const asciiFileName = `week-progress-${asciiName ? `${asciiName}-` : ""}${datePart}.xlsx`;
      const utfFileName = encodeURIComponent(`Неделя — ${data.student.name} — ${datePart}.xlsx`);

      logInfoEvent(
        "student.export.succeeded",
        getRequestLogContext(request, {
          userId: user.id,
          studentId,
          period: "week",
          rows: weeklyRows.length,
          workbookBytes: buffer.byteLength
        }),
        "Weekly student progress export was generated."
      );

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${utfFileName}`,
          "Cache-Control": "no-store"
        }
      });
    }

    let totalNumbers = 0;
    let totalMarked = 0;
    let totalSolved = 0;
    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;

    const assignmentGroupsByTopic = new Map<
      string,
      {
        titled: Map<string, { deadlineAt: string; rows: AssignmentRow[] }>;
        undated: AssignmentRow[];
      }
    >();
    const detailRows: DetailRow[] = [];

    for (const topic of data.topics) {
      const topicGroups = assignmentGroupsByTopic.get(topic.title) ?? {
        titled: new Map<string, { deadlineAt: string; rows: AssignmentRow[] }>(),
        undated: []
      };

      for (const numberEntry of topic.homeworkNumbers) {
        totalNumbers += 1;
        const statusEntry = numberEntry.statuses[0] ?? null;
        const statusKey = statusEntry?.status ?? null;

        if (statusKey) {
          totalMarked += 1;
        }

        if (statusKey === "GREEN") {
          totalGreen += 1;
          totalSolved += 1;
        } else if (statusKey === "YELLOW") {
          totalYellow += 1;
          totalSolved += 1;
        } else if (statusKey === "RED") {
          totalRed += 1;
        }

        const note = data.notesEnabled ? ((statusEntry as { note?: string | null })?.note ?? "") : "";
        const deadlineAt =
          data.deadlinesEnabled && (statusEntry as { deadlineAt?: Date | null })?.deadlineAt
            ? (statusEntry as { deadlineAt?: Date | null }).deadlineAt ?? null
            : null;
        const deadlineLabel = deadlineAt ? formatDateTime(deadlineAt) : "";
        const updatedLabel = statusEntry?.updatedAt ? formatDateTime(statusEntry.updatedAt) : "";
        const statusLabel = statusLabels[statusKey ?? ""] ?? "Пока без отметки";

        const assignmentRow: AssignmentRow = {
          number: numberEntry.number,
          statusLabel,
          statusKey: statusKey ?? "UNMARKED",
          note,
          updated: updatedLabel
        };

        if (deadlineAt) {
          const deadlineKey = deadlineAt.toISOString();
          const current = topicGroups.titled.get(deadlineKey) ?? {
            deadlineAt: deadlineKey,
            rows: []
          };
          current.rows.push(assignmentRow);
          topicGroups.titled.set(deadlineKey, current);
        } else {
          topicGroups.undated.push(assignmentRow);
        }

        detailRows.push({
          topicTitle: topic.title,
          assignmentKey: deadlineAt ? deadlineAt.toISOString() : "__undated__",
          number: numberEntry.number,
          statusKey: statusKey ?? "UNMARKED",
          statusLabel,
          deadline: deadlineLabel,
          note,
          updated: updatedLabel
        });
      }

      assignmentGroupsByTopic.set(topic.title, topicGroups);
    }

    const assignmentLabels = new Map<string, string>();
    const assignmentSummaries: AssignmentSummary[] = [];

    for (const [topicTitle, topicGroups] of assignmentGroupsByTopic.entries()) {
      const titledGroups = Array.from(topicGroups.titled.values()).sort(
        (left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime()
      );

      titledGroups.forEach((group, index) => {
        const greenCount = group.rows.filter((row) => row.statusKey === "GREEN").length;
        const yellowCount = group.rows.filter((row) => row.statusKey === "YELLOW").length;
        const redCount = group.rows.filter((row) => row.statusKey === "RED").length;
        const solvedNumbers = greenCount + yellowCount;
        const unmarkedCount = group.rows.length - (greenCount + yellowCount + redCount);
        const state = buildAssignmentState({
          totalNumbers: group.rows.length,
          solvedNumbers,
          redCount,
          markedCount: group.rows.length - unmarkedCount
        });
        const assignmentKey = `${topicTitle}::${group.deadlineAt}`;
        const label = `ДЗ ${index + 1}`;

        assignmentLabels.set(assignmentKey, label);
        assignmentSummaries.push({
          topicTitle,
          label,
          assignmentKey,
          deadlineAt: formatDateTime(group.deadlineAt),
          totalNumbers: group.rows.length,
          solvedNumbers,
          greenCount,
          yellowCount,
          redCount,
          unmarkedCount,
          state: state.label,
          stateKind: state.kind,
          note: buildAssignmentNote({
            totalNumbers: group.rows.length,
            solvedNumbers,
            redCount,
            unmarkedCount,
            deadlineAt: group.deadlineAt
          })
        });
      });

      if (topicGroups.undated.length > 0) {
        const greenCount = topicGroups.undated.filter((row) => row.statusKey === "GREEN").length;
        const yellowCount = topicGroups.undated.filter((row) => row.statusKey === "YELLOW").length;
        const redCount = topicGroups.undated.filter((row) => row.statusKey === "RED").length;
        const solvedNumbers = greenCount + yellowCount;
        const unmarkedCount = topicGroups.undated.length - (greenCount + yellowCount + redCount);
        const state = buildAssignmentState({
          totalNumbers: topicGroups.undated.length,
          solvedNumbers,
          redCount,
          markedCount: topicGroups.undated.length - unmarkedCount
        });
        const assignmentKey = `${topicTitle}::__undated__`;

        assignmentLabels.set(assignmentKey, "Без дедлайна");
        assignmentSummaries.push({
          topicTitle,
          label: "Без дедлайна",
          assignmentKey,
          deadlineAt: null,
          totalNumbers: topicGroups.undated.length,
          solvedNumbers,
          greenCount,
          yellowCount,
          redCount,
          unmarkedCount,
          state: state.label,
          stateKind: state.kind,
          note: buildAssignmentNote({
            totalNumbers: topicGroups.undated.length,
            solvedNumbers,
            redCount,
            unmarkedCount,
            deadlineAt: null
          })
        });
      }
    }

    const issuedAssignments = assignmentSummaries.filter((assignment) => assignment.deadlineAt);
    const doneAssignments = issuedAssignments.filter((assignment) => assignment.stateKind === "done");
    const attentionAssignments = issuedAssignments.filter(
      (assignment) => assignment.stateKind === "attention"
    );
    const inProgressAssignments = issuedAssignments.filter(
      (assignment) => assignment.stateKind === "progress"
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TutorFlow";
    workbook.created = exportDate;
    workbook.modified = exportDate;
    workbook.company = "TutorFlow";

    const streak = await computeStudentStreak(studentId).catch(() => null);

    const summarySheet = workbook.addWorksheet("Сводка");
    setSummarySheet(summarySheet, {
      studentName: data.student.name,
      studentEmail: data.student.email,
      exportDateLabel,
      totalNumbers,
      totalSolved,
      totalGreen,
      totalYellow,
      totalRed,
      totalMarked,
      issuedAssignments: issuedAssignments.length,
      doneAssignments: doneAssignments.length,
      inProgressAssignments: inProgressAssignments.length,
      attentionAssignments: attentionAssignments.length,
      currentStreak: streak?.currentStreak ?? 0,
      solvedThisWeek: streak?.solvedThisWeek ?? 0
    });

    const homeworkSheet = workbook.addWorksheet("Домашние задания");
    setHomeworkSheet(homeworkSheet, assignmentSummaries);

    const detailsSheet = workbook.addWorksheet("Номера");
    setDetailsSheet(
      detailsSheet,
      detailRows.map((row) => ({
        ...row,
        assignmentLabel: assignmentLabels.get(`${row.topicTitle}::${row.assignmentKey}`) ?? "Без дедлайна"
      }))
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const datePart = exportDate.toISOString().slice(0, 10);
    const asciiName = data.student.name.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 30);
    const asciiFileName = `progress-${asciiName ? `${asciiName}-` : ""}${datePart}.xlsx`;
    const utfFileName = encodeURIComponent(`Прогресс — ${data.student.name} — ${datePart}.xlsx`);

    logInfoEvent(
      "student.export.succeeded",
      getRequestLogContext(request, {
        userId: user.id,
        studentId,
        totalNumbers,
        issuedAssignments: issuedAssignments.length,
        workbookBytes: buffer.byteLength
      }),
      "Student progress export was generated."
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${utfFileName}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logErrorEvent(
      "student.export.failed",
      getRequestLogContext(request, {
        studentId
      }),
      error,
      "Failed to export student progress file."
    );
    return new NextResponse("Export failed", { status: 500 });
  }
}
