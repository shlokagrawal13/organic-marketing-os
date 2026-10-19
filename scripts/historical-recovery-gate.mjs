// Harness-only prerequisite gate; not a deployed recovery controller.
import assert from "node:assert/strict";
import { checksum } from "./compose-verification.mjs";

export async function withHistoricalRecoveryPrerequisites(evidence, start) {
  assert.equal(evidence.writersIsolated, true, "Writers must remain isolated");
  assert.match(evidence.databasePoint, /^[0-9A-F]+\/[0-9A-F]+$/);
  assert.equal(
    evidence.objectsPoint,
    evidence.databasePoint,
    "Historical object recovery point required",
  );
  assert.equal(
    evidence.redisKeys,
    0,
    "Historical queues must not reuse current Redis",
  );
  assert.equal(
    evidence.queueReconstructionReviewed,
    true,
    "Queue reconstruction review required",
  );
  assert.equal(
    evidence.externalEffectsReconciled,
    true,
    "Post-target external effects need reconciliation",
  );
  assert.equal(
    evidence.referenceInventoryComplete,
    true,
    "Complete database object-reference inventory required",
  );
  assert.ok(
    Array.isArray(evidence.references) && Array.isArray(evidence.objects),
  );
  const objects = new Map();
  for (const object of evidence.objects) {
    assert.equal(objects.has(object.key), false, "Duplicate historical object");
    assert.ok(Buffer.isBuffer(object.bytes));
    objects.set(object.key, object);
  }
  for (const reference of evidence.references) {
    const object = objects.get(reference.key);
    assert.ok(object, "Missing historical private object");
    assert.equal(object.bytes.length, reference.bytes);
    assert.equal(
      checksum(object.bytes),
      reference.sha256,
      "Historical private object bytes changed",
    );
    assert.equal(object.contentType, reference.contentType);
  }
  return await start();
}
