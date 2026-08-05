"use server";

import { Subject, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { normalizeSingleLineText } from "@/lib/utils";

const MAX_GROUP_NAME_LENGTH = 120;
const MAX_AI_NOTE_LENGTH = 300;
const MIN_SPEED = 1;
const MAX_SPEED = 10;

function groupsBasePath(role: UserRole) {
  return role === UserRole.DEVELOPER ? "/developer/groups" : "/teacher/groups";
}

function revalidateGroupRoutes(groupId?: string) {
  revalidateTeacherStudentsData();
  revalidatePath("/teacher/groups");

  if (groupId) {
    revalidatePath(`/teacher/groups/${groupId}`);
  }
}

/** Группа доступна владельцу; разработчик видит все. */
async function findAccessibleGroup(groupId: string, user: { id: string; role: UserRole }) {
  return prisma.studentGroup.findFirst({
    where: {
      id: groupId,
      ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
    },
    select: { id: true, name: true }
  });
}

export async function createGroupAction(formData: FormData) {
  // Группы создаёт только преподаватель: у разработчика вкладки «группы» нет,
  // и завести группу на своё имя он не должен.
  const user = await requireUser(UserRole.TEACHER);
  const base = groupsBasePath(user.role);

  const name = normalizeSingleLineText(String(formData.get("name") ?? "")).slice(0, MAX_GROUP_NAME_LENGTH);
  const subjectRaw = String(formData.get("subject") ?? "MATH");
  const subject = subjectRaw === "INFORMATICS" ? Subject.INFORMATICS : Subject.MATH;
  const gradeRaw = String(formData.get("grade") ?? "").trim();
  const gradeParsed = gradeRaw === "" ? null : Number(gradeRaw);
  const grade = gradeParsed !== null && Number.isInteger(gradeParsed) && gradeParsed >= 1 && gradeParsed <= 11
    ? gradeParsed
    : null;

  if (!name) {
    redirect(`${base}?groupError=invalid`);
  }

  try {
    const group = await prisma.studentGroup.create({
      data: { name, subject, grade, teacherId: user.id },
      select: { id: true }
    });
    logInfoEvent("group.created", { userId: user.id, groupId: group.id });
    revalidateGroupRoutes(group.id);
    redirect(`${base}/${group.id}?groupCreated=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error; // NEXT_REDIRECT
    }

    logErrorEvent(
      "group.create.failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to create student group."
    );
    redirect(`${base}?groupError=save`);
  }
}

export async function renameGroupAction(formData: FormData) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const base = groupsBasePath(user.role);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const name = normalizeSingleLineText(String(formData.get("name") ?? "")).slice(0, MAX_GROUP_NAME_LENGTH);

  if (!groupId || !name) {
    redirect(`${base}?groupError=invalid`);
  }

  const group = await findAccessibleGroup(groupId, user);

  if (!group) {
    redirect(`${base}?groupError=missing`);
  }

  try {
    await prisma.studentGroup.update({ where: { id: group.id }, data: { name } });
    logInfoEvent("group.renamed", { userId: user.id, groupId: group.id });
  } catch (error) {
    logErrorEvent(
      "group.rename.failed",
      { userId: user.id, groupId: group.id },
      error instanceof Error ? error : undefined,
      "Failed to rename student group."
    );
    redirect(`${base}/${group.id}?groupError=save`);
  }

  revalidateGroupRoutes(group.id);
  redirect(`${base}/${group.id}?groupSaved=1`);
}

export async function deleteGroupAction(formData: FormData) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const base = groupsBasePath(user.role);
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!groupId) {
    redirect(`${base}?groupError=invalid`);
  }

  const group = await findAccessibleGroup(groupId, user);

  if (!group) {
    redirect(`${base}?groupError=missing`);
  }

  try {
    // Ученики не удаляются: StudentProfile.groupId сбрасывается через onDelete: SetNull.
    await prisma.studentGroup.delete({ where: { id: group.id } });
    logInfoEvent("group.deleted", { userId: user.id, groupId: group.id });
  } catch (error) {
    logErrorEvent(
      "group.delete.failed",
      { userId: user.id, groupId: group.id },
      error instanceof Error ? error : undefined,
      "Failed to delete student group."
    );
    redirect(`${base}?groupError=save`);
  }

  revalidateGroupRoutes(group.id);
  redirect(`${base}?groupDeleted=1`);
}

/** Мгновенное добавление в группу — вызывается с клиента, возвращает результат. */
export async function addGroupMemberAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!groupId || !studentId) {
    return { ok: false, message: "Проверьте данные." };
  }

  const group = await findAccessibleGroup(groupId, user);

  if (!group) {
    return { ok: false, message: "Группа не найдена." };
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: UserRole.STUDENT },
    select: { id: true }
  });

  if (!student) {
    return { ok: false, message: "Ученик не найден." };
  }

  try {
    // Ученик состоит максимум в одной группе: upsert просто переводит его сюда.
    await prisma.studentProfile.upsert({
      where: { userId: student.id },
      create: { userId: student.id, groupId: group.id },
      update: { groupId: group.id }
    });
    logInfoEvent("group.member_added", { userId: user.id, groupId: group.id, studentId: student.id });
    revalidateGroupRoutes(group.id);
    return { ok: true, message: "Сохранено" };
  } catch (error) {
    logErrorEvent(
      "group.member_add.failed",
      { userId: user.id, groupId: group.id, studentId: student.id },
      error instanceof Error ? error : undefined,
      "Failed to add group member."
    );
    return { ok: false, message: "Не удалось добавить." };
  }
}

/** Мгновенное удаление из группы. Ученик и его прогресс не удаляются. */
export async function removeGroupMemberAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!groupId || !studentId) {
    return { ok: false, message: "Проверьте данные." };
  }

  const group = await findAccessibleGroup(groupId, user);

  if (!group) {
    return { ok: false, message: "Группа не найдена." };
  }

  try {
    await prisma.studentProfile.updateMany({
      where: { userId: studentId, groupId: group.id },
      data: { groupId: null }
    });
    logInfoEvent("group.member_removed", { userId: user.id, groupId: group.id, studentId });
    revalidateGroupRoutes(group.id);
    return { ok: true, message: "Сохранено" };
  } catch (error) {
    logErrorEvent(
      "group.member_remove.failed",
      { userId: user.id, groupId: group.id, studentId },
      error instanceof Error ? error : undefined,
      "Failed to remove group member."
    );
    return { ok: false, message: "Не удалось убрать." };
  }
}

/**
 * Автосохранение скорости и заметки для ИИ — вызывается с клиента,
 * поэтому возвращает результат вместо redirect.
 */
export async function setStudentAiProfileAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const studentId = String(formData.get("studentId") ?? "").trim();
  const speedRaw = String(formData.get("speed") ?? "").trim();
  const speedParsed = speedRaw === "" ? null : Number(speedRaw);
  const speed =
    speedParsed !== null && Number.isInteger(speedParsed) && speedParsed >= MIN_SPEED && speedParsed <= MAX_SPEED
      ? speedParsed
      : null;
  const aiNote = normalizeSingleLineText(String(formData.get("aiNote") ?? "")).slice(0, MAX_AI_NOTE_LENGTH) || null;

  if (!studentId) {
    return { ok: false, message: "Ученик не найден." };
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: UserRole.STUDENT },
    select: { id: true }
  });

  if (!student) {
    return { ok: false, message: "Ученик не найден." };
  }

  try {
    await prisma.studentProfile.upsert({
      where: { userId: student.id },
      create: { userId: student.id, speed, aiNote },
      update: { speed, aiNote }
    });
    revalidateGroupRoutes();
    return { ok: true, message: "Сохранено" };
  } catch (error) {
    logErrorEvent(
      "group.ai_profile.failed",
      { userId: user.id, studentId: student.id },
      error instanceof Error ? error : undefined,
      "Failed to save student AI profile."
    );
    return { ok: false, message: "Не удалось сохранить." };
  }
}
