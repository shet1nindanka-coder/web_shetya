import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { generateStudentPortrait } from "@/lib/student-portrait";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:student-portrait", user.id, 10, 5 * 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { studentId } = await params;
  const result = await generateStudentPortrait(studentId);

  if (result.ok) {
    revalidateTeacherStudentsData();
    logInfoEvent("student_portrait.manual_refresh", { userId: user.id, studentId });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
