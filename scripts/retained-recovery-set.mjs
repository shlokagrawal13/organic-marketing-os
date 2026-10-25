// Fixture-only admission of a retained physical/WAL and historical-object set.
// Digests prove exact bytes inside this owned fixture, not production durability.
import assert from "node:assert/strict";
import { checksum } from "./compose-verification.mjs";
import {
  assertPhysicalCapture,
  physicalCaptureHash,
} from "./physical-object-binding.mjs";

const hex = /^[a-f0-9]{64}$/;
const walName = /^[0-9A-F]{24}$/;

export function createRetainedRecoveryReview({
  manifest,
  pointReceipt,
  applicationSnapshot,
  retainedPhysical,
  effects,
}) {
  assertPhysicalCapture({
    manifest,
    pointReceipt,
    expectedPointReceiptSha256: physicalCaptureHash(pointReceipt),
    applicationSnapshot,
  });
  assert.equal(retainedPhysical.nativeBackupVerified, true);
  assert.equal(
    retainedPhysical.baseManifestSha256,
    manifest.baseBackupManifestSha256,
  );
  assert.equal(retainedPhysical.targetLsn, pointReceipt.targetLsn);
  assert.match(retainedPhysical.targetSegment, walName);
  assert.match(retainedPhysical.targetWalSha256, hex);
  assert.equal(effects.databasePoint, pointReceipt.targetLsn);
  assert.equal(effects.inventoryComplete, true);
  assert.ok(Array.isArray(effects.receipts) && effects.receipts.length > 0);
  for (const receipt of effects.receipts) {
    assert.equal(receipt.databasePoint, pointReceipt.targetLsn);
    assert.equal(receipt.reviewed, true);
    assert.equal(receipt.disposition, "DO_NOT_REPLAY");
  }
  assert.equal(manifest.objects.length, manifest.versions.length);
  assert.ok(manifest.versions.length > 0);
  const versions = manifest.versions.map((version) => {
    assert.ok(version.versionId && version.versionId !== "null");
    assert.match(version.sha256, hex);
    assert.ok(Number.isSafeInteger(version.bytes) && version.bytes > 0);
    const object = manifest.objects.find(
      (item) => item.key === version.sourceKey,
    );
    assert.ok(object);
    assert.equal(object.sha256, version.sha256);
    assert.equal(object.bytes, version.bytes);
    assert.equal(object.contentType, version.contentType);
    return {
      key: version.key,
      sourceKey: version.sourceKey,
      versionId: version.versionId,
      bytes: version.bytes,
      sha256: version.sha256,
      contentType: version.contentType,
      cacheControl: version.cacheControl,
      metadata: version.metadata,
    };
  });
  assert.equal(new Set(versions.map((v) => v.key)).size, versions.length);
  assert.equal(new Set(versions.map((v) => v.sourceKey)).size, versions.length);
  return {
    version: 1,
    reviewed: true,
    pointReceiptSha256: physicalCaptureHash(pointReceipt),
    applicationSnapshotSha256: physicalCaptureHash(applicationSnapshot),
    retainedBaseManifestSha256: retainedPhysical.baseManifestSha256,
    retainedTargetLsn: retainedPhysical.targetLsn,
    retainedTargetSegment: retainedPhysical.targetSegment,
    retainedWalSha256: retainedPhysical.targetWalSha256,
    versions,
    effectsSha256: physicalCaptureHash(effects),
  };
}

export async function withRetainedRecoverySet(
  {
    review,
    expectedReviewSha256,
    manifest,
    pointReceipt,
    applicationSnapshot,
    retainedPhysical,
    effects,
    verifyRetainedBase,
    readRetainedWalSha256,
    readHistoricalObjects,
    restoredObjects,
    redisKeys,
    writersAbsent,
  },
  start,
) {
  assert.match(expectedReviewSha256, hex);
  assert.equal(physicalCaptureHash(review), expectedReviewSha256);
  assert.deepEqual(
    review,
    createRetainedRecoveryReview({
      manifest,
      pointReceipt,
      applicationSnapshot,
      retainedPhysical,
      effects,
    }),
  );
  assert.equal(redisKeys, 0);
  assert.equal(writersAbsent, true);
  const verifiedBase = await verifyRetainedBase();
  assert.equal(verifiedBase.manifestSha256, review.retainedBaseManifestSha256);
  assert.match(verifiedBase.output, /backup successfully verified/);
  assert.equal(await readRetainedWalSha256(), review.retainedWalSha256);
  const historical = await readHistoricalObjects();
  assert.equal(historical.length, review.versions.length);
  assert.equal(restoredObjects.length, review.versions.length);
  for (const version of review.versions) {
    const source = historical.find(
      (item) =>
        item.key === version.sourceKey && item.versionId === version.versionId,
    );
    const restored = restoredObjects.find(
      (item) => item.key === version.sourceKey,
    );
    assert.ok(source, `Missing retained version: ${version.sourceKey}`);
    assert.ok(restored, `Missing restored object: ${version.sourceKey}`);
    const bytes = Buffer.from(source.body, "base64");
    assert.equal(bytes.length, version.bytes);
    assert.equal(checksum(bytes), version.sha256);
    assert.equal(source.contentType, version.contentType);
    assert.equal(source.cacheControl, version.cacheControl);
    assert.deepEqual(source.metadata, version.metadata);
    assert.equal(restored.bytes.length, version.bytes);
    assert.equal(checksum(restored.bytes), version.sha256);
  }
  return await start();
}
