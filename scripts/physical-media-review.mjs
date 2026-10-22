// Bounded fixture review; no production inventory or provider authorization.
import assert from "node:assert/strict";
import { physicalCaptureHash } from "./physical-object-binding.mjs";
export const physicalMediaIds = {
  validAsset: "7cdd0796-a51e-442a-aab9-777777777777",
  render: "7cdd0796-a51e-442a-aab9-888888888888",
  media: "7cdd0796-a51e-442a-aab9-666666666666",
};
export function createPhysicalMediaReview(snapshot, objects) {
  return {
    version: 1,
    snapshotSha256: physicalCaptureHash(snapshot),
    jobsSha256: physicalCaptureHash({
      renders: snapshot.rows.RenderJob,
      media: snapshot.rows.MediaGeneration,
      inputs: snapshot.rows.RenderInput,
    }),
    objects: objects
      .map(({ key, bytes, sha256, contentType }) => ({
        key,
        bytes,
        sha256,
        contentType,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    renderId: physicalMediaIds.render,
    mediaId: physicalMediaIds.media,
    assetId: physicalMediaIds.validAsset,
    renderDisposition: "RECONSTRUCT_LOCAL_RENDER",
    mediaDisposition: "INGEST_RETAINED_OUTPUT_ONLY",
    reviewed: true,
  };
}
export function assertPhysicalMediaReview(snapshot, review, expectedSha256) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    physicalCaptureHash(review),
    expectedSha256,
    "Physical media review changed",
  );
  assert.equal(
    review.snapshotSha256,
    physicalCaptureHash(snapshot),
    "Physical media review snapshot changed",
  );
  assert.equal(review.version, 1);
  assert.equal(review.reviewed, true);
  assert.equal(review.renderDisposition, "RECONSTRUCT_LOCAL_RENDER");
  assert.equal(review.mediaDisposition, "INGEST_RETAINED_OUTPUT_ONLY");
  for (const [name, key] of [
    ["renderId", "render"],
    ["mediaId", "media"],
    ["assetId", "validAsset"],
  ])
    assert.equal(review[name], physicalMediaIds[key]);
  const { rows } = snapshot;
  for (const table of [
    "PublicationAttempt",
    "PublicationSchedule",
    "PublicationIntent",
  ])
    assert.equal(rows[table].length, 0, `Unreviewed ${table}`);
  assert.equal(rows.RenderJob.length, 1);
  assert.equal(rows.MediaGeneration.length, 1);
  assert.equal(rows.RenderInput.length, 1);
  assert.equal(
    review.jobsSha256,
    physicalCaptureHash({
      renders: rows.RenderJob,
      media: rows.MediaGeneration,
      inputs: rows.RenderInput,
    }),
  );
  const r = rows.RenderJob[0],
    m = rows.MediaGeneration[0],
    input = rows.RenderInput[0],
    a = rows.Asset.find((a) => a.id === review.assetId);
  assert.equal(r.id, review.renderId);
  assert.equal(r.status, "QUEUED");
  assert.equal(r.outputKey, null);
  assert.equal(m.id, review.mediaId);
  assert.equal(m.state, "OUTPUT_READY");
  assert.equal(m.assetId, null);
  assert.equal(m.organizationId, r.organizationId);
  assert.equal(m.quotedCredits, 2);
  assert.ok(a);
  assert.equal(a.organizationId, r.organizationId);
  assert.equal(a.mimeType, "image/png");
  assert.equal(input.renderId, r.id);
  assert.equal(input.assetId, a.id);
  assert.equal(r.snapshot.scenes.length, 1);
  assert.equal(r.snapshot.scenes[0].visualAssetId, a.id);
  assert.equal(r.snapshot.scenes[0].audioAssetId, null);
  assert.ok(m.outputKey.startsWith(`${m.organizationId}/generated/${m.id}/`));
  const reservation = rows.CreditReservation.find(
    (x) => x.id === m.creditReservationId,
  );
  assert.ok(reservation);
  assert.equal(reservation.organizationId, m.organizationId);
  assert.equal(reservation.credits, 2);
  assert.equal(reservation.state, "RESERVED");
  assert.equal(review.objects.length, 3);
  assert.equal(new Set(review.objects.map((o) => o.key)).size, 3);
  for (const key of [a.objectKey, m.outputKey]) {
    const o = review.objects.find((o) => o.key === key);
    assert.ok(o);
    assert.equal(o.contentType, "image/png");
    assert.ok(o.bytes > 100);
    assert.match(o.sha256, /^[a-f0-9]{64}$/);
    if (key === a.objectKey) {
      assert.equal(o.bytes, a.bytes);
      assert.equal(o.sha256, a.sha256);
    }
  }
  return { renderId: r.id, mediaId: m.id, assetId: a.id };
}
