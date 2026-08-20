import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import {
  homeworkAttentionRank,
  isAttentionHomeworkCompleted,
  sortHomeworksByAttention
} from "../lib/homework-attention";

const NOW = Date.parse("2026-08-20T12:00:00+03:00");
const HOUR = 60 * 60 * 1000;

function hw(overrides: {
  createdAt?: string;
  deadlineAt?: string | null;
  statuses?: Array<HomeworkNumberStatus | null>;
  latestCheck?: { status: string; results: Array<{ verdict: string }> } | null;
}) {
  return {
    createdAt: overrides.createdAt ?? "2026-08-01T10:00:00+03:00",
    deadlineAt: overrides.deadlineAt ?? null,
    numbers: (overrides.statuses ?? [null]).map((status) => ({ status })),
    latestCheck: overrides.latestCheck ?? null
  };
}

test("isAttentionHomeworkCompleted: выполнено = все номера зелёные или жёлтые", () => {
  assert.equal(
    isAttentionHomeworkCompleted(hw({ statuses: [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW] })),
    true
  );
  assert.equal(isAttentionHomeworkCompleted(hw({ statuses: [HomeworkNumberStatus.GREEN, null] })), false);
  assert.equal(
    isAttentionHomeworkCompleted(hw({ statuses: [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.RED] })),
    false
  );
  assert.equal(isAttentionHomeworkCompleted(hw({ statuses: [] })), false);
});

test("homeworkAttentionRank: просроченное выше всего, выполненное — в самом низу", () => {
  const overdue = hw({ deadlineAt: new Date(NOW - HOUR).toISOString() });
  const completed = hw({
    deadlineAt: new Date(NOW - HOUR).toISOString(),
    statuses: [HomeworkNumberStatus.GREEN]
  });

  assert.equal(homeworkAttentionRank(overdue, NOW), 0);
  assert.equal(homeworkAttentionRank(completed, NOW), 5);
});

test("homeworkAttentionRank: вердикты UNCERTAIN выше неотмеченных, срок скоро выше остального", () => {
  const uncertain = hw({
    statuses: [HomeworkNumberStatus.GREEN, null],
    latestCheck: { status: "DONE", results: [{ verdict: "CORRECT" }, { verdict: "UNCERTAIN" }] }
  });
  const unmarked = hw({ statuses: [HomeworkNumberStatus.GREEN, null] });
  const soon = hw({
    statuses: [HomeworkNumberStatus.RED],
    deadlineAt: new Date(NOW + 24 * HOUR).toISOString()
  });
  const rest = hw({
    statuses: [HomeworkNumberStatus.RED],
    deadlineAt: new Date(NOW + 240 * HOUR).toISOString()
  });

  assert.equal(homeworkAttentionRank(uncertain, NOW), 1);
  assert.equal(homeworkAttentionRank(unmarked, NOW), 2);
  assert.equal(homeworkAttentionRank(soon, NOW), 3);
  assert.equal(homeworkAttentionRank(rest, NOW), 4);
});

test("sortHomeworksByAttention: просроченное поднимается выше выполненного и свежесозданного", () => {
  const completedFresh = hw({
    createdAt: "2026-08-19T10:00:00+03:00",
    deadlineAt: new Date(NOW + HOUR).toISOString(),
    statuses: [HomeworkNumberStatus.GREEN]
  });
  const overdueOld = hw({
    createdAt: "2026-08-01T10:00:00+03:00",
    deadlineAt: new Date(NOW - 2 * HOUR).toISOString(),
    statuses: [null, HomeworkNumberStatus.RED]
  });
  const plain = hw({ createdAt: "2026-08-10T10:00:00+03:00", statuses: [null] });

  const sorted = sortHomeworksByAttention([completedFresh, plain, overdueOld], NOW);

  assert.deepEqual(sorted, [overdueOld, plain, completedFresh]);
});

test("sortHomeworksByAttention: внутри ранга — ближайший дедлайн первым, без дедлайна — последним", () => {
  const far = hw({ statuses: [null], deadlineAt: new Date(NOW + 200 * HOUR).toISOString() });
  const near = hw({ statuses: [null], deadlineAt: new Date(NOW + 100 * HOUR).toISOString() });
  const none = hw({ statuses: [null], deadlineAt: null });

  const sorted = sortHomeworksByAttention([none, far, near], NOW);

  assert.deepEqual(sorted, [near, far, none]);
});

test("sortHomeworksByAttention: не мутирует входной массив", () => {
  const list = [hw({ statuses: [null] }), hw({ statuses: [HomeworkNumberStatus.GREEN] })];
  const copy = [...list];

  sortHomeworksByAttention(list, NOW);

  assert.deepEqual(list, copy);
});
