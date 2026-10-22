// Fixture evidence only: capture precedes the named physical recovery point.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const physicalCaptureHash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const bytesHash = (value) =>
  createHash("sha256").update(value).digest("hex");
export function physicalApplicationReferences(snapshot) {
  const refs = [];
  for (const a of snapshot.rows.Asset)
    refs.push({
      entity: "Asset",
      id: a.id,
      organizationId: a.organizationId,
      field: "objectKey",
      key: a.objectKey,
      bytes: a.bytes,
      sha256: a.sha256,
    });
  for (const a of snapshot.rows.RenderSegment)
    refs.push({
      entity: "RenderSegment",
      id: a.id,
      organizationId: a.organizationId,
      field: "objectKey",
      key: a.objectKey,
      bytes: a.bytes,
    });
  for (const a of snapshot.rows.RenderJob)
    for (const field of ["outputKey", "thumbnailKey", "captionsKey"])
      if (a[field])
        refs.push({
          entity: "RenderJob",
          id: a.id,
          organizationId: a.organizationId,
          field,
          key: a[field],
          ...(field === "outputKey" ? { bytes: a.outputBytes } : {}),
        });
  for (const a of snapshot.rows.MediaGeneration)
    if (a.outputKey)
      refs.push({
        entity: "MediaGeneration",
        id: a.id,
        organizationId: a.organizationId,
        field: "outputKey",
        key: a.outputKey,
      });
  return refs;
}
export function assertPhysicalCapture({
  manifest,
  pointReceipt,
  expectedPointReceiptSha256,
  applicationSnapshot,
}) {
  assert.match(expectedPointReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    physicalCaptureHash(pointReceipt),
    expectedPointReceiptSha256,
    "Physical point receipt changed",
  );
  assert.match(manifest.physicalProject, /^omos-pitr-verify-[a-f0-9]{16}$/);
  assert.equal(manifest.physicalProject.length, 33);
  assert.equal(manifest.targetName, "omos_fixture_target");
  assert.match(manifest.baseBackupManifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    pointReceipt.physicalProject,
    manifest.physicalProject,
    "Physical fixture mismatch",
  );
  assert.equal(
    pointReceipt.targetName,
    manifest.targetName,
    "Physical target mismatch",
  );
  assert.equal(
    pointReceipt.baseBackupManifestSha256,
    manifest.baseBackupManifestSha256,
    "Physical base manifest mismatch",
  );
  assert.equal(
    pointReceipt.captureSha256,
    physicalCaptureHash(manifest),
    "Saved pre-target manifest changed",
  );
  assert.equal(
    pointReceipt.capturedBeforeNamedTarget,
    true,
    "Pre-target capture receipt required",
  );
  assert.match(pointReceipt.targetLsn, /^[A-F0-9]+\/[A-F0-9]+$/);
  assert.equal(
    manifest.applicationSnapshotSha256,
    physicalCaptureHash(applicationSnapshot),
    "Recovered physical application snapshot mismatch",
  );
  assert.deepEqual(
    manifest.references,
    physicalApplicationReferences(applicationSnapshot),
    "Recovered physical object references mismatch",
  );
}
