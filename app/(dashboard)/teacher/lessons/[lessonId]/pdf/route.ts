import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { buildLessonPrintPayload } from "@/lib/lesson-print-data";
import { renderLessonPrintHtml } from "@/lib/lesson-print-html";
import { embedKatexAssets } from "@/lib/print-theme";
import { getRequestLogContext, logInfoEvent } from "@/lib/logger";
import { renderPdfFromHtml } from "@/lib/pdf-renderer";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const requestContext = getRequestLogContext(request);
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

  const payload = await buildLessonPrintPayload(user, lessonId, studentId);

  if (!payload || payload.printData.participants.length === 0) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  const html = embedKatexAssets(renderLessonPrintHtml(payload.printData));
  const pdf = await renderPdfFromHtml(html);

  if (!pdf) {
    // Chromium недоступен: отдаём ту же вёрстку страницей — Ctrl+P → «Сохранить как PDF».
    const fallback = html.replace(
      "<body>",
      `<body><div style="background:#fdf3e0;color:#8a5b00;padding:10px 14px;font-size:11pt;margin-bottom:8mm;" class="no-print">PDF-рендерер недоступен на сервере. Нажмите Ctrl+P (⌘P) и выберите «Сохранить как PDF».</div><style>@media print { .no-print { display:none; } }</style>`
    );

    return new NextResponse(fallback, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const dateLabel = new Date(payload.lesson.createdAt).toISOString().slice(0, 10);
  const groupSlug = (payload.printData.groupName ?? "urok").toLowerCase();
  const fileName = `urok-${dateLabel}.pdf`;
  const fileNameUtf8 = encodeURIComponent(`урок-${groupSlug}-${dateLabel}.pdf`);

  logInfoEvent("lesson_pdf.generated", {
    ...requestContext,
    userId: user.id,
    lessonId,
    participants: payload.printData.participants.length,
    bytes: pdf.length
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileNameUtf8}`
    }
  });
}
