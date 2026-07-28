import { generateLessonPlanForParticipant } from "@/lib/lesson-plan-generate";
import { logErrorEvent } from "@/lib/logger";
import { getSiteSettingsUncached } from "@/lib/site-settings";

/*
 * Очередь генерации планов урока. Живёт в памяти одного инстанса (как очередь
 * автопроверки) и теряется при рестарте: участник без planGeneratedAt и без
 * planError дольше 15 минут считается зависшим — UI предлагает «Повторить».
 */

type LessonPlanTask = {
  lessonId: string;
  participantId: string;
};

declare global {
  var __lessonPlanQueue__: LessonPlanTask[] | undefined;
  var __lessonPlanQueueActive__: number | undefined;
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
        await generateLessonPlanForParticipant(task.lessonId, task.participantId);
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

export function enqueueLessonPlan(lessonId: string, participantIds: string[]) {
  for (const participantId of participantIds) {
    queue.push({ lessonId, participantId });
  }

  void drainQueue();
}
