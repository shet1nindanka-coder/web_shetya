import test from "node:test";
import assert from "node:assert/strict";
import { getHomeworkPhotoRetentionDays } from "../lib/homework-photo-retention";

test("getHomeworkPhotoRetentionDays defaults to a year", () => {
  assert.equal(getHomeworkPhotoRetentionDays(undefined), 365);
  assert.equal(getHomeworkPhotoRetentionDays(""), 365);
  assert.equal(getHomeworkPhotoRetentionDays("not-a-number"), 365);
});

test("getHomeworkPhotoRetentionDays supports custom values and disabling", () => {
  assert.equal(getHomeworkPhotoRetentionDays("180"), 180);
  assert.equal(getHomeworkPhotoRetentionDays("30.9"), 30);
  assert.equal(getHomeworkPhotoRetentionDays("0"), null);
  assert.equal(getHomeworkPhotoRetentionDays("-1"), null);
});
