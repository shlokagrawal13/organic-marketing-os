import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPitrCase,
  withVerifiedPhysicalBackup,
} from "../scripts/postgres-pitr-verification.mjs";
test("Physical recovery reset rejects source/base/archive paths and non-fixture identities", () => {
  const project = "omos-pitr-verify-0123456789abcdef";
  assert.doesNotThrow(() => assertPitrCase(project, "retry", "/fixture/retry"));
  for (const [identity, kind, directory] of [
    ["organic-marketing-os", "retry", "/fixture/retry"],
    [project + "\n", "retry", "/fixture/retry"],
    [project, "source", "/fixture/source"],
    [project, "retry", "/fixture/base"],
    [project, "retry", "/fixture/archive"],
    [project, "retry", "/fixture/retry/../source"],
    [project, "retry", "/var/lib/postgresql/data"],
  ])
    assert.throws(() => assertPitrCase(identity, kind, directory));
});
test("Failed or incomplete native backup verification never invokes recovery startup", async () => {
  let starts = 0;
  const start = async () => {
    starts++;
    return "started";
  };
  await assert.rejects(
    withVerifiedPhysicalBackup(async () => {
      throw Error("checksum mismatch");
    }, start),
  );
  await assert.rejects(withVerifiedPhysicalBackup(async () => "", start));
  assert.equal(starts, 0);
  assert.equal(
    await withVerifiedPhysicalBackup(
      async () => "backup successfully verified",
      start,
    ),
    "started",
  );
  assert.equal(starts, 1);
});
