import { logErrorEvent } from "@/lib/logger";
import { runHomeworkCheck } from "@/lib/solution-check";

declare global {
  var __homeworkCheckQueue__: string[] | undefined;
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
      const checkId = queue.shift();

      if (!checkId) {
        break;
      }

      try {
        await runHomeworkCheck(checkId);
      } catch (error) {
        logErrorEvent("solution.check.queue_failed", { checkId }, error, "Homework check crashed in queue.");
      }
    }
  } finally {
    global.__homeworkCheckQueueRunning__ = false;
  }
}

export function getHomeworkCheckQueueLength() {
  return queue.length;
}

export function enqueueHomeworkCheck(checkId: string) {
  queue.push(checkId);
  void drainQueue();
}
