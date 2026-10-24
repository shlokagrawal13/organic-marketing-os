import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  createInflightPointReview,
  assertInflightPointAdmission,
} from "../scripts/physical-inflight-point.mjs";
import { physicalCaptureHash } from "../scripts/physical-object-binding.mjs";
import { physicalMediaIds } from "../scripts/physical-media-review.mjs";

const sha = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
const fixture = () => {
  const org = "7cdd0796-a51e-442a-aab9-111111111111";
  const tokens = [
    "render-live-token",
    "media-live-token",
    "provider-live-token",
  ];
  const snapshot = {
    rows: {
      RenderJob: [
        {
          id: physicalMediaIds.render,
          status: "RUNNING",
          runToken: tokens[0],
          heartbeatAt: "2026-10-23T20:00:00",
        },
      ],
      MediaGeneration: [
        {
          id: physicalMediaIds.media,
          state: "OUTPUT_READY",
          runToken: tokens[1],
          heartbeatAt: "2026-10-23T20:00:00",
        },
        {
          id: physicalMediaIds.ambiguous,
          state: "SUBMITTING",
          runToken: tokens[2],
          heartbeatAt: "2026-10-23T20:00:00",
        },
      ],
    },
  };
  const objects = [
    {
      key: `${org}/segments/a.mp4`,
      body: Buffer.from("encoded segment").toString("base64"),
      contentType: "video/mp4",
      sha256: sha("encoded segment"),
    },
    {
      key: `${org}/generated/b.png`,
      body: Buffer.from("retained image").toString("base64"),
      contentType: "image/png",
      sha256: sha("retained image"),
    },
  ];
  const barrier = {
    claimRunTokenHashes: tokens.map(sha),
    barriers: objects.map((o, index) => ({
      kind: index ? "media" : "render",
      key: o.key,
      bytes: Buffer.from(o.body, "base64").length,
      sha256: o.sha256,
    })),
    media: {
      acceptedCalls: 1,
      submissionAttempts: 1,
      responseHeld: true,
      idempotencyKey: `${org}:${physicalMediaIds.ambiguous}`,
      requestSha256: sha("request"),
    },
  };
  const backupManifestSha256 = sha("manifest"),
    backupTarSha256 = sha("tar");
  const review = createInflightPointReview({
    snapshot,
    objects,
    barrier,
    backupManifestSha256,
    backupTarSha256,
  });
  return {
    snapshot,
    objects,
    barrier,
    review,
    expectedReviewSha256: physicalCaptureHash(review),
    backupManifestSha256,
    backupTarSha256,
    redisKeys: 0,
    writersAbsent: true,
  };
};

test("in-flight point admits only the exact restored claims, objects and accepted effect", () => {
  assert.equal(assertInflightPointAdmission(fixture()), true);
});

test("in-flight point denies a changed physical row or object", () => {
  const f = fixture();
  assert.throws(() =>
    assertInflightPointAdmission({
      ...f,
      snapshot: { rows: { ...f.snapshot.rows, RenderJob: [] } },
    }),
  );
  assert.throws(() =>
    assertInflightPointAdmission({ ...f, objects: f.objects.slice(1) }),
  );
  assert.throws(() =>
    createInflightPointReview({
      ...f,
      snapshot: {
        rows: {
          ...f.snapshot.rows,
          RenderJob: [{ ...f.snapshot.rows.RenderJob[0], status: "QUEUED" }],
        },
      },
    }),
  );
});

test("in-flight point denies changed provider receipt or replay approval", () => {
  const f = fixture();
  assert.throws(() =>
    assertInflightPointAdmission({
      ...f,
      barrier: {
        ...f.barrier,
        media: { ...f.barrier.media, submissionAttempts: 2 },
      },
    }),
  );
  assert.throws(() =>
    assertInflightPointAdmission({
      ...f,
      review: {
        ...f.review,
        providerEffect: { ...f.review.providerEffect, disposition: "REPLAY" },
      },
    }),
  );
  assert.throws(() =>
    createInflightPointReview({
      ...f,
      barrier: {
        ...f.barrier,
        media: { ...f.barrier.media, acceptedCalls: 0 },
      },
    }),
  );
});

test("in-flight point denies changed backup identity, Redis state or live writers", () => {
  const f = fixture();
  assert.throws(() =>
    assertInflightPointAdmission({ ...f, backupManifestSha256: sha("other") }),
  );
  assert.throws(() =>
    assertInflightPointAdmission({ ...f, backupTarSha256: sha("other") }),
  );
  assert.throws(() => assertInflightPointAdmission({ ...f, redisKeys: 1 }));
  assert.throws(() =>
    assertInflightPointAdmission({ ...f, writersAbsent: false }),
  );
});
