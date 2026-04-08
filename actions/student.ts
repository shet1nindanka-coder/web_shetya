"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { revalidateTeacherStudentsData, revalidateTeacherTopicsData } from "@/lib/platform-data-cache";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, getClientIpFromHeaders, RateLimitExceededError } from "@/lib/rate-limit";

function redirectTeacherWithStudentStatus(params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `/teacher/students?${query}` : "/teacher/students");
}

export async function createStudentAction(formData: FormData) {
  const teacher = await requireUser(UserRole.TEACHER);

  const name = String(formData.get("name") ?? "").trim();
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !login || password.trim().length < 8) {
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "invalid" }));
  }

  try {
    const clientIp = getClientIpFromHeaders(await headers());

    assertRateLimit(
      {
        scope: "create-student",
        identifier: `${teacher.id}:${clientIp}`,
        limit: 20,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много попыток создать учеников."
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "rateLimited" }));
    }

    throw error;
  }

  const existingStudent = await prisma.user.findUnique({
    where: {
      email: login
    },
    select: {
      id: true
    }
  });

  if (existingStudent) {
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "exists" }));
  }

  try {
    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        name,
        email: login,
        passwordHash,
        role: UserRole.STUDENT
      }
    });
  } catch (error) {
    console.error("Failed to create student.", error);
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "save" }));
  }

  revalidateTeacherStudentsData();
  revalidateTeacherTopicsData();
  publishDashboardRealtimeEvent({ kind: "students-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/statistics");
  redirectTeacherWithStudentStatus(new URLSearchParams({ studentCreated: "1" }));
}

export async function deleteStudentAction(formData: FormData) {
  await requireUser(UserRole.TEACHER);

  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!studentId) {
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "delete" }));
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: UserRole.STUDENT
    },
    select: {
      id: true
    }
  });

  if (!student) {
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "deleteMissing" }));
  }

  try {
    await prisma.user.delete({
      where: {
        id: studentId
      }
    });
  } catch (error) {
    console.error("Failed to delete student.", error);
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "delete" }));
  }

  revalidateTeacherStudentsData();
  revalidateTeacherTopicsData();
  publishDashboardRealtimeEvent({ kind: "students-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/statistics");
  revalidatePath(`/teacher/students/${studentId}`);
  redirectTeacherWithStudentStatus(new URLSearchParams({ studentDeleted: "1" }));
}
