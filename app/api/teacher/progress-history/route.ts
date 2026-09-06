import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getProgressHistory } from "@/lib/progress-history";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Нет доступа к истории прогресса." }, { status: 403 });
  }
  const limited = await enforceApiRateLimit("api:progress-history", user.id, 90, 60_000);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const studentId = params.get("studentId")?.trim();
  const homeworkNumberId = params.get("homeworkNumberId")?.trim();
  if (!studentId || !homeworkNumberId) return NextResponse.json({ error: "Укажите ученика и номер." }, { status: 400 });
  const history = await getProgressHistory(user, studentId, homeworkNumberId, params.get("cursor") || undefined);
  if (!history) return NextResponse.json({ error: "История не найдена." }, { status: 404 });
  return NextResponse.json(history, { headers: { "Cache-Control": "private, no-store" } });
}
