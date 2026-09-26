import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  digest,
  token,
  canEdit,
  canApprove,
} from "../packages/core/security";
test("password hashes are salted; correct password succeeds and incorrect fails", async () => {
  const a = await hashPassword("a long passphrase 123"),
    b = await hashPassword("a long passphrase 123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("a long passphrase 123", a), true);
  assert.equal(await verifyPassword("wrong", a), false);
});
test("session tokens have independent entropy and hashes hide the raw token", () => {
  const a = token(),
    b = token();
  assert.equal(a.length, 64);
  assert.notEqual(a, b);
  assert.notEqual(digest(a), a);
});
test("creators cannot approve and analysts cannot mutate content", () => {
  assert.equal(canEdit("CREATOR"), true);
  assert.equal(canApprove("CREATOR"), false);
  assert.equal(canEdit("ANALYST"), false);
  assert.equal(canApprove("OWNER"), true);
});
