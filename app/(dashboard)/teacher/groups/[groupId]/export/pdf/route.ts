import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { summarizeAttendance, type AttendanceValue } from "@/lib/attendance";
import { tryGetCurrentUser } from "@/lib/auth";
import { renderGroupAttendancePdf, type GroupAttendancePdfStudent } from "@/lib/group-attendance-pdf";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { getGroupAttendance } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { parseReportPeriod, REPORT_PERIOD_META, reportPeriodStart } from "@/lib/report-period";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const shortDayMonth = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });

/** PDF «Посещаемость группы» за 7 / 30 дней / учебный год. */
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  let groupId = "unknown";

  try {
    const user = await tryGetCurrentUser();

    if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rateLimitResponse = await enforceApiRateLimit("api:pdf-export", user.id, 5, 5 * 60_000);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    ({ groupId } = await params);

    // Чужая группа для учителя неотличима от несуществующей (SEC-002).
    const group = await prisma.studentGroup.findFirst({
      where: { id: groupId, ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id }) },
      select: {
        id: true,
        name: true,
        members: { orderBy: { user: { name: "asc" } }, select: { user: { select: { id: true, name: true } } } }
      }
    });

    if (!group) {
      return new NextResponse("Group not found", { status: 404 });
    }

    const period = parseReportPeriod(new URL(request.url).searchParams.get("period"));
    const now = new Date();
    const since = reportPeriodStart(period, now);
    const lessons = await getGroupAttendance(user, group.id, since, now);

    const students: GroupAttendancePdfStudent[] = group.members.map((member) => {
      const cells = lessons.map((lesson) => {
        const participant = lesson.participants.find((entry) => entry.studentId === member.user.id);

        return participant ? (participant.attendance as AttendanceValue) : null;
      });
      const summary = summarizeAttendance(cells.filter((value): value is AttendanceValue => value !== null));

      return {
        name: member.user.name,
        attendedLabel: summary.counted > 0 ? `${summary.attended} из ${summary.counted}` : "—",
        lateLabel: String(summary.late),
        absentLabel: String(summary.absent),
        excusedLabel: String(summary.excused),
        percentLabel: summary.percent !== null ? `${summary.percent}%` : "—",
        cells
      };
    });

    const percents = students
      .map((student) => summarizeAttendance(student.cells.filter((value): value is AttendanceValue => value !== null)).percent)
      .filter((value): value is number => value !== null);
    const averagePercent = percents.length > 0 ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : null;
    const allValues = students.flatMap((student) => student.cells).filter((value): value is AttendanceValue => value !== null);

    const buffer = await renderGroupAttendancePdf({
      groupName: group.name,
      reportTitle: `ПОСЕЩАЕМОСТЬ · ${REPORT_PERIOD_META[period].title}`,
      periodLabel: `${shortDate.format(since)} — ${shortDate.format(now)}`,
      generatedLabel: formatDateTime(now),
      lessons: lessons.map((lesson) => ({ dateLabel: shortDayMonth.format(lesson.startsAt), title: lesson.title })),
      students,
      totals: {
        lessons: lessons.length,
        averagePercentLabel: averagePercent !== null ? `${averagePercent}%` : "—",
        absent: allValues.filter((value) => value === "ABSENT").length,
        excused: allValues.filter((value) => value === "EXCUSED").length
      }
    });

    const datePart = now.toISOString().slice(0, 10);
    const asciiName = group.name.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 30);
    const asciiFileName = `attendance-${period}-${asciiName ? `${asciiName}-` : ""}${datePart}.pdf`;
    const utfFileName = encodeURIComponent(`Посещаемость — ${group.name} — ${REPORT_PERIOD_META[period].fileLabel} — ${datePart}.pdf`);

    logInfoEvent(
      "group.export.attendance_pdf_succeeded",
      getRequestLogContext(request, { userId: user.id, groupId, lessons: lessons.length, pdfBytes: buffer.byteLength }),
      "Group attendance PDF report was generated."
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
      "group.export.attendance_pdf_failed",
      getRequestLogContext(request, { groupId }),
      error,
      "Failed to generate group attendance PDF report."
    );

    return new NextResponse("Export failed", { status: 500 });
  }
}
