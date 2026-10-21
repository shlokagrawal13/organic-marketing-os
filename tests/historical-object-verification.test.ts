import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  assertHistoricalBucket,
  withVerifiedHistoricalObjects,
} from "../scripts/historical-object-verification.mjs";
const project = "omos-compose-verify-0123456789abcdef",
  bucket = "omos-history-0123456789abcdef";
const bytes = Buffer.from("historical");
const reference = {
  key: "synthetic/asset",
  versionId: "old-version",
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: "image/png",
  cacheControl: "private",
  metadata: { fixture: "historical" },
};
const object = { ...reference, bytes };
test("Historical readback accepts only an owned bucket and complete explicit version manifest before reads", async () => {
  let reads = 0,
    starts = 0;
  const read = async () => {
    reads++;
    return object;
  };
  const start = async () => {
    starts++;
  };
  for (const change of [
    { project: "production" },
    { bucket: "populated" },
    { references: [] },
    { references: [reference, reference] },
    { references: [{ ...reference, versionId: "null" }] },
    { references: [{ ...reference, versionId: "" }] },
    { references: [{ ...reference, key: "unscoped" }] },
    { references: [{ ...reference, bytes: 0 }] },
  ])
    await assert.rejects(
      withVerifiedHistoricalObjects(
        { project, bucket, references: [reference], read, ...change },
        start,
      ),
    );
  assert.equal(reads, 0);
  assert.equal(starts, 0);
  assert.throws(() => assertHistoricalBucket(project + "\n", bucket));
});
test("Historical readback rejects unavailable, wrong-version or altered bytes and metadata without readiness", async () => {
  let starts = 0;
  const start = async () => {
    starts++;
  };
  for (const change of [
    { versionId: "new-version" },
    { bytes: Buffer.from("overwrites") },
    { contentType: "text/plain" },
    { cacheControl: "public" },
    { metadata: { fixture: "later" } },
  ])
    await assert.rejects(
      withVerifiedHistoricalObjects(
        {
          project,
          bucket,
          references: [reference],
          read: async () => ({ ...object, ...change }),
        },
        start,
      ),
    );
  await assert.rejects(
    withVerifiedHistoricalObjects(
      {
        project,
        bucket,
        references: [reference],
        read: async () => {
          throw Error("NoSuchVersion");
        },
      },
      start,
    ),
  );
  assert.equal(starts, 0);
  await withVerifiedHistoricalObjects(
    {
      project,
      bucket,
      references: [reference],
      read: async (input) => {
        assert.equal(input.versionId, "old-version");
        return object;
      },
    },
    start,
  );
  assert.equal(starts, 1);
});
