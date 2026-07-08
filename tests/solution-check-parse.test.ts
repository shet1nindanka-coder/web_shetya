import test from "node:test";
import assert from "node:assert/strict";
import { extractJsonObject, parseCheckResponse } from "../lib/solution-check-parse";

test("extractJsonObject strips code fences and surrounding text", () => {
  const parsed = extractJsonObject('```json\n{"results":[]}\n```') as { results: unknown[] };

  assert.deepEqual(parsed.results, []);
});

test("parseCheckResponse maps verdicts and keeps only valid numbers", () => {
  const content = JSON.stringify({
    results: [
      { number: 204, verdict: "correct", recognized_answer: "x = 5", comment: "Всё верно.", confidence: 0.95, copy_suspected: true, copy_reason: "Вузовские обозначения." },
      { number: 207, verdict: "INCORRECT", comment: "Ошибка в раскрытии скобок.", confidence: 1.7 },
      { number: 999, verdict: "CORRECT" },
      { number: 204, verdict: "INCORRECT" },
      { number: 211, verdict: "maybe" }
    ]
  });

  const results = parseCheckResponse(content, [204, 207, 211]);

  assert.equal(results.length, 2);
  assert.equal(results[0]?.number, 204);
  assert.equal(results[0]?.verdict, "CORRECT");
  assert.equal(results[0]?.recognizedAnswer, "x = 5");
  assert.equal(results[0]?.copySuspected, true);
  assert.equal(results[0]?.copyReason, "Вузовские обозначения.");
  assert.equal(results[1]?.number, 207);
  assert.equal(results[1]?.verdict, "INCORRECT");
  assert.equal(results[1]?.confidence, 1);
  assert.equal(results[1]?.copySuspected, false);
  assert.equal(results[1]?.copyReason, null);
});

test("parseCheckResponse throws on missing results array", () => {
  assert.throws(() => parseCheckResponse('{"verdict":"CORRECT"}', [1]));
  assert.throws(() => parseCheckResponse("нет json", [1]));
});
