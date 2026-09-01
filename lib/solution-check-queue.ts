import { runLessonItemCheck } from "@/lib/lesson-item-check";
import { logErrorEvent } from "@/lib/logger";
import { runHomeworkCheck } from "@/lib/solution-check";

// Общая последовательная очередь ИИ-проверок: пачечные проверки ДЗ и
// по-номерные сдачи классной работы. Задача несёт kind — как в lesson-plan-queue.
type CheckTask = { kind: "HOMEWORK"; id: string } | { kind: "LESSON_ITEM"; id: string };

declare global {
  var __homeworkCheckQueue__: CheckTask[] | undefined;
  var __homeworkCheckQueueRunning__: boolean | undefined;
}

const queue = global.__homeworkCheckQueue__ ?? [];
global.__homeworkCheckQueue__ = queue;

async function drainQueue() {
  if (global.__homeworkCheckQueueRunning__) {
    return;
  }

  global.__homeworkCheckQueueRunning__ = true;

  try {
    for (;;) {
      const task = queue.shift();

      if (!task) {
        break;
      }

      try {
        if (task.kind === "LESSON_ITEM") {
          await runLessonItemCheck(task.id);
        } else {
          await runHomeworkCheck(task.id);
        }
      } catch (error) {
        logErrorEvent(
          "solution.check.queue_failed",
          { checkId: task.id, kind: task.kind },
          error,
          "Solution check crashed in queue."
        );
      }
    }
  } finally {
    global.__homeworkCheckQueueRunning__ = false;
  }
}

/** Длина общей очереди (без выполняющейся задачи) — потолок в POST-роутах. */
export function getHomeworkCheckQueueLength() {
  return queue.length;
}

export function enqueueHomeworkCheck(checkId: string) {
  queue.push({ kind: "HOMEWORK", id: checkId });
  void drainQueue();
}

export function enqueueLessonItemCheck(submissionId: string) {
  queue.push({ kind: "LESSON_ITEM", id: submissionId });
  void drainQueue();
}
