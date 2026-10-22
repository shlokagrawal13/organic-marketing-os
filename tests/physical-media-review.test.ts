import assert from "node:assert/strict";
import { test } from "node:test";
import {
  physicalMediaIds as ids,
  createPhysicalMediaReview,
  assertPhysicalMediaReview,
} from "../scripts/physical-media-review.mjs";
import { physicalCaptureHash as hash } from "../scripts/physical-object-binding.mjs";
function fixture() {
  const org = "org",
    key = "org/input.png",
    out = `org/generated/${ids.media}/retained.png`;
  const snapshot = {
    rows: {
      Asset: [
        {
          id: ids.validAsset,
          organizationId: org,
          mimeType: "image/png",
          objectKey: key,
          bytes: 500,
          sha256: "a".repeat(64),
        },
      ],
      RenderSegment: [],
      RenderJob: [
        {
          id: ids.render,
          organizationId: org,
          status: "QUEUED",
          outputKey: null,
          snapshot: {
            scenes: [{ visualAssetId: ids.validAsset, audioAssetId: null }],
          },
        },
      ],
      RenderInput: [{ renderId: ids.render, assetId: ids.validAsset }],
      MediaGeneration: [
        {
          id: ids.media,
          organizationId: org,
          state: "OUTPUT_READY",
          assetId: null,
          outputKey: out,
          quotedCredits: 2,
          creditReservationId: "reserve",
        },
      ],
      CreditReservation: [
        { id: "reserve", organizationId: org, credits: 2, state: "RESERVED" },
      ],
      PublicationAttempt: [],
      PublicationSchedule: [],
      PublicationIntent: [],
    },
  };
  const objects = [
    { key, bytes: 500, sha256: "a".repeat(64), contentType: "image/png" },
    { key: out, bytes: 600, sha256: "b".repeat(64), contentType: "image/png" },
    {
      key: "org/historical.png",
      bytes: 3,
      sha256: "c".repeat(64),
      contentType: "image/png",
    },
  ];
  return { snapshot, objects };
}
function verify(snapshot, objects) {
  const review = createPhysicalMediaReview(snapshot, objects);
  return assertPhysicalMediaReview(snapshot, review, hash(review));
}
test("Physical media admits bounded local render and retained-output ingestion", () => {
  const { snapshot, objects } = fixture();
  assert.deepEqual(verify(snapshot, objects), {
    renderId: ids.render,
    mediaId: ids.media,
    assetId: ids.validAsset,
  });
});
test("Physical media rejects altered pinned review and snapshot", () => {
  const { snapshot, objects } = fixture(),
    r = createPhysicalMediaReview(snapshot, objects),
    p = hash(r);
  assert.throws(() =>
    assertPhysicalMediaReview(snapshot, { ...r, reviewed: false }, p),
  );
  snapshot.rows.RenderJob[0].status = "RUNNING";
  assert.throws(() => assertPhysicalMediaReview(snapshot, r, p));
});
test("Physical media refuses provider submission states and completed jobs even with new review", () => {
  for (const state of [
    "QUEUED",
    "SUBMITTING",
    "PENDING",
    "UNKNOWN",
    "FAILED",
    "SUCCEEDED",
  ]) {
    const { snapshot, objects } = fixture();
    snapshot.rows.MediaGeneration[0].state = state;
    assert.throws(() => verify(snapshot, objects));
  }
});
test("Physical media refuses nonqueued renders and saved render outputs", () => {
  for (const status of ["RUNNING", "FAILED", "SUCCEEDED"]) {
    const { snapshot, objects } = fixture();
    snapshot.rows.RenderJob[0].status = status;
    assert.throws(() => verify(snapshot, objects));
  }
  const { snapshot, objects } = fixture();
  snapshot.rows.RenderJob[0].outputKey = "unreviewed";
  assert.throws(() => verify(snapshot, objects));
});
test("Physical media rejects publication work and unexpected job identities", () => {
  for (const table of [
    "PublicationAttempt",
    "PublicationSchedule",
    "PublicationIntent",
  ]) {
    const { snapshot, objects } = fixture();
    snapshot.rows[table].push({ id: "unreviewed" });
    assert.throws(() => verify(snapshot, objects));
  }
  const { snapshot, objects } = fixture();
  snapshot.rows.MediaGeneration[0].id = "other";
  assert.throws(() => verify(snapshot, objects));
});
test("Physical media requires matching render inputs and tenant-owned assets", () => {
  for (const change of [
    (s) => (s.rows.RenderInput[0].assetId = "other"),
    (s) => (s.rows.Asset[0].organizationId = "other"),
    (s) => (s.rows.RenderJob[0].snapshot.scenes[0].audioAssetId = "unreviewed"),
    (s) => (s.rows.MediaGeneration[0].organizationId = "other"),
  ]) {
    const { snapshot, objects } = fixture();
    change(snapshot);
    assert.throws(() => verify(snapshot, objects));
  }
});
test("Physical media requires exact reserved credits before ingestion", () => {
  for (const change of [
    (s) => (s.rows.CreditReservation[0].state = "SETTLED"),
    (s) => (s.rows.CreditReservation[0].credits = 3),
    (s) => (s.rows.MediaGeneration[0].creditReservationId = "missing"),
    (s) => (s.rows.CreditReservation[0].organizationId = "other"),
  ]) {
    const { snapshot, objects } = fixture();
    change(snapshot);
    assert.throws(() => verify(snapshot, objects));
  }
});
test("Physical media requires complete unique PNG bytes and hashes", () => {
  for (const change of [
    (o) => o.pop(),
    (o) => o.push(o[0]),
    (o) => (o[0].sha256 = "0".repeat(64)),
    (o) => (o[1].bytes = 3),
    (o) => (o[1].contentType = "text/plain"),
  ]) {
    const { snapshot, objects } = fixture();
    change(objects);
    assert.throws(() => verify(snapshot, objects));
  }
});
