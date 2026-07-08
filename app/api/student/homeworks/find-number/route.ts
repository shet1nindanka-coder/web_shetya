import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isMissingHomeworkAssignmentTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.message.includes("HomeworkAssignment")
  );
}

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:student-find-number", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const requestedNumber = Number(new URL(request.url).searchParams.get("number"));

  if (!Number.isInteger(requestedNumber) || requestedNumber <= 0) {
    return NextResponse.json({ error: "Введите корректный номер." }, { status: 400 });
  }

  let assignment: { id: string } | null;

  try {
    assignment = await prisma.homeworkAssignment.findFirst({
      where: {
        studentId: user.id,
        numbers: {
          some: {
            homeworkNumber: {
              number: requestedNumber
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return NextResponse.json(
        { error: "Раздел ДЗ ещё не готов. Попробуйте позже." },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!assignment) {
    return NextResponse.json({ error: "Этот номер не входит в ваши ДЗ." }, { status: 404 });
  }

  return NextResponse.json({
    href: `/student/homeworks/${assignment.id}#number-${requestedNumber}`
  });
}
