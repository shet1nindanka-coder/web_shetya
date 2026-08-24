import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { jsonResponse } from "@/lib/api-json";
import { getRequestLogContext, logErrorEvent } from "@/lib/logger";
import { getTeacherStatisticsDrilldown } from "@/lib/platform-data";

export const runtime = "nodejs";

// Срез «тема × ученик» для страницы статистики. Отдаём только выбранную пару:
// весь банк статусов (ученики × номера) в пейлоад страницы не помещается.
export async function GET(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:statistics-drilldown", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const topicId = (searchParams.get("topicId") ?? "").trim();
  const studentId = (searchParams.get("studentId") ?? "").trim();

  if (!topicId || !studentId) {
    return NextResponse.json({ error: "Укажите тему и ученика." }, { status: 400 });
  }

  try {
    const drilldown = await getTeacherStatisticsDrilldown(user, topicId, studentId);

    if (!drilldown) {
      return NextResponse.json({ error: "Ученик не найден." }, { status: 404 });
    }

    return jsonResponse(request, {
      numbers: drilldown.numbers
    });
  } catch (error) {
    logErrorEvent(
      "teacher.statistics_drilldown.failed",
      { ...requestContext, userId: user.id, topicId, studentId },
      error,
      "Teacher statistics drilldown failed."
    );

    return NextResponse.json({ error: "Не удалось загрузить срез." }, { status: 500 });
  }
}
