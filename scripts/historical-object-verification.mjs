// Isolated verification contract, not production backup administration.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export function assertHistoricalBucket(project, bucket) {
  assert.match(project, /^omos-compose-verify-[0-9a-f]{16}$/);
  assert.equal(project.length, 36);
  assert.equal(bucket, `omos-history-${project.slice(-16)}`);
}
export async function withVerifiedHistoricalObjects(
  { project, bucket, references, read },
  start,
) {
  assertHistoricalBucket(project, bucket);
  assert.ok(
    Array.isArray(references) &&
      references.length > 0 &&
      references.length <= 1000,
  );
  const keys = new Set();
  for (const r of references) {
    assert.ok(
      typeof r.key === "string" &&
        r.key.startsWith("synthetic/") &&
        !keys.has(r.key),
    );
    keys.add(r.key);
    assert.ok(
      typeof r.versionId === "string" &&
        r.versionId.length > 0 &&
        r.versionId !== "null",
    );
    assert.ok(
      Number.isSafeInteger(r.bytes) &&
        r.bytes > 0 &&
        r.bytes <= 64 * 1024 * 1024,
    );
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof r.contentType, "string");
    assert.ok(
      r.metadata &&
        typeof r.metadata === "object" &&
        !Array.isArray(r.metadata),
    );
  }
  for (const r of references) {
    const object = await read({ bucket, key: r.key, versionId: r.versionId });
    assert.equal(
      object.versionId,
      r.versionId,
      "Historical version identity mismatch",
    );
    assert.ok(Buffer.isBuffer(object.bytes));
    assert.equal(object.bytes.length, r.bytes);
    assert.equal(
      createHash("sha256").update(object.bytes).digest("hex"),
      r.sha256,
      "Historical object checksum mismatch",
    );
    assert.equal(object.contentType, r.contentType);
    assert.equal(object.cacheControl ?? null, r.cacheControl ?? null);
    assert.deepEqual(object.metadata, r.metadata);
  }
  return await start();
}
