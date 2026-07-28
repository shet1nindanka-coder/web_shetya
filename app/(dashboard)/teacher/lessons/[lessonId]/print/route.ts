import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { buildLessonPrintPayload } from "@/lib/lesson-print-data";
import { renderLessonPrintHtml } from "@/lib/lesson-print-html";

export const runtime = "nodejs";

/** HTML-версия раздатки: отладка вёрстки и фолбэк, когда Chromium недоступен. */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("lesson-pdf", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");

  const payload = await buildLessonPrintPayload(lessonId, studentId);

  if (!payload || payload.printData.participants.length === 0) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  return new NextResponse(renderLessonPrintHtml(payload.printData), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
