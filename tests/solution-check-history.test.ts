import test from "node:test";
import assert from "node:assert/strict";
import { SolutionCheckStatus } from "@prisma/client";
import { selectCompletedCheckIdsToPrune } from "../lib/solution-check-history";

test("selectCompletedCheckIdsToPrune keeps newest completed entries and every active check", () => {
  const checks = [
    { id: "active-new", status: SolutionCheckStatus.PENDING },
    { id: "done-3", status: SolutionCheckStatus.DONE },
    { id: "active-old", status: SolutionCheckStatus.CHECKING },
    { id: "failed-2", status: SolutionCheckStatus.FAILED },
    { id: "done-1", status: SolutionCheckStatus.DONE }
  ];

  assert.deepEqual(selectCompletedCheckIdsToPrune(checks, 2), ["done-1"]);
});

test("selectCompletedCheckIdsToPrune treats invalid limits safely", () => {
  const checks = [
    { id: "new", status: SolutionCheckStatus.DONE },
    { id: "old", status: SolutionCheckStatus.FAILED }
  ];

  assert.deepEqual(selectCompletedCheckIdsToPrune(checks, 0), ["new", "old"]);
  assert.deepEqual(selectCompletedCheckIdsToPrune(checks, -10), ["new", "old"]);
  assert.deepEqual(selectCompletedCheckIdsToPrune(checks, Number.NaN), []);
});

test("selectCompletedCheckIdsToPrune defaults to fifty completed checks", () => {
  const checks = Array.from({ length: 51 }, (_, index) => ({
    id: `check-${index}`,
    status: SolutionCheckStatus.DONE
  }));

  assert.deepEqual(selectCompletedCheckIdsToPrune(checks), ["check-50"]);
});
