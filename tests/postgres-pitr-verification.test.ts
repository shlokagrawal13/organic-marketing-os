import { test } from "node:test";
import assert from "node:assert/strict";
import { withHistoricalRecoveryPrerequisites } from "../scripts/historical-recovery-gate.mjs";
import { checksum } from "../scripts/compose-verification.mjs";
import {
  assertPitrCase,
  withVerifiedPhysicalBackup,
  nativeStartExit,
} from "../scripts/postgres-pitr-verification.mjs";
test("Native start status requires one complete explicit marker", () => {
  assert.equal(
    nativeStartExit("waiting for startup\nOMOS_NATIVE_START_EXIT=0\n"),
    0,
  );
  for (const text of [
    "",
    "pg_ctl failed",
    "OMOS_NATIVE_START_EXIT=1\nOMOS_NATIVE_START_EXIT=0\n",
    "OMOS_NATIVE_START_EXIT=-1\n",
    "OMOS_NATIVE_START_EXIT=256\n",
    "OMOS_NATIVE_START_EXIT=garbage\n",
  ])
    assert.throws(() => nativeStartExit(text));
});
test("Native start marker preserves a failed server status even after successful outer transport", () => {
  const code = nativeStartExit(
    "pg_ctl: could not start server\nOMOS_NATIVE_START_EXIT=1\n",
  );
  assert.equal(code, 1);
  assert.throws(() => assert.equal(code, 0));
});
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
test("Historical recovery refuses missing, overwritten or mismatched private objects before startup", async () => {
  const bytes = Buffer.from("old");
  const valid = {
    writersIsolated: true,
    databasePoint: "0/100",
    objectsPoint: "0/100",
    redisKeys: 0,
    queueReconstructionReviewed: true,
    externalEffectsReconciled: true,
    referenceInventoryComplete: true,
    references: [
      {
        key: "tenant/a",
        bytes: 3,
        sha256: checksum(bytes),
        contentType: "image/png",
      },
    ],
    objects: [{ key: "tenant/a", bytes, contentType: "image/png" }],
  };
  let starts = 0;
  const start = async () => {
    starts++;
  };
  for (const change of [
    { objects: [] },
    { objects: [{ ...valid.objects[0], bytes: Buffer.from("new") }] },
    { objects: [{ ...valid.objects[0], contentType: "text/plain" }] },
    { objects: [valid.objects[0], valid.objects[0]] },
    { objectsPoint: "0/200" },
    { referenceInventoryComplete: false },
  ])
    await assert.rejects(
      withHistoricalRecoveryPrerequisites({ ...valid, ...change }, start),
    );
  assert.equal(starts, 0);
  await withHistoricalRecoveryPrerequisites(valid, start);
  assert.equal(starts, 1);
});
test("Historical recovery keeps workers gated until queue and external effects are reconciled", async () => {
  const valid = {
    writersIsolated: true,
    databasePoint: "0/100",
    objectsPoint: "0/100",
    redisKeys: 0,
    queueReconstructionReviewed: true,
    externalEffectsReconciled: true,
    referenceInventoryComplete: true,
    references: [],
    objects: [],
  };
  let starts = 0;
  for (const change of [
    { writersIsolated: false },
    { redisKeys: 1 },
    { queueReconstructionReviewed: false },
    { externalEffectsReconciled: false },
    { databasePoint: "" },
  ])
    await assert.rejects(
      withHistoricalRecoveryPrerequisites({ ...valid, ...change }, async () => {
        starts++;
      }),
    );
  assert.equal(starts, 0);
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
