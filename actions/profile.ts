"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-monitoring";
import { roleHome } from "@/lib/utils";

function redirectAccountWithStatus(role: UserRole, params: URLSearchParams) {
  const basePath = `${roleHome(role)}/settings`;
  const query = params.toString();
  redirect(query ? `${basePath}?${query}` : basePath);
}

function revalidateAccountRoutes(role: UserRole) {
  revalidateAllPlatformData();
  const homePath = roleHome(role);

  revalidatePath("/dashboard");
  revalidatePath(homePath);
  revalidatePath(`${homePath}/account`);
  revalidatePath(`${homePath}/settings`);

  if (role === UserRole.TEACHER) {
    revalidatePath("/teacher/topics");
    revalidatePath("/teacher/students");
    return;
  }

  revalidatePath("/student/topics");
  revalidatePath("/student/info");
}

export async function updateProfileInfoAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirectAccountWithStatus(user.role, new URLSearchParams({ infoError: "invalid" }));
  }

  try {
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        name
      }
    });
  } catch (error) {
    reportServerError("Failed to update profile info.", { userId: user.id, role: user.role }, error);
    redirectAccountWithStatus(user.role, new URLSearchParams({ infoError: "save" }));
  }

  revalidateAccountRoutes(user.role);
  redirectAccountWithStatus(user.role, new URLSearchParams({ infoUpdated: "1" }));
}

export async function updatePasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || newPassword.trim().length < 8 || confirmPassword.trim().length < 8) {
    redirectAccountWithStatus(user.role, new URLSearchParams({ passwordError: "invalid" }));
  }

  if (newPassword !== confirmPassword) {
    redirectAccountWithStatus(user.role, new URLSearchParams({ passwordError: "mismatch" }));
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: user.id
    },
    select: {
      passwordHash: true
    }
  });

  const isCurrentPasswordValid = currentUser
    ? await verifyPassword(currentPassword, currentUser.passwordHash)
    : false;

  if (!isCurrentPasswordValid) {
    redirectAccountWithStatus(user.role, new URLSearchParams({ passwordError: "current" }));
  }

  try {
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash
      }
    });
  } catch (error) {
    reportServerError("Failed to update password.", { userId: user.id, role: user.role }, error);
    redirectAccountWithStatus(user.role, new URLSearchParams({ passwordError: "save" }));
  }

  revalidateAccountRoutes(user.role);
  redirectAccountWithStatus(user.role, new URLSearchParams({ passwordUpdated: "1" }));
}
