import test from "node:test";
import assert from "node:assert/strict";
import { collectAvailableNumbers } from "../lib/lesson-plan";
import {
  daysUntil,
  MAX_HOMEWORK_DAYS,
  normalizeHomeworkParams,
  pickDominantTopicId
} from "../lib/homework-plan";

test("daysUntil is an integer with a minimum of 1 and a maximum clamp", () => {
  const now = new Date("2026-07-28T10:00:00+03:00");

  assert.equal(daysUntil(new Date("2026-07-28T18:00:00+03:00"), now), 1);
  assert.equal(daysUntil(new Date("2026-07-29T09:00:00+03:00"), now), 1);
  assert.equal(daysUntil(new Date("2026-07-29T11:00:00+03:00"), now), 2);
  assert.equal(daysUntil(new Date("2026-08-07T10:00:00+03:00"), now), 10);
  assert.equal(daysUntil(new Date("2027-07-28T10:00:00+03:00"), now), MAX_HOMEWORK_DAYS);
  assert.equal(daysUntil(new Date("2026-07-27T10:00:00+03:00"), now), 1);
});

test("normalizeHomeworkParams requires a topic and a future deadline", () => {
  const now = new Date("2026-07-28T10:00:00+03:00");
  const future = "2026-07-30T18:00:00+03:00";

  assert.equal(normalizeHomeworkParams(null, now), null);
  assert.equal(normalizeHomeworkParams({ deadlineAt: future }, now), null);
  assert.equal(normalizeHomeworkParams({ topicId: "t1", deadlineAt: "2026-07-27T10:00:00+03:00" }, now), null);
  assert.equal(normalizeHomeworkParams({ topicId: "t1", deadlineAt: "мусор" }, now), null);

  const params = normalizeHomeworkParams(
    {
      topicId: " t1 ",
      deadlineAt: future,
      title: "t".repeat(500),
      teacherNote: "n".repeat(1000),
      sourceLessonId: " lesson-1 "
    },
    now
  );

  assert.ok(params);
  assert.equal(params?.topicId, "t1");
  assert.equal(params?.title.length, 200);
  assert.equal(params?.teacherNote.length, 500);
  assert.equal(params?.sourceLessonId, "lesson-1");
});

test("normalizeHomeworkParams clamps dailyMinutes", () => {
  const now = new Date("2026-07-28T10:00:00+03:00");

  const clamped = normalizeHomeworkParams(
    { topicId: "t1", deadlineAt: "2026-08-07T10:00:00+03:00", dailyMinutes: 999 },
    now
  );

  assert.equal(clamped?.dailyMinutes, 240);

  const low = normalizeHomeworkParams(
    { topicId: "t1", deadlineAt: "2026-08-07T10:00:00+03:00", dailyMinutes: 1 },
    now
  );

  assert.equal(low?.dailyMinutes, 15);
});

test("normalizeHomeworkParams defaults dailyMinutes to 60", () => {
  const now = new Date("2026-07-28T10:00:00+03:00");

  assert.equal(
    normalizeHomeworkParams({ topicId: "t1", deadlineAt: "2026-08-07T10:00:00+03:00" }, now)?.dailyMinutes,
    60
  );
});

test("pickDominantTopicId picks the majority with a deterministic tie-break", () => {
  assert.equal(pickDominantTopicId([]), null);
  assert.equal(
    pickDominantTopicId([{ topicId: "a" }, { topicId: "b" }, { topicId: "b" }]),
    "b"
  );
  // Равенство: первая по порядку появления.
  assert.equal(
    pickDominantTopicId([{ topicId: "a" }, { topicId: "b" }, { topicId: "a" }, { topicId: "b" }]),
    "a"
  );
});

test("candidate pool is limited to the single homework topic", () => {
  const number = (id: string, n: number) =>
    ({
      id,
      number: n,
      displayOrder: n,
      difficulty: null,
      estimatedMinutes: null,
      conditionLatex: null,
      status: null,
      note: null,
      deadlineAt: null,
      statusChangedAt: null
    }) as never;

  const context = {
    topics: [
      { id: "t1", title: "Тема 1", displayOrder: 1, numbers: [number("n1", 1), number("n2", 2)] },
      { id: "t2", title: "Тема 2", displayOrder: 2, numbers: [number("n3", 3)] }
    ],
    excludedNumberIds: ["n2"]
  };

  const available = collectAvailableNumbers(context, { topicIds: ["t1"] });

  assert.deepEqual(
    available.map((entry) => entry.id),
    ["n1"]
  );
});
