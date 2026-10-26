import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  assertBeforeInflightClaims,
  assertInflightWalAdmission,
} from "../scripts/physical-inflight-wal.mjs";
import { createInflightPointReview } from "../scripts/physical-inflight-point.mjs";
import { physicalCaptureHash } from "../scripts/physical-object-binding.mjs";
import { physicalMediaIds as ids } from "../scripts/physical-media-review.mjs";
import { createRecoveryProvider } from "../scripts/compose-recovery-provider.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const snapshot = {
    rows: {
      RenderJob: [
        {
          id: ids.render,
          status: "RUNNING",
          runToken: "render-token",
          heartbeatAt: "2026-10-26T00:00:00Z",
        },
      ],
      MediaGeneration: [
        {
          id: ids.media,
          state: "OUTPUT_READY",
          runToken: "media-token",
          heartbeatAt: "2026-10-26T00:00:00Z",
        },
        {
          id: ids.ambiguous,
          state: "SUBMITTING",
          runToken: "ambiguous-token",
          heartbeatAt: "2026-10-26T00:00:00Z",
        },
      ],
    },
  };
  const objects = [
    {
      key: "org/segment.mp4",
      body: Buffer.from("segment").toString("base64"),
      sha256: sha("segment"),
      contentType: "video/mp4",
    },
  ];
  const barrier = {
    claimRunTokenHashes: ["render-token", "media-token", "ambiguous-token"].map(
      sha,
    ),
    barriers: [
      {
        kind: "render",
        key: objects[0].key,
        bytes: 7,
        sha256: objects[0].sha256,
      },
    ],
    media: {
      acceptedCalls: 1,
      submissionAttempts: 1,
      responseHeld: true,
      requestSha256: sha("accepted request"),
      idempotencyKey: "org:ambiguous",
    },
  };
  const backupManifestSha256 = sha("base"),
    backupTarSha256 = sha("base-tar");
  const review = createInflightPointReview({
    snapshot,
    objects,
    barrier,
    backupManifestSha256,
    backupTarSha256,
  });
  const expectedReviewSha256 = physicalCaptureHash(review);
  const baseSnapshotSha256 = sha("queued-before-workers"),
    targetName = "omos_inflight_0123456789abcdef",
    targetLsn = "0/4001234",
    walArchiveSha256 = sha("archived-wal");
  const walReview = {
    version: 1,
    inflightReviewSha256: expectedReviewSha256,
    baseSnapshotSha256,
    targetName,
    targetLsn,
    walArchiveSha256,
  };
  return {
    snapshot,
    objects,
    barrier,
    review,
    expectedReviewSha256,
    backupManifestSha256,
    backupTarSha256,
    redisKeys: 0,
    writersAbsent: true,
    walReview,
    expectedWalReviewSha256: physicalCaptureHash(walReview),
    baseSnapshotSha256,
    targetName,
    targetLsn,
    walArchiveSha256,
    restoredMarkers: [1, 2],
    sourceUnavailable: true,
  };
}
test("WAL base must precede all genuine worker claims", () => {
  const f = fixture();
  assert.throws(() => assertBeforeInflightClaims(f.snapshot));
  const before = structuredClone(f.snapshot);
  for (const row of [
    ...before.rows.RenderJob,
    ...before.rows.MediaGeneration,
  ]) {
    row.runToken = null;
    row.heartbeatAt = null;
  }
  before.rows.RenderJob[0].status = "QUEUED";
  before.rows.MediaGeneration[1].state = "QUEUED";
  assertBeforeInflightClaims(before);
});
test("WAL-target admission binds exact claims, provider receipt, retained set and source outage", () => {
  const f = fixture();
  assert.equal(assertInflightWalAdmission(f), true);
  for (const changed of [
    { targetLsn: "0/DEAD" },
    { walArchiveSha256: sha("other") },
    { baseSnapshotSha256: physicalCaptureHash(f.snapshot) },
    { restoredMarkers: [2, 3] },
    { sourceUnavailable: false },
    { objects: [] },
    {
      barrier: {
        ...f.barrier,
        media: { ...f.barrier.media, submissionAttempts: 2 },
      },
    },
  ])
    assert.throws(() => assertInflightWalAdmission({ ...f, ...changed }));
});
test("recovered fixture reads original external receipts without submitting new effects", async () => {
  const reads = [];
  const receipt = {
    acceptedCalls: 1,
    submissionAttempts: 1,
    requestSha256: sha("accepted"),
  };
  const server = createRecoveryProvider({
    readReceipt: async (path) => {
      reads.push(path);
      return receipt;
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.deepEqual(
      await (await fetch(base + "/worker-barriers/0123456789abcdef")).json(),
      receipt,
    );
    assert.deepEqual(
      await (
        await fetch(base + "/historical-effects/history-0123456789abcdef")
      ).json(),
      receipt,
    );
    for (const path of [
      "/worker-media/0123456789abcdef",
      "/historical-effects",
      "/worker-barriers/0123456789abcdef/render",
    ])
      assert.equal(
        (await fetch(base + path, { method: "POST", body: "{}" })).status,
        405,
      );
    assert.equal(reads.length, 2);
    assert.deepEqual(await (await fetch(base + "/stats")).json(), {});
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("missing original provider receipts fail closed in the recovered fixture", async () => {
  const server = createRecoveryProvider({
    readReceipt: async () => {
      throw Error("Original provider unavailable");
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${address.port}/worker-barriers/0123456789abcdef`,
        )
      ).status,
      503,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
