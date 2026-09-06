import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PROGRESS_DECISION_LABELS, PROGRESS_SOURCE_LABELS, progressStatusLabel,
  type ProgressDecisionReason, type ProgressSource
} from "@/lib/progress-policy";

const PAGE_SIZE = 20;

export async function getProgressHistory(
  viewer: { id: string; role: UserRole }, studentId: string, homeworkNumberId: string, cursor?: string
) {
  if (viewer.role !== UserRole.TEACHER && viewer.role !== UserRole.DEVELOPER) return null;
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: UserRole.STUDENT, ...(viewer.role === UserRole.TEACHER ? { teacherId: viewer.id } : {}) },
    select: { name: true }
  });
  if (!student) return null;
  const number = await prisma.topicHomeworkNumber.findUnique({
    where: { id: homeworkNumberId }, select: { number: true, topic: { select: { title: true } } }
  });
  if (!number) return null;
  const scope = { studentId, homeworkNumberId };
  const before = cursor ? await prisma.progressStatusEvent.findFirst({
    where: { ...scope, id: cursor }, select: { createdAt: true, id: true }
  }) : null;
  if (cursor && !before) return null;

  const [current, rows] = await Promise.all([
    prisma.studentTopicNumberStatus.findUnique({ where: { studentId_homeworkNumberId: scope }, select: { status: true } }),
    prisma.progressStatusEvent.findMany({
      where: {
        ...scope,
        ...(before ? { OR: [
          { createdAt: { lt: before.createdAt } },
          { createdAt: before.createdAt, id: { lt: before.id } }
        ] } : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1
    })
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  const contextOf = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const contexts = page.map((row) => contextOf(row.context));
  const ids = (field: string) => contexts.flatMap((context) => typeof context[field] === "string" ? [context[field] as string] : []);
  const [lessons, assignments] = await Promise.all([
    prisma.lesson.findMany({
      where: { id: { in: ids("lessonId") }, participants: { some: { studentId } }, ...(viewer.role === UserRole.TEACHER ? { teacherId: viewer.id } : {}) },
      select: { id: true }
    }),
    prisma.homeworkAssignment.findMany({ where: { id: { in: ids("assignmentId") }, studentId }, select: { id: true } })
  ]);
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const prefix = viewer.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  return {
    studentName: student.name,
    number: number.number,
    topicTitle: number.topic.title,
    currentStatus: progressStatusLabel(current?.status ?? null),
    entries: page.map((row) => {
      const context = contextOf(row.context);
      const lessonId = typeof context.lessonId === "string" ? context.lessonId : null;
      const assignmentId = typeof context.assignmentId === "string" ? context.assignmentId : null;
      return {
        id: row.id, createdAt: row.createdAt.toISOString(),
        source: PROGRESS_SOURCE_LABELS[row.source as ProgressSource] ?? row.source,
        actor: row.actorName ?? (row.source === "lesson_end" ? "Система" : "ИИ"),
        previousStatus: progressStatusLabel(row.previousStatus), status: progressStatusLabel(row.status),
        reason: PROGRESS_DECISION_LABELS[row.decision as ProgressDecisionReason] ?? row.decision,
        reference: lessonId && lessonIds.has(lessonId)
          ? { label: "Открыть урок", href: `${prefix}/lessons/${encodeURIComponent(lessonId)}` }
          : assignmentId && assignmentIds.has(assignmentId) && viewer.role === UserRole.TEACHER
            ? { label: "Открыть ДЗ", href: `/teacher/students/${encodeURIComponent(studentId)}#homework-${encodeURIComponent(assignmentId)}` }
            : null
      };
    }),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null
  };
}

export type ProgressHistoryData = NonNullable<Awaited<ReturnType<typeof getProgressHistory>>>;
