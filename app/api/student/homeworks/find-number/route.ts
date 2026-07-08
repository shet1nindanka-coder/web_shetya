import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

  const homeworkNumber = await prisma.topicHomeworkNumber.findFirst({
    where: { number: requestedNumber },
    select: { id: true }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Такой номер не найден." }, { status: 404 });
  }

  return NextResponse.json({
    href: `/student/numbers/${requestedNumber}`
  });
}
