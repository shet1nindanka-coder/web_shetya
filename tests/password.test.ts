import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword
} from "../lib/password";

test("hashPassword and verifyPassword validate the original password", async () => {
  const password = "Teacher123!";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("hashPassword uses a unique salt for each hash", async () => {
  const password = "same-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password, second), true);
});

test("verifyPassword safely rejects malformed hashes", async () => {
  assert.equal(await verifyPassword("anything", "broken"), false);
  assert.equal(await verifyPassword("anything", "salt:not-hex"), false);
});

test("createSessionToken returns unique 64-char hex tokens", () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test("hashSessionToken is deterministic and returns a SHA-256 hex digest", () => {
  const token = "session-token";
  const first = hashSessionToken(token);
  const second = hashSessionToken(token);

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, hashSessionToken("other-token"));
});
