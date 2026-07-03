import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { computeStudentStreak } from "@/lib/student-streak";

export const runtime = "nodejs";

export async function GET() {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(null, "api:streak", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const streak = await computeStudentStreak(user.id);

  return NextResponse.json({ streak });
}
