import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStatuses = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
] as const;

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath("/teacher");
  revalidatePath(`/teacher/topics/${topicId}`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        topicId?: string;
        homeworkNumberId?: string;
        status?: HomeworkNumberStatus | null;
        note?: string | null;
      }
    | null;

  const topicId = String(body?.topicId ?? "").trim();
  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const statusProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "status"));
  const noteProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "note"));
  const status = body?.status;
  const note = noteProvided ? String(body?.note ?? "").trim().slice(0, 240) : undefined;

  if (
    !topicId ||
    !homeworkNumberId ||
    (!statusProvided && !noteProvided) ||
    (statusProvided && status !== null && status !== undefined && !allowedStatuses.includes(status))
  ) {
    return NextResponse.json({ error: "Некорректные данные для сохранения номера." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findFirst({
    where: {
      id: homeworkNumberId,
      topicId
    },
    select: {
      id: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер задания для этой темы не найден." }, { status: 404 });
  }

  const existingStatus = await prisma.studentTopicNumberStatus.findUnique({
    where: {
      studentId_homeworkNumberId: {
        studentId: user.id,
        homeworkNumberId
      }
    },
    select: {
      id: true,
      status: true,
      note: true
    }
  });

  const nextStatus = statusProvided ? status ?? null : existingStatus?.status ?? null;
  const nextNote = noteProvided ? (note || null) : existingStatus?.note ?? null;

  if (!nextStatus && !nextNote) {
    if (existingStatus) {
      await prisma.studentTopicNumberStatus.delete({
        where: {
          studentId_homeworkNumberId: {
            studentId: user.id,
            homeworkNumberId
          }
        }
      });
    }
  } else {
    await prisma.studentTopicNumberStatus.upsert({
      where: {
        studentId_homeworkNumberId: {
          studentId: user.id,
          homeworkNumberId
        }
      },
      update: {
        status: nextStatus,
        note: nextNote
      },
      create: {
        studentId: user.id,
        homeworkNumberId,
        status: nextStatus,
        note: nextNote
      }
    });
  }

  revalidateTopicRoutes(topicId);

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    note: nextNote ?? ""
  });
}
