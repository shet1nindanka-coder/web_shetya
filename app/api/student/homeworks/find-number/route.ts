import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeHomeworkNumber } from "@/lib/utils";

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

  const requestedNumber = (new URL(request.url).searchParams.get("number") ?? "").trim();
  // Поиск по нормализованному виду: «1023» и «001023» находят один номер.
  const normalizedNumber = normalizeHomeworkNumber(requestedNumber);

  if (!/^\d{1,20}$/.test(requestedNumber) || normalizedNumber === "0") {
    return NextResponse.json({ error: "Введите корректный номер." }, { status: 400 });
  }

  // Срезать ведущие нули на стороне Prisma нельзя: endsWith сужает выборку,
  // точное совпадение нормализованных видов — в JS. Порядок тем — как на
  // странице номера, чтобы ссылка вела туда же, куда попадёт ученик.
  const candidates = await prisma.topicHomeworkNumber.findMany({
    where: { number: { endsWith: normalizedNumber } },
    orderBy: [{ topic: { displayOrder: "asc" } }, { topic: { createdAt: "asc" } }],
    select: { number: true }
  });

  const homeworkNumber = candidates.find(
    (entry) => normalizeHomeworkNumber(entry.number) === normalizedNumber
  );

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Такой номер не найден." }, { status: 404 });
  }

  // Ссылка ведёт на записанный вид номера — как в задачнике.
  return NextResponse.json({
    href: `/student/numbers/${encodeURIComponent(homeworkNumber.number)}`
  });
}
