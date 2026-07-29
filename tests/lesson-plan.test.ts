import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAvailableNumbers,
  MAX_PLAN_ITEMS,
  MAX_SHORTLIST,
  normalizePlanParams,
  normalizeSpeed,
  parseLessonPlanResponse,
  parseShortlistResponse
} from "../lib/lesson-plan";

function buildNumber(id: string, number: number, displayOrder: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    number,
    displayOrder,
    difficulty: null,
    estimatedMinutes: null,
    conditionLatex: null,
    status: null,
    note: null,
    deadlineAt: null,
    statusChangedAt: null,
    assignedBefore: false,
    ...extra
  } as never;
}

const context = {
  topics: [
    {
      id: "topic-b",
      title: "Тема Б",
      displayOrder: 2,
      numbers: [buildNumber("n3", 30, 1), buildNumber("n4", 40, 2)]
    },
    {
      id: "topic-a",
      title: "Тема А",
      displayOrder: 1,
      numbers: [
        buildNumber("n2", 20, 2),
        buildNumber("n1", 10, 1, { status: "GREEN", statusChangedAt: new Date() })
      ]
    }
  ],
  excludedNumberIds: [] as string[]
};

test("collectAvailableNumbers excludes lesson/homework numbers and filters topics", () => {
  const withExclusions = { ...context, excludedNumberIds: ["n1", "n4"] };

  const available = collectAvailableNumbers(withExclusions, {});

  assert.deepEqual(
    available.map((entry) => entry.id),
    ["n2", "n3"]
  );

  const filtered = collectAvailableNumbers(context, { topicIds: ["topic-b"] });

  assert.deepEqual(
    filtered.map((entry) => entry.id),
    ["n3", "n4"]
  );
});

test("collectAvailableNumbers is neutral: green exclusion is the context builder's job (excludedNumberIds)", () => {
  // Сама чистая функция GREEN не фильтрует — getLessonPlanContext кладёт решённые
  // номера в excludedNumberIds, и они отсеиваются как любые другие исключения.
  const available = collectAvailableNumbers(context, {});

  assert.ok(available.some((entry) => entry.id === "n1" && entry.status === "GREEN"));

  const withGreenExcluded = { ...context, excludedNumberIds: ["n1"] };

  assert.ok(!collectAvailableNumbers(withGreenExcluded, {}).some((entry) => entry.id === "n1"));
});

test("collectAvailableNumbers passes assignedBefore through", () => {
  const withFlag = {
    ...context,
    topics: [
      {
        id: "topic-c",
        title: "Тема В",
        displayOrder: 3,
        numbers: [buildNumber("n5", 50, 1, { assignedBefore: true }), buildNumber("n6", 60, 2)]
      }
    ]
  };

  const available = collectAvailableNumbers(withFlag, { topicIds: ["topic-c"] });

  assert.deepEqual(
    available.map((entry) => [entry.id, entry.assignedBefore]),
    [
      ["n5", true],
      ["n6", false]
    ]
  );
});

test("collectAvailableNumbers has stable neutral order: topic order, then number order", () => {
  const available = collectAvailableNumbers(context, {});

  assert.deepEqual(
    available.map((entry) => entry.id),
    ["n1", "n2", "n3", "n4"]
  );
});

test("parseShortlistResponse validates indexes and caps at MAX_SHORTLIST", () => {
  assert.deepEqual(parseShortlistResponse('{"indexes":[2,0,2,99,-1,1]}', 3), [2, 0, 1]);
  assert.deepEqual(parseShortlistResponse("не json", 3), []);
  assert.deepEqual(parseShortlistResponse('{"items":[]}', 3), []);

  const many = JSON.stringify({ indexes: Array.from({ length: 200 }, (_, index) => index) });

  assert.equal(parseShortlistResponse(many, 200).length, MAX_SHORTLIST);
});

test("parseLessonPlanResponse parses payload and keeps the model's order", () => {
  const content = `Вот план:\n\`\`\`json\n${JSON.stringify({
    items: [
      { index: 3, reason: "gap", minutes: 12, comment: "закрываем красный номер" },
      { index: 0, reason: "REVIEW", minutes: 0, comment: "" },
      { index: 3, reason: "NEW" },
      { index: 7, reason: "NEW" },
      { index: 1, reason: "что-то", minutes: 9999, comment: "x".repeat(500) }
    ],
    summary: "s".repeat(1000)
  })}\n\`\`\``;

  const plan = parseLessonPlanResponse(content, 5);

  assert.deepEqual(
    plan.items.map((item) => item.index),
    [3, 0, 1]
  );
  assert.equal(plan.items[0].reason, "GAP");
  assert.equal(plan.items[1].reason, "REVIEW");
  assert.equal(plan.items[1].minutes, null);
  assert.equal(plan.items[2].reason, "NEW");
  assert.equal(plan.items[2].minutes, 240);
  assert.equal(plan.items[2].comment.length, 200);
  assert.equal(plan.summary.length, 400);
});

test("parseLessonPlanResponse caps items and never throws on garbage", () => {
  const many = JSON.stringify({
    items: Array.from({ length: 100 }, (_, index) => ({ index, reason: "NEW" }))
  });

  assert.equal(parseLessonPlanResponse(many, 100).items.length, MAX_PLAN_ITEMS);
  assert.deepEqual(parseLessonPlanResponse("модель упала", 5), { items: [], extraItems: [], summary: "" });
  assert.deepEqual(parseLessonPlanResponse('{"summary":"без items"}', 5), { items: [], extraItems: [], summary: "" });
});

test("parseLessonPlanResponse splits main and extra parts without duplicates", () => {
  const content = JSON.stringify({
    items: [
      { index: 0, reason: "GAP" },
      { index: 1, reason: "NEW" }
    ],
    extraItems: [
      { index: 1, reason: "NEW" },
      { index: 2, reason: "REVIEW", minutes: 6 },
      { index: 99, reason: "NEW" }
    ],
    summary: "основная + запас"
  });

  const plan = parseLessonPlanResponse(content, 5);

  assert.deepEqual(plan.items.map((item) => item.index), [0, 1]);
  assert.deepEqual(plan.extraItems.map((item) => item.index), [2]);
  assert.equal(plan.extraItems[0].reason, "REVIEW");
});

test("normalizePlanParams clamps every field", () => {
  const params = normalizePlanParams({
    title: `  ${"t".repeat(300)}  `,
    durationMinutes: 999,
    topicIds: ["a", "", "b "],
    targetDifficulty: 42,
    teacherNote: "n".repeat(1000)
  });

  assert.equal(params.title.length, 200);
  assert.equal(params.durationMinutes, 240);
  assert.deepEqual(params.topicIds, ["a", "b"]);
  assert.equal(params.targetDifficulty, 10);
  assert.equal(params.teacherNote.length, 500);

  const defaults = normalizePlanParams({});

  assert.equal(defaults.durationMinutes, 60);
  assert.equal(defaults.targetDifficulty, null);
  assert.equal(defaults.title, "");

  assert.equal(normalizePlanParams({ durationMinutes: 1 }).durationMinutes, 15);
});

test("normalizeSpeed clamps to 1..10 and passes null through", () => {
  assert.equal(normalizeSpeed(0), 1);
  assert.equal(normalizeSpeed(99), 10);
  assert.equal(normalizeSpeed(7), 7);
  assert.equal(normalizeSpeed("щук"), null);
  assert.equal(normalizeSpeed(null), null);
});
