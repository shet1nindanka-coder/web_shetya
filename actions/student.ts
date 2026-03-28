"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function redirectTeacherWithStudentStatus(params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `/teacher/students?${query}` : "/teacher/students");
}

export async function createStudentAction(formData: FormData) {
  await requireUser(UserRole.TEACHER);

  const name = String(formData.get("name") ?? "").trim();
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !login || password.trim().length < 8) {
    redirectTeacherWithStudentStatus(new URLSearchParams({ studentError: "invalid" }));
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

  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  redirectTeacherWithStudentStatus(new URLSearchParams({ studentCreated: "1" }));
}
