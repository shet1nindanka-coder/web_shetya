import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { computeStudentStreak } from "@/lib/student-streak";

export const runtime = "nodejs";

export async function GET() {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const streak = await computeStudentStreak(user.id);

  return NextResponse.json({ streak });
}
