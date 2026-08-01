import { LessonItemResult, LessonKind, SolutionCheckStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { getProgressTimeline } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { loadExportData, statusLabels } from "@/lib/student-export-data";
import { computeStudentStreak } from "@/lib/student-streak";
import {
  renderWeeklyReportPdf,
  type WeeklyPdfAssignment,
  type WeeklyPdfLesson,
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

// PDF строится синхронно и дорого по CPU/RAM — не даём собирать много параллельно.
let pdfExportsInFlight = 0;
const MAX_CONCURRENT_PDF_EXPORTS = 2;

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  if (pdfExportsInFlight >= MAX_CONCURRENT_PDF_EXPORTS) {
    return new NextResponse("Сервер занят формированием отчётов. Попробуйте через минуту.", {
      status: 503,
      headers: { "Retry-After": "30" }
    });
  }

  pdfExportsInFlight += 1;

  try {
    return await handleGet(request, context);
  } finally {
    pdfExportsInFlight -= 1;
  }
}

async function handleGet(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  let studentId = "unknown";

  try {
    const user = await tryGetCurrentUser();

    if (!user || user.role !== UserRole.TEACHER) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rateLimitResponse = await enforceApiRateLimit("api:pdf-export", user.id, 5, 5 * 60_000);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    ({ studentId } = await params);
    const data = await loadExportData(studentId);

    if (!data) {
      return new NextResponse("Student not found", { status: 404 });
    }

    const exportDate = new Date();
    const since = new Date(exportDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Реальные ДЗ ученика (выданные за неделю или с дедлайном в окне) и занятия
    // с итогами — вместо прежней реконструкции «ДЗ» по зеркалированным дедлайнам.
    const [assignmentsRaw, lessonParticipants] = await Promise.all([
      prisma.homeworkAssignment
        .findMany({
          where: { studentId, OR: [{ createdAt: { gte: since } }, { deadlineAt: { gte: since } }] },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            createdAt: true,
            deadlineAt: true,
            topic: { select: { title: true } },
            numbers: { select: { homeworkNumberId: true } },
            checks: {
              where: { status: SolutionCheckStatus.DONE },
              orderBy: { checkedAt: "desc" },
              take: 1,
              select: { results: { select: { verdict: true } } }
            }
          }
        })
        .catch(() => []),
      prisma.lessonParticipant
        .findMany({
          where: { studentId, lesson: { kind: LessonKind.LESSON, createdAt: { gte: since } } },
          orderBy: { lesson: { createdAt: "desc" } },
          take: 20,
          select: {
            lesson: { select: { title: true, createdAt: true } },
            items: {
              select: {
                result: true,
                homeworkNumber: { select: { topic: { select: { title: true } } } }
              }
            }
          }
        })
        .catch(() => [])
    ]);

    const statusByNumberId = new Map<string, string>();
    const weeklyRawRows: Array<WeeklyPdfRow & { updatedAt: Date }> = [];

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

        if (statusKey) {
          statusByNumberId.set(numberEntry.id, statusKey);
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

    let homeworkTotal = 0;
    let homeworkSolved = 0;

    const assignments: WeeklyPdfAssignment[] = assignmentsRaw.map((assignment) => {
      let solved = 0;
      let red = 0;
      let marked = 0;

      for (const entry of assignment.numbers) {
        const status = statusByNumberId.get(entry.homeworkNumberId);

        if (status) {
          marked += 1;
        }

        if (status === "GREEN" || status === "YELLOW") {
          solved += 1;
        } else if (status === "RED") {
          red += 1;
        }
      }

      const total = assignment.numbers.length;

      homeworkTotal += total;
      homeworkSolved += solved;

      const state = buildAssignmentState({ total, solved, red, marked });
      const checkResults = assignment.checks[0]?.results ?? [];
      const correct = checkResults.filter((result) => result.verdict === "CORRECT").length;
      const incorrect = checkResults.filter((result) => result.verdict === "INCORRECT").length;
      const checkLabel = checkResults.length > 0 ? `${correct} верно · ${incorrect} с ошибками` : "—";

      return {
        topicTitle: assignment.topic?.title ?? "—",
        label: assignment.title?.trim().slice(0, 60) || `ДЗ от ${shortDate.format(assignment.createdAt)}`,
        deadlineLabel: assignment.deadlineAt ? shortDeadline.format(assignment.deadlineAt) : "без дедлайна",
        doneLabel: `${solved} из ${total}`,
        checkLabel,
        stateLabel: state.label,
        stateKind: state.kind
      };
    });

    // Занятия недели с итогами светофора; «без отметки» — учитель ещё не подвёл итог.
    const lessons: WeeklyPdfLesson[] = lessonParticipants.map((participant) => {
      const topicTitles = Array.from(
        new Set(participant.items.map((item) => item.homeworkNumber.topic.title))
      );
      const total = participant.items.length;
      const solved = participant.items.filter((item) => item.result === LessonItemResult.SOLVED).length;
      const partial = participant.items.filter((item) => item.result === LessonItemResult.PARTIAL).length;
      const notSolved = participant.items.filter((item) => item.result === LessonItemResult.NOT_SOLVED).length;
      const unmarked = total - solved - partial - notSolved;

      const parts: string[] = [];

      if (solved > 0) parts.push(`${solved} решил`);
      if (partial > 0) parts.push(`${partial} с ошибками`);
      if (notSolved > 0) parts.push(`${notSolved} не решил`);
      if (unmarked > 0) parts.push(`${unmarked} без отметки`);

      return {
        dateLabel: shortDeadline.format(participant.lesson.createdAt),
        title: participant.lesson.title,
        topicsLabel: topicTitles.join(", ") || "—",
        totalLabel: String(total),
        resultsLabel: total === 0 ? "набор пуст" : parts.join(" · ")
      };
    });

    const [timeline, streak] = await Promise.all([
      getProgressTimeline(studentId, 7),
      computeStudentStreak(studentId).catch(() => null)
    ]);

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
      lessons,
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
