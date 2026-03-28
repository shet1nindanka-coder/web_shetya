import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStatuses = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
] as const;

function revalidateTopicRoutes(topicId: string) {
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
      }
    | null;

  const topicId = String(body?.topicId ?? "").trim();
  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const status = body?.status;

  if (
    !topicId ||
    !homeworkNumberId ||
    status === undefined ||
    (status !== null && !allowedStatuses.includes(status))
  ) {
    return NextResponse.json({ error: "Некорректные данные для сохранения статуса." }, { status: 400 });
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
    return NextResponse.json({ error: "Номер домашнего задания для этой темы не найден." }, { status: 404 });
  }

  if (status === null || status === undefined) {
    await prisma.studentTopicNumberStatus.deleteMany({
      where: {
        studentId: user.id,
        homeworkNumberId
      }
    });
  } else {
    await prisma.studentTopicNumberStatus.upsert({
      where: {
        studentId_homeworkNumberId: {
          studentId: user.id,
          homeworkNumberId
        }
      },
      update: {
        status
      },
      create: {
        studentId: user.id,
        homeworkNumberId,
        status
      }
    });
  }

  revalidateTopicRoutes(topicId);

  return NextResponse.json({
    ok: true
  });
}
