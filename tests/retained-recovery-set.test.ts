import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  createRetainedRecoveryReview,
  withRetainedRecoverySet,
} from "../scripts/retained-recovery-set.mjs";
import { physicalCaptureHash } from "../scripts/physical-object-binding.mjs";

const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const bytes = Buffer.from("retained-private-image");
  const snapshot = {
    rows: {
      Asset: [
        {
          id: "asset-1",
          organizationId: "org-1",
          objectKey: "org-1/historical.png",
          bytes: bytes.length,
          sha256: sha(bytes),
        },
      ],
      RenderSegment: [],
      RenderJob: [],
      MediaGeneration: [],
    },
  };
  const version = {
    key: "synthetic/org-1/historical.png",
    sourceKey: "org-1/historical.png",
    versionId: "v-1",
    bytes: bytes.length,
    sha256: sha(bytes),
    contentType: "image/png",
    cacheControl: "private, no-store",
    metadata: { fixture: "test" },
  };
  const baseManifestSha256 = sha("physical-base-manifest");
  const manifest = {
    physicalProject: "omos-pitr-verify-0123456789abcdef",
    targetName: "omos_fixture_target",
    baseBackupManifestSha256: baseManifestSha256,
    applicationSnapshotSha256: physicalCaptureHash(snapshot),
    references: [
      {
        entity: "Asset",
        id: "asset-1",
        organizationId: "org-1",
        field: "objectKey",
        key: "org-1/historical.png",
        bytes: bytes.length,
        sha256: sha(bytes),
      },
    ],
    objects: [
      {
        key: version.sourceKey,
        bytes: version.bytes,
        sha256: version.sha256,
        contentType: version.contentType,
        cacheControl: version.cacheControl,
        metadata: version.metadata,
      },
    ],
    versions: [version],
  };
  const pointReceipt = {
    physicalProject: manifest.physicalProject,
    targetName: manifest.targetName,
    baseBackupManifestSha256: baseManifestSha256,
    captureSha256: physicalCaptureHash(manifest),
    targetLsn: "0/17A4B08",
    capturedBeforeNamedTarget: true,
  };
  const retainedPhysical = {
    baseManifestSha256,
    targetSegment: "000000010000000000000001",
    targetLsn: pointReceipt.targetLsn,
    targetWalSha256: sha("wal-segment"),
    nativeBackupVerified: true,
  };
  const effects = {
    databasePoint: pointReceipt.targetLsn,
    inventoryComplete: true,
    receipts: [
      {
        databasePoint: pointReceipt.targetLsn,
        disposition: "DO_NOT_REPLAY",
        reviewed: true,
      },
    ],
  };
  const review = createRetainedRecoveryReview({
    manifest,
    pointReceipt,
    applicationSnapshot: snapshot,
    retainedPhysical,
    effects,
  });
  return {
    review,
    expectedReviewSha256: physicalCaptureHash(review),
    manifest,
    pointReceipt,
    applicationSnapshot: snapshot,
    retainedPhysical,
    effects,
    verifyRetainedBase: async () => ({
      manifestSha256: baseManifestSha256,
      output: "backup successfully verified",
    }),
    readRetainedWalSha256: async () => retainedPhysical.targetWalSha256,
    readHistoricalObjects: async () => [
      {
        ...version,
        key: version.sourceKey,
        body: bytes.toString("base64"),
      },
    ],
    restoredObjects: [{ key: version.sourceKey, bytes }],
    redisKeys: 0,
    writersAbsent: true,
  };
}

test("retained recovery set admits exact base, WAL, versioned bytes and reviewed effects", async () => {
  let starts = 0;
  assert.equal(
    await withRetainedRecoverySet(fixture(), async () => ++starts),
    1,
  );
  assert.equal(starts, 1);
});

test("retained recovery set denies missing or changed physical bytes before startup", async () => {
  const f = fixture();
  let starts = 0;
  for (const changed of [
    {
      verifyRetainedBase: async () => ({
        manifestSha256: f.retainedPhysical.baseManifestSha256,
        output: "verification failed",
      }),
    },
    {
      verifyRetainedBase: async () => ({
        manifestSha256: sha("substituted-valid-base"),
        output: "backup successfully verified",
      }),
    },
    { readRetainedWalSha256: async () => sha("changed") },
    { pointReceipt: { ...f.pointReceipt, targetLsn: "0/DEAD" } },
    {
      retainedPhysical: {
        ...f.retainedPhysical,
        baseManifestSha256: sha("changed"),
      },
    },
  ])
    await assert.rejects(
      withRetainedRecoverySet({ ...f, ...changed }, async () => ++starts),
    );
  assert.equal(starts, 0);
});

test("retained recovery set denies missing historical versions, target bytes and replay", async () => {
  const f = fixture();
  let starts = 0;
  for (const changed of [
    { readHistoricalObjects: async () => [] },
    {
      restoredObjects: [
        { key: f.restoredObjects[0].key, bytes: Buffer.from("bad") },
      ],
    },
    {
      effects: {
        ...f.effects,
        receipts: [{ ...f.effects.receipts[0], disposition: "REPLAY" }],
      },
    },
    { redisKeys: 1 },
    { writersAbsent: false },
  ])
    await assert.rejects(
      withRetainedRecoverySet({ ...f, ...changed }, async () => ++starts),
    );
  assert.equal(starts, 0);
});
