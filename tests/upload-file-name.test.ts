import test from "node:test";
import assert from "node:assert/strict";
import { getSafeUploadFileName } from "../lib/upload-file-name";

test("getSafeUploadFileName keeps extension and strips unsafe characters", () => {
  assert.equal(getSafeUploadFileName("Résumé final 2026.PDF"), "Resume-final-2026.pdf");
  assert.equal(getSafeUploadFileName("report(1).docx"), "report-1.docx");
});

test("getSafeUploadFileName falls back to file when name becomes empty", () => {
  assert.equal(getSafeUploadFileName("???###.png"), "file.png");
  assert.equal(getSafeUploadFileName("   "), "file");
});
