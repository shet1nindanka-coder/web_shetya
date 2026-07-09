import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { getProgressTimeline } from "@/lib/platform-data";
import { loadExportData, statusLabels } from "@/lib/student-export-data";
import { computeStudentStreak } from "@/lib/student-streak";
import {
  renderWeeklyReportPdf,
  type WeeklyPdfAssignment,
  type WeeklyPdfRow
} from "@/lib/weekly-report-pdf";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const shortDeadline = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });

function buildAssignmentState(input: { total: number; solved: number; red: number; marked: number }) {
  if (input.red > 0) {
    return { label: "Нужен разбор", kind: "attention" as const };
  }

  if (input.total > 0 && input.solved === input.total) {
    return { label: "Выполнено", kind: "done" as const };
  }

  if (input.marked > 0) {
    return { label: "В работе", kind: "progress" as const };
  }

  return { label: "Не начато", kind: "muted" as const };
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
      return new NextResponse("Student not found", { status: 404 });
    }

    const exportDate = new Date();
    const since = new Date(exportDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weeklyRawRows: Array<WeeklyPdfRow & { updatedAt: Date }> = [];
    const assignmentGroups = new Map<
      string,
      { topicTitle: string; deadlineAt: Date; total: number; solved: number; red: number; marked: number }
    >();
    for (const topic of data.topics) {
      for (const numberEntry of topic.homeworkNumbers) {
        const statusEntry = numberEntry.statuses[0] ?? null;
        const statusKey = statusEntry?.status ?? null;
        // Дата «решения» — когда статус реально менялся (не updatedAt, который
        // бампается зеркалированием дедлайна). Фолбэк на updatedAt для старых строк.
        const solvedAt =
          (statusEntry as { statusChangedAt?: Date | null } | null)?.statusChangedAt ??
          statusEntry?.updatedAt ??
          null;

        const deadlineAt =
          data.deadlinesEnabled && (statusEntry as { deadlineAt?: Date | null })?.deadlineAt
            ? ((statusEntry as { deadlineAt?: Date | null }).deadlineAt ?? null)
            : null;

        if (deadlineAt && deadlineAt >= since) {
          const key = `${topic.title}::${deadlineAt.toISOString()}`;
          const group = assignmentGroups.get(key) ?? {
            topicTitle: topic.title,
            deadlineAt,
            total: 0,
            solved: 0,
            red: 0,
            marked: 0
          };
          group.total += 1;

          if (statusKey) {
            group.marked += 1;
          }

          if (statusKey === "GREEN" || statusKey === "YELLOW") {
            group.solved += 1;
          } else if (statusKey === "RED") {
            group.red += 1;
          }

          assignmentGroups.set(key, group);
        }

        if (statusKey && solvedAt && solvedAt >= since) {
          weeklyRawRows.push({
            whenLabel: shortDeadline.format(solvedAt),
            topicTitle: topic.title,
            number: numberEntry.number,
            statusKey,
            statusLabel:
              statusKey === "GREEN"
                ? "Решён сразу"
                : statusKey === "YELLOW"
                  ? "После самопроверки"
                  : (statusLabels[statusKey] ?? "Нужен разбор"),
            note: data.notesEnabled ? ((statusEntry as { note?: string | null })?.note ?? "") : "",
            updatedAt: solvedAt
          });
        }
      }
    }

    weeklyRawRows.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

    const assignmentsByTopic = new Map<string, Array<(typeof assignmentGroups extends Map<string, infer V> ? V : never)>>();

    for (const group of assignmentGroups.values()) {
      const list = assignmentsByTopic.get(group.topicTitle) ?? [];
      list.push(group);
      assignmentsByTopic.set(group.topicTitle, list);
    }

    const assignments: WeeklyPdfAssignment[] = [];

    for (const [topicTitle, groups] of assignmentsByTopic.entries()) {
      groups
        .sort((left, right) => left.deadlineAt.getTime() - right.deadlineAt.getTime())
        .forEach((group, index) => {
          const state = buildAssignmentState(group);
          assignments.push({
            topicTitle,
            label: `ДЗ ${index + 1}`,
            deadlineLabel: shortDeadline.format(group.deadlineAt),
            doneLabel: `${group.solved} из ${group.total}`,
            stateLabel: state.label,
            stateKind: state.kind
          });
        });
    }

    const [timeline, streak] = await Promise.all([
      getProgressTimeline(studentId, 7),
      computeStudentStreak(studentId).catch(() => null)
    ]);

    const homeworkGroupList = Array.from(assignmentGroups.values());
    const homeworkTotal = homeworkGroupList.reduce((sum, group) => sum + group.total, 0);
    const homeworkSolved = homeworkGroupList.reduce((sum, group) => sum + group.solved, 0);

    const greenCount = weeklyRawRows.filter((row) => row.statusKey === "GREEN").length;
    const yellowCount = weeklyRawRows.filter((row) => row.statusKey === "YELLOW").length;
    const redCount = weeklyRawRows.filter((row) => row.statusKey === "RED").length;

    const buffer = await renderWeeklyReportPdf({
      studentName: data.student.name,
      studentEmail: data.student.email,
      periodLabel: `${shortDate.format(since)} — ${shortDate.format(exportDate)}`,
      generatedLabel: formatDateTime(exportDate),
      closedCount: greenCount + yellowCount,
      greenCount,
      yellowCount,
      redCount,
      streakDays: streak?.currentStreak ?? 0,
      totalSolved: homeworkSolved,
      totalNumbers: homeworkTotal,
      days: timeline.map((entry) => ({
        label: weekday.format(new Date(`${entry.date}T12:00:00`)),
        closedCount: entry.closedCount,
        redCount: entry.redCount
      })),
      assignments,
      rows: weeklyRawRows.map(({ updatedAt: _updatedAt, ...row }) => row)
    });

    const datePart = exportDate.toISOString().slice(0, 10);
    const asciiName = data.student.name.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 30);
    const asciiFileName = `week-report-${asciiName ? `${asciiName}-` : ""}${datePart}.pdf`;
    const utfFileName = encodeURIComponent(`Неделя — ${data.student.name} — ${datePart}.pdf`);

    logInfoEvent(
      "student.export.pdf_succeeded",
      getRequestLogContext(request, {
        userId: user.id,
        studentId,
        rows: weeklyRawRows.length,
        pdfBytes: buffer.byteLength
      }),
      "Weekly student PDF report was generated."
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${utfFileName}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logErrorEvent(
      "student.export.pdf_failed",
      getRequestLogContext(request, { studentId }),
      error,
      "Failed to generate weekly student PDF report."
    );
    return new NextResponse("Export failed", { status: 500 });
  }
}
