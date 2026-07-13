import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";

test("rejects short passwords", () => {
  assert.notEqual(validatePasswordStrength("a1b2c3"), null);
});

test("rejects passwords without digits", () => {
  assert.notEqual(validatePasswordStrength("abcdefgh"), null);
});

test("rejects passwords without letters", () => {
  assert.notEqual(validatePasswordStrength("12345678"), null);
});

test("rejects common passwords", () => {
  assert.notEqual(validatePasswordStrength("password123"), null);
});

test("accepts strong enough passwords", () => {
  assert.equal(validatePasswordStrength("shbz2026math"), null);
  assert.equal(validatePasswordStrength("Маша2010школа"), null);
});

test("rejects excessively long passwords before hashing", () => {
  assert.match(validatePasswordStrength(`Strong1${"a".repeat(MAX_PASSWORD_LENGTH)}`) ?? "", /длиннее/);
});
