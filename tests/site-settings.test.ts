import test from "node:test";
import assert from "node:assert/strict";
import {
  applySettingRows,
  getSiteSettingsDefaults,
  parseSiteSettingsForm,
  serializeSiteSettings
} from "../lib/site-settings";

test("applySettingRows overrides defaults and clamps invalid values", () => {
  const defaults = getSiteSettingsDefaults();
  const result = applySettingRows(defaults, [
    { key: "aiEnabled", value: "false" },
    { key: "aiModel", value: "  gpt-5.6-terra  " },
    { key: "aiReasoningEffort", value: "medium" },
    { key: "aiMinConfidence", value: "1.7" },
    { key: "aiDailyLimit", value: "-5" },
    { key: "maxPhotosPerAssignment", value: "999" },
    { key: "unknownKey", value: "ignored" }
  ]);

  assert.equal(result.aiEnabled, false);
  assert.equal(result.aiModel, "gpt-5.6-terra");
  assert.equal(result.aiReasoningEffort, "medium");
  assert.equal(result.aiMinConfidence, 1);
  assert.equal(result.aiDailyLimit, 1);
  assert.equal(result.maxPhotosPerAssignment, 30);
});

test("applySettingRows keeps defaults for garbage input", () => {
  const defaults = getSiteSettingsDefaults();
  const result = applySettingRows(defaults, [
    { key: "aiReasoningEffort", value: "ultra" },
    { key: "aiMinConfidence", value: "not-a-number" },
    { key: "photoRetentionDays", value: "" }
  ]);

  assert.equal(result.aiReasoningEffort, defaults.aiReasoningEffort);
  assert.equal(result.aiMinConfidence, defaults.aiMinConfidence);
  assert.equal(result.photoRetentionDays, defaults.photoRetentionDays);
});

test("parseSiteSettingsForm reads checkbox and round-trips through serialize", () => {
  const formData = new FormData();
  formData.set("aiModel", "gpt-5.6-sol");
  formData.set("aiReasoningEffort", "low");
  formData.set("aiMinConfidence", "0.5");
  formData.set("aiDailyLimit", "100");
  formData.set("aiPerStudentHourlyLimit", "5");
  formData.set("photoRetentionDays", "180");
  formData.set("maxPhotosPerAssignment", "8");
  formData.set("completedChecksKept", "25");

  const parsed = parseSiteSettingsForm(formData);

  assert.equal(parsed.aiEnabled, false);
  assert.equal(parsed.aiModel, "gpt-5.6-sol");
  assert.equal(parsed.photoRetentionDays, 180);

  const roundTripped = applySettingRows(getSiteSettingsDefaults(), serializeSiteSettings(parsed));
  assert.deepEqual(roundTripped, parsed);
});
