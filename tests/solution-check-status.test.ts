import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import { getStatusForAiVerdict, isStatusDowngrade } from "../lib/solution-check-status";

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

test("isStatusDowngrade blocks AI from lowering existing statuses", () => {
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.RED, HomeworkNumberStatus.GREEN), true);
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.RED, HomeworkNumberStatus.YELLOW), true);
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.GREEN), true);
});

test("isStatusDowngrade allows upgrades and first-time statuses", () => {
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.GREEN, null), false);
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.RED, null), false);
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED), false);
  assert.equal(isStatusDowngrade(HomeworkNumberStatus.GREEN, HomeworkNumberStatus.GREEN), false);
});
