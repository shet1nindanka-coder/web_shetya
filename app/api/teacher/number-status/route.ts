import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStatuses = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
] as const;

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:teacher-number-status", user.id, 240, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        studentId?: string;
        homeworkNumberId?: string;
        status?: HomeworkNumberStatus | null;
      }
    | null;

  const studentId = String(body?.studentId ?? "").trim();
  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const statusProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "status"));
  const status = body?.status ?? null;

  if (
    !studentId ||
    !homeworkNumberId ||
    !statusProvided ||
    (status !== null && !allowedStatuses.includes(status))
  ) {
    return NextResponse.json({ error: "Некорректные данные для статуса." }, { status: 400 });
  }

  const [student, homeworkNumber] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, role: UserRole.STUDENT },
      select: { id: true }
    }),
    prisma.topicHomeworkNumber.findUnique({
      where: { id: homeworkNumberId },
      select: { id: true, topicId: true }
    })
  ]);

  if (!student || !homeworkNumber) {
    return NextResponse.json({ error: "Ученик или номер не найден." }, { status: 404 });
  }

  await prisma.studentTopicNumberStatus.upsert({
    where: {
      studentId_homeworkNumberId: {
        studentId,
        homeworkNumberId
      }
    },
    update: { status },
    create: {
      studentId,
      homeworkNumberId,
      status
    }
  });

  revalidateAllPlatformData();
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/student");
  revalidatePath("/student/homeworks");

  publishDashboardRealtimeEvent({
    kind: "student-progress-changed",
    studentId,
    topicId: homeworkNumber.topicId
  });

  logInfoEvent("teacher.number_status.set", {
    teacherId: user.id,
    studentId,
    homeworkNumberId,
    status: status ?? "CLEARED"
  });

  return NextResponse.json({ ok: true, status });
}
