import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import { getStatusForAiVerdict } from "../lib/solution-check-status";

test("AI verdict maps to progress status without changing uncertain results", () => {
  assert.equal(getStatusForAiVerdict("UNCERTAIN", null), null);
  assert.equal(getStatusForAiVerdict("INCORRECT", null), HomeworkNumberStatus.RED);
  assert.equal(getStatusForAiVerdict("CORRECT", null), HomeworkNumberStatus.GREEN);
  assert.equal(
    getStatusForAiVerdict("CORRECT", HomeworkNumberStatus.RED),
    HomeworkNumberStatus.YELLOW
  );
  assert.equal(
    getStatusForAiVerdict("CORRECT", HomeworkNumberStatus.YELLOW),
    HomeworkNumberStatus.YELLOW
  );
});
