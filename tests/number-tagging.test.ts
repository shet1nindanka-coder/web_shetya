import test from "node:test";
import assert from "node:assert/strict";
import { MAX_DIFFICULTY, MIN_DIFFICULTY, parseTaggingResponse } from "../lib/number-tagging";

test("parseTaggingResponse parses valid payload and keeps minutes", () => {
  const content = JSON.stringify({
    items: [
      { index: 0, difficulty: 4, estimatedMinutes: 8 },
      { index: 1, difficulty: 9, estimatedMinutes: 25 }
    ]
  });

  assert.deepEqual(parseTaggingResponse(content, 2), [
    { index: 0, difficulty: 4, estimatedMinutes: 8 },
    { index: 1, difficulty: 9, estimatedMinutes: 25 }
  ]);
});

test("parseTaggingResponse strips code fences and surrounding text", () => {
  const content = 'Вот оценка:\n```json\n{"items":[{"index":0,"difficulty":5,"estimatedMinutes":10}]}\n```';

  assert.equal(parseTaggingResponse(content, 1).length, 1);
});

test("parseTaggingResponse clamps difficulty and minutes", () => {
  const content = JSON.stringify({
    items: [
      { index: 0, difficulty: 0, estimatedMinutes: 100000 },
      { index: 1, difficulty: 99, estimatedMinutes: 0 }
    ]
  });

  const items = parseTaggingResponse(content, 2);

  assert.equal(items[0].difficulty, MIN_DIFFICULTY);
  assert.equal(items[0].estimatedMinutes, 300);
  assert.equal(items[1].difficulty, MAX_DIFFICULTY);
  assert.equal(items[1].estimatedMinutes, null);
});

test("parseTaggingResponse drops garbage, duplicates and out-of-range indices", () => {
  const content = JSON.stringify({
    items: [
      { index: 0, difficulty: 3 },
      { index: 0, difficulty: 8 },
      { index: 5, difficulty: 4 },
      { index: -1, difficulty: 4 },
      { index: 1, difficulty: "not-a-number" },
      "мусор",
      null
    ]
  });

  const items = parseTaggingResponse(content, 2);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { index: 0, difficulty: 3, estimatedMinutes: null });
});

test("parseTaggingResponse returns empty list for non-JSON and missing items", () => {
  assert.deepEqual(parseTaggingResponse("модель сломалась", 3), []);
  assert.deepEqual(parseTaggingResponse('{"results":[]}', 3), []);
});
