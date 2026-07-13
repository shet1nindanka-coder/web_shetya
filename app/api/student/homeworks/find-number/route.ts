import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:student-find-number", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const requestedNumber = Number(new URL(request.url).searchParams.get("number"));

  // Верхняя граница = int4 в PostgreSQL: без неё большое число (напр. 9999999999)
  // проходит проверку, но роняет запрос Prisma с ошибкой диапазона (500).
  if (!Number.isInteger(requestedNumber) || requestedNumber <= 0 || requestedNumber > 2_147_483_647) {
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
