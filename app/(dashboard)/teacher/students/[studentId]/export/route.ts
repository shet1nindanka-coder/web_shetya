import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const statusLabels: Record<string, string> = {
  GREEN: "Зелёный",
  YELLOW: "Жёлтый",
  RED: "Красный"
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

    const summaryRows = [
      ["Ученик", data.student.name],
      ["Логин", data.student.email],
      ["Дата экспорта", formatDateTime(exportDate)],
      ["Всего тем", data.topics.length],
      ["Всего номеров", totalNumbers],
      ["Решено", `${totalSolved} из ${totalNumbers}`],
      ["Прогресс", `${percent}%`],
      ["Зелёных", totalGreen],
      ["Жёлтых", totalYellow],
      ["Красных", totalRed],
      ["Без статуса", totalNumbers - totalMarked]
    ] as const;

    const summarySheetRows = [
      xmlRow([xmlCell("Отчёт по прогрессу ученика", { styleId: "Title", mergeAcross: 1 })]),
      xmlRow([xmlCell("", { mergeAcross: 1 })]),
      ...summaryRows.map(([label, value]) =>
        xmlRow([xmlCell(label, { styleId: "Label" }), xmlCell(value, { styleId: "Value" })])
      )
    ];

    const detailsSheetRows = [
      xmlRow([xmlCell("Детализация по номерам", { styleId: "Title", mergeAcross: 5 })]),
      xmlRow([
        xmlCell("Тема", { styleId: "Header" }),
        xmlCell("Номер", { styleId: "Header" }),
        xmlCell("Статус", { styleId: "Header" }),
        xmlCell("Дедлайн", { styleId: "Header" }),
        xmlCell("Заметка", { styleId: "Header" }),
        xmlCell("Обновлено", { styleId: "Header" })
      ]),
      ...detailRows.map(([topic, number, status, deadline, note, updated]) =>
        xmlRow([
          xmlCell(topic, { styleId: "Cell" }),
          xmlCell(number, { styleId: "Cell", type: "Number" }),
          xmlCell(status, {
            styleId:
              status === "Зелёный"
                ? "StatusGreen"
                : status === "Жёлтый"
                  ? "StatusYellow"
                  : status === "Красный"
                    ? "StatusRed"
                    : "Cell"
          }),
          xmlCell(deadline, { styleId: "Cell" }),
          xmlCell(note, { styleId: "CellWrap" }),
          xmlCell(updated, { styleId: "Cell" })
        ])
      )
    ];

    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
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
 </Styles>
 <Worksheet ss:Name="Сводка">
  <Table>
   <Column ss:Width="180"/>
   <Column ss:Width="260"/>
   ${summarySheetRows.join("")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Номера">
  <Table>
   <Column ss:Width="210"/>
   <Column ss:Width="70"/>
   <Column ss:Width="110"/>
   <Column ss:Width="125"/>
   <Column ss:Width="260"/>
   <Column ss:Width="130"/>
   ${detailsSheetRows.join("")}
  </Table>
 </Worksheet>
</Workbook>`;

    const datePart = exportDate.toISOString().slice(0, 10);

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="progress-${datePart}.xml"; filename*=UTF-8''progress-${datePart}.xml`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Failed to export student progress file", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
