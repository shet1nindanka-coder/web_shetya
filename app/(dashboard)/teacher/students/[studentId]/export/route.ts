import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const statusLabels: Record<string, string> = {
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

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(
  value: string | number | null | undefined,
  {
    styleId,
    type = typeof value === "number" ? "Number" : "String",
    mergeAcross
  }: {
    styleId?: string;
    type?: "String" | "Number";
    mergeAcross?: number;
  } = {}
) {
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : "";
  const mergeAttr = typeof mergeAcross === "number" ? ` ss:MergeAcross="${mergeAcross}"` : "";

  return `<Cell${styleAttr}${mergeAttr}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function xmlRow(cells: string[]) {
  return `<Row>${cells.join("")}</Row>`;
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
  stateStyleId: string;
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
      styleId: "StateAttention"
    };
  }

  if (summary.totalNumbers > 0 && summary.solvedNumbers === summary.totalNumbers) {
    return {
      label: "Выполнено",
      styleId: "StateDone"
    };
  }

  if (summary.markedCount > 0) {
    return {
      label: "В работе",
      styleId: "StateProgress"
    };
  }

  return {
    label: "Пока не начато",
    styleId: "StateMuted"
  };
}

function encodeUtf16LeWithBom(value: string) {
  const body = Buffer.from(value, "utf16le");
  const bom = Buffer.from([0xff, 0xfe]);
  return Buffer.concat([bom, body]);
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
      return "Эти номера пока не были выданы отдельным домашним заданием.";
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
    const assignmentGroupsByTopic = new Map<
      string,
      {
        titled: Map<
          string,
          {
            deadlineAt: string;
            rows: Array<{
              number: number;
              statusLabel: string;
              statusKey: string;
              note: string;
              updated: string;
            }>;
          }
        >;
        undated: Array<{
          number: number;
          statusLabel: string;
          statusKey: string;
          note: string;
          updated: string;
        }>;
      }
    >();

    const detailRows: Array<{
      topicTitle: string;
      assignmentKey: string;
      number: number;
      status: string;
      deadline: string;
      note: string;
      updated: string;
    }> = [];

    for (const topic of data.topics) {
      const topicGroups = assignmentGroupsByTopic.get(topic.title) ?? {
        titled: new Map<string, { deadlineAt: string; rows: Array<{ number: number; statusLabel: string; statusKey: string; note: string; updated: string }> }>(),
        undated: []
      };

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
        const deadlineAt =
          data.deadlinesEnabled && (st as { deadlineAt?: Date | null })?.deadlineAt
            ? (st as { deadlineAt?: Date | null }).deadlineAt ?? null
            : null;
        const deadline = deadlineAt ? formatDateTime(deadlineAt) : "";
        const updated = st?.updatedAt ? formatDateTime(st.updatedAt) : "";
        const statusLabel = statusLabels[sv ?? ""] ?? "Пока без отметки";
        const assignmentRow = {
          number: num.number,
          statusLabel,
          statusKey: sv ?? "UNMARKED",
          note,
          updated
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
          number: num.number,
          status: statusLabel,
          deadline,
          note,
          updated
        });
      }

      assignmentGroupsByTopic.set(topic.title, topicGroups);
    }

    const percent = totalNumbers > 0 ? Math.round((totalSolved / totalNumbers) * 100) : 0;
    const assignmentSummaries: AssignmentSummary[] = [];

    const assignmentLabels = new Map<string, string>();

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
          stateStyleId: state.styleId,
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
          stateStyleId: state.styleId,
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
    const doneAssignments = issuedAssignments.filter((assignment) => assignment.state === "Выполнено");
    const attentionAssignments = issuedAssignments.filter((assignment) => assignment.state === "Нужен разбор");
    const inProgressAssignments = issuedAssignments.filter((assignment) => assignment.state === "В работе");

    const summaryRows = [
      ["Ученик", data.student.name],
      ["Логин", data.student.email],
      ["Дата экспорта", formatDateTime(exportDate)],
      ["Выдано домашних заданий", issuedAssignments.length],
      ["Домашних заданий выполнено", doneAssignments.length],
      ["Домашних заданий в работе", inProgressAssignments.length],
      ["Домашних заданий, где нужен разбор", attentionAssignments.length],
      ["Всего номеров в темах", totalNumbers],
      ["Решено с первого раза", totalGreen],
      ["Решено после самопроверки", totalYellow],
      ["Требуют разбора", totalRed],
      ["Пока без отметки", totalNumbers - totalMarked],
      ["Общий прогресс по номерам", `${totalSolved} из ${totalNumbers} (${percent}%)`]
    ] as const;

    const summarySheetRows = [
      xmlRow([xmlCell("Отчёт по прогрессу ученика", { styleId: "Title", mergeAcross: 1 })]),
      xmlRow([xmlCell("", { mergeAcross: 1 })]),
      ...summaryRows.map(([label, value]) =>
        xmlRow([xmlCell(label, { styleId: "Label" }), xmlCell(value, { styleId: "Value" })])
      )
    ];

    const homeworkSheetRows = [
      xmlRow([xmlCell("Домашние задания", { styleId: "Title", mergeAcross: 7 })]),
      xmlRow([
        xmlCell("Тема", { styleId: "Header" }),
        xmlCell("Домашнее задание", { styleId: "Header" }),
        xmlCell("Дедлайн", { styleId: "Header" }),
        xmlCell("Выполнено", { styleId: "Header" }),
        xmlCell("Нужен разбор", { styleId: "Header" }),
        xmlCell("Пока без отметки", { styleId: "Header" }),
        xmlCell("Итог", { styleId: "Header" }),
        xmlCell("Пояснение для родителей", { styleId: "Header" })
      ]),
      ...assignmentSummaries.map((assignment) =>
        xmlRow([
          xmlCell(assignment.topicTitle, { styleId: "Cell" }),
          xmlCell(assignment.label, { styleId: "Cell" }),
          xmlCell(assignment.deadlineAt ?? "Без дедлайна", { styleId: "Cell" }),
          xmlCell(`${assignment.solvedNumbers} из ${assignment.totalNumbers}`, { styleId: "Cell" }),
          xmlCell(assignment.redCount, { styleId: "Cell", type: "Number" }),
          xmlCell(assignment.unmarkedCount, { styleId: "Cell", type: "Number" }),
          xmlCell(assignment.state, { styleId: assignment.stateStyleId }),
          xmlCell(assignment.note, { styleId: "CellWrap" })
        ])
      )
    ];

    const detailsSheetRows = [
      xmlRow([xmlCell("Номера по домашним заданиям", { styleId: "Title", mergeAcross: 6 })]),
      xmlRow([
        xmlCell("Тема", { styleId: "Header" }),
        xmlCell("ДЗ", { styleId: "Header" }),
        xmlCell("Номер", { styleId: "Header" }),
        xmlCell("Результат", { styleId: "Header" }),
        xmlCell("Дедлайн", { styleId: "Header" }),
        xmlCell("Комментарий ученика", { styleId: "Header" }),
        xmlCell("Обновлено", { styleId: "Header" })
      ]),
      ...detailRows.map((row) =>
        xmlRow([
          xmlCell(row.topicTitle, { styleId: "Cell" }),
          xmlCell(
            assignmentLabels.get(`${row.topicTitle}::${row.assignmentKey}`) ?? "Без дедлайна",
            { styleId: "Cell" }
          ),
          xmlCell(row.number, { styleId: "Cell", type: "Number" }),
          xmlCell(row.status, {
            styleId:
              row.status === "Решён сразу и верно"
                ? "StatusGreen"
                : row.status === "Решён после самопроверки"
                  ? "StatusYellow"
                  : row.status === "Нужен разбор с преподавателем"
                    ? "StatusRed"
                    : "Cell"
          }),
          xmlCell(row.deadline || "Без дедлайна", { styleId: "Cell" }),
          xmlCell(row.note || "—", { styleId: "CellWrap" }),
          xmlCell(row.updated, { styleId: "Cell" })
        ])
      )
    ];

    const workbook = `<?xml version="1.0" encoding="UTF-16"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E8F0FF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Label">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#334155"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Value">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellWrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusGreen">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusYellow">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#854D0E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusRed">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
   </Borders>
  </Style>
  <Style ss:ID="StateDone">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
  <Style ss:ID="StateProgress">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <Style ss:ID="StateAttention">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
   </Borders>
  </Style>
  <Style ss:ID="StateMuted">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Сводка">
  <Table>
   <Column ss:Width="180"/>
   <Column ss:Width="260"/>
   ${summarySheetRows.join("")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Домашние задания">
  <Table>
   <Column ss:Width="180"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="105"/>
   <Column ss:Width="130"/>
   <Column ss:Width="320"/>
   ${homeworkSheetRows.join("")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Номера">
  <Table>
   <Column ss:Width="210"/>
   <Column ss:Width="110"/>
   <Column ss:Width="70"/>
   <Column ss:Width="180"/>
   <Column ss:Width="125"/>
   <Column ss:Width="260"/>
   <Column ss:Width="130"/>
   ${detailsSheetRows.join("")}
  </Table>
 </Worksheet>
</Workbook>`;

    const datePart = exportDate.toISOString().slice(0, 10);
    const workbookBuffer = encodeUtf16LeWithBom(workbook);

    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-16le",
        "Content-Disposition": `attachment; filename="progress-${datePart}.xls"; filename*=UTF-8''progress-${datePart}.xls`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Failed to export student progress file", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
