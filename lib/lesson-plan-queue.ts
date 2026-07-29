import { generateHomeworkPlanForParticipant } from "@/lib/homework-plan-generate";
import { generateLessonPlanForParticipant } from "@/lib/lesson-plan-generate";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

/*
 * Очередь генерации планов урока. Живёт в памяти одного инстанса (как очередь
 * автопроверки) и теряется при рестарте: участник без planGeneratedAt и без
 * planError дольше 15 минут считается зависшим — UI предлагает «Повторить».
 */

export type PlanKind = "LESSON" | "HOMEWORK";

type LessonPlanTask = {
  lessonId: string;
  participantId: string;
  kind: PlanKind;
};

declare global {
  var __lessonPlanQueue__: LessonPlanTask[] | undefined;
  var __lessonPlanQueueActive__: number | undefined;
  var __lessonPlanResumeDone__: boolean | undefined;
}

const queue = global.__lessonPlanQueue__ ?? [];
global.__lessonPlanQueue__ = queue;

function getActiveCount() {
  return global.__lessonPlanQueueActive__ ?? 0;
}

async function drainQueue() {
  let concurrency = 3;

  try {
    concurrency = (await getSiteSettingsUncached()).lessonPlanConcurrency;
  } catch {
    // Настройки недоступны — работаем с дефолтом.
  }

  while (getActiveCount() < concurrency) {
    const task = queue.shift();

    if (!task) {
      break;
    }

    global.__lessonPlanQueueActive__ = getActiveCount() + 1;

    void (async () => {
      try {
        if (task.kind === "HOMEWORK") {
          await generateHomeworkPlanForParticipant(task.lessonId, task.participantId);
        } else {
          await generateLessonPlanForParticipant(task.lessonId, task.participantId);
        }
      } catch (error) {
        // generateLessonPlanForParticipant сам пишет planError; это страховка.
        logErrorEvent(
          "lesson_plan.queue_failed",
          { lessonId: task.lessonId, participantId: task.participantId },
          error instanceof Error ? error : undefined,
          "Lesson plan task crashed in queue."
        );
      } finally {
        global.__lessonPlanQueueActive__ = Math.max(0, getActiveCount() - 1);
        void drainQueue();
      }
    })();
  }
}

export function getLessonPlanQueueLength() {
  return queue.length + getActiveCount();
}

export function enqueueLessonPlan(lessonId: string, participantIds: string[], kind: PlanKind = "LESSON") {
  for (const participantId of participantIds) {
    queue.push({ lessonId, participantId, kind });
  }

  void drainQueue();
}

// Окно поиска зависших: свежее двух минут ещё может обрабатываться живым
// процессом, старше суток — сознательно не трогаем (там кнопка «Повторить»).
const RESUME_MIN_AGE_MS = 2 * 60_000;
const RESUME_MAX_AGE_MS = 24 * 60 * 60_000;

/**
 * Авто-возобновление после рестарта: участники, чья генерация оборвалась вместе
 * с процессом (нет ни плана, ни ошибки, ДЗ не выдано), снова ставятся в очередь.
 * Выполняется РОВНО один раз за жизнь инстанса — лимит одной повторной попытки,
 * потому что генерация дорогая: если и вторая попытка упадёт, planError покажет
 * учителю кнопку «Повторить», дальше решает человек.
 */
export async function resumeStaleLessonPlans() {
  if (global.__lessonPlanResumeDone__) {
    return;
  }

  global.__lessonPlanResumeDone__ = true;

  try {
    const now = Date.now();
    const stale = await prisma.lessonParticipant.findMany({
      where: {
        planGeneratedAt: null,
        planError: null,
        issuedAssignmentId: null,
        updatedAt: {
          gte: new Date(now - RESUME_MAX_AGE_MS),
          lte: new Date(now - RESUME_MIN_AGE_MS)
        }
      },
      select: { id: true, lessonId: true, lesson: { select: { kind: true } } }
    });

    if (stale.length === 0) {
      return;
    }

    logInfoEvent(
      "lesson_plan.resume.enqueued",
      { count: stale.length },
      "Resuming lesson plan generations interrupted by a restart."
    );

    for (const participant of stale) {
      queue.push({
        lessonId: participant.lessonId,
        participantId: participant.id,
        kind: participant.lesson.kind === "HOMEWORK" ? "HOMEWORK" : "LESSON"
      });
    }

    void drainQueue();
  } catch (error) {
    logErrorEvent(
      "lesson_plan.resume.failed",
      {},
      error instanceof Error ? error : undefined,
      "Failed to resume stale lesson plan generations."
    );
  }
}
