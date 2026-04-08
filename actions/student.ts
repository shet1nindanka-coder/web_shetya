"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getHeadersLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
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

  const requestHeaders = await headers();
  const clientIp = getClientIpFromHeaders(requestHeaders);

  try {
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
      logWarnEvent(
        "student.create.rate_limited",
        getHeadersLogContext(requestHeaders, {
          teacherId: teacher.id
        }),
        error,
        "Student creation request was rate limited."
      );
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
    logWarnEvent(
      "student.create.duplicate_login",
      getHeadersLogContext(requestHeaders, {
        teacherId: teacher.id,
        studentLogin: login
      }),
      undefined,
      "Student creation was skipped because the login already exists."
    );
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
    logErrorEvent(
      "student.create.failed",
      {
        teacherId: teacher.id,
        clientIp,
        studentLogin: login,
        studentName: name
      },
      error,
      "Failed to create student account."
    );
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "save" }));
  }

  logInfoEvent(
    "student.create.succeeded",
    {
      teacherId: teacher.id,
      clientIp,
      studentLogin: login,
      studentName: name
    },
    "Student account was created."
  );
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
  const teacher = await requireUser(UserRole.TEACHER);

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
    logWarnEvent(
      "student.delete.missing",
      {
        teacherId: teacher.id,
        studentId
      },
      undefined,
      "Student deletion was skipped because the student was not found."
    );
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "deleteMissing" }));
  }

  try {
    await prisma.user.delete({
      where: {
        id: studentId
      }
    });
  } catch (error) {
    logErrorEvent(
      "student.delete.failed",
      { teacherId: teacher.id, studentId },
      error,
      "Failed to delete student account."
    );
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "delete" }));
  }

  logInfoEvent(
    "student.delete.succeeded",
    {
      teacherId: teacher.id,
      studentId
    },
    "Student account was deleted."
  );
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
