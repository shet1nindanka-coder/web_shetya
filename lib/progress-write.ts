import { AuditCategory, Prisma, type ProgressStatusEvent, type UserRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { logInfoEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  decideProgressChange, progressStatusLabel, PROGRESS_DECISION_LABELS, PROGRESS_SOURCE_LABELS,
  type ProgressIntent, type ProgressSource, type ProgressDecisionReason
} from "@/lib/progress-policy";

export type ProgressReferences = {
  lessonId?: string;
  itemId?: string;
  assignmentId?: string;
  checkId?: string;
  submissionId?: string;
};

export type ProgressChangeInput = ProgressIntent & {
  studentId: string;
  homeworkNumberId: string;
  actor?: { id: string; name: string; role: UserRole };
  references?: ProgressReferences;
};

/** Только внутри runProgressTransaction: статус и история коммитятся вместе. */
export function createProgressWriter(tx: Prisma.TransactionClient, events: ProgressStatusEvent[]) {
  return async (input: ProgressChangeInput) => {
    const key = { studentId: input.studentId, homeworkNumberId: input.homeworkNumberId };
    const current = await tx.studentTopicNumberStatus.findUnique({ where: { studentId_homeworkNumberId: key } });
    const decision = decideProgressChange(current, input);
    const recordedAt = new Date();

    if (decision.write) {
      await tx.studentTopicNumberStatus.upsert({
        where: { studentId_homeworkNumberId: key },
        update: { status: decision.status, statusChangedAt: recordedAt },
        create: { ...key, status: decision.status, statusChangedAt: recordedAt }
      });
    }

    const event = await tx.progressStatusEvent.create({
      data: {
        ...key,
        createdAt: recordedAt,
        source: input.source,
        previousStatus: current?.status ?? null,
        requestedStatus: decision.requestedStatus,
        status: decision.status,
        decision: decision.reason,
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? null,
        actorRole: input.actor?.role ?? null,
        context: {
          ...input.references,
          ...("verdict" in input ? { verdict: input.verdict } : {}),
          ...("result" in input ? { lessonResult: input.result } : {}),
          ...(input.source === "homework_check" ? { checkStartedAt: input.checkStartedAt.toISOString() } : {})
        }
      }
    });
    events.push(event);
    return decision;
  };
}

export type ProgressWriter = ReturnType<typeof createProgressWriter>;

async function publishProgressEvent(event: ProgressStatusEvent) {
  const summary = `${PROGRESS_SOURCE_LABELS[event.source as ProgressSource]}: ${progressStatusLabel(event.previousStatus)} → ${progressStatusLabel(event.status)}. ${PROGRESS_DECISION_LABELS[event.decision as ProgressDecisionReason]}`;
  const context = {
    eventId: event.id,
    studentId: event.studentId,
    homeworkNumberId: event.homeworkNumberId,
    source: event.source,
    actorId: event.actorId,
    previousStatus: event.previousStatus,
    requestedStatus: event.requestedStatus,
    status: event.status,
    decision: event.decision,
    references: event.context
  };
  // Только после commit. Имена, заметки и содержимое решений в pino не отправляем.
  logInfoEvent("progress.status.recorded", { progress: context }, summary);
  await writeAuditLog({
    category: AuditCategory.DATA,
    action: "progress.status",
    actorId: event.actorId,
    actorName: event.actorName ?? (event.source === "lesson_end" ? "Автозавершение урока" : "Автопроверка"),
    actorRole: event.actorRole,
    targetType: "ProgressStatusEvent",
    targetId: event.id,
    summary,
    meta: context
  });
}

/**
 * Общая граница записи прогресса. Serializable + retry защищают previousStatus
 * и решения о приоритете от одновременной ручной правки/автопроверки.
 * work содержит только операции БД: внешние вызовы и уведомления — после него.
 * История обязательна и атомарна; дублирование в общий журнал — best effort.
 */
export async function runProgressTransaction<T>(
  work: (tx: Prisma.TransactionClient, writeProgress: ProgressWriter) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const events: ProgressStatusEvent[] = [];
    let result: T;
    try {
      result = await prisma.$transaction(
        (tx) => work(tx, createProgressWriter(tx, events)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }
      );
    } catch (error) {
      if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
        continue;
      }
      throw error;
    }
    for (const event of events) await publishProgressEvent(event);
    return result;
  }
}
