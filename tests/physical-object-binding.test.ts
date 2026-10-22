import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPhysicalCapture,
  physicalCaptureHash,
  physicalApplicationReferences,
} from "../scripts/physical-object-binding.mjs";
const snapshot = {
  rows: {
    Asset: [
      {
        id: "asset",
        organizationId: "a",
        objectKey: "private/key",
        bytes: 3,
        sha256: "a".repeat(64),
      },
    ],
    RenderSegment: [],
    RenderJob: [],
    MediaGeneration: [],
    Other: [],
  },
  schema: [{ table: "Asset" }],
};
const manifest = {
  physicalProject: "omos-pitr-verify-0123456789abcdef",
  targetName: "omos_fixture_target",
  baseBackupManifestSha256: "b".repeat(64),
  applicationSnapshotSha256: physicalCaptureHash(snapshot),
  references: physicalApplicationReferences(snapshot),
  versions: [{ key: "synthetic/key", versionId: "original" }],
};
const pointReceipt = {
  physicalProject: manifest.physicalProject,
  targetName: manifest.targetName,
  baseBackupManifestSha256: manifest.baseBackupManifestSha256,
  captureSha256: physicalCaptureHash(manifest),
  targetLsn: "0/ABC",
  capturedBeforeNamedTarget: true,
};
const evidence = {
  manifest,
  pointReceipt,
  expectedPointReceiptSha256: physicalCaptureHash(pointReceipt),
  applicationSnapshot: snapshot,
};
test("Physical binding accepts an unchanged pre-target capture and exact recovered snapshot", () => {
  assert.doesNotThrow(() => assertPhysicalCapture(evidence));
});
test("Physical binding rejects changed target LSN, fixture, base, name or capture-order receipt", () => {
  for (const change of [
    { targetLsn: "0/DEF" },
    { physicalProject: "omos-pitr-verify-ffffffffffffffff" },
    { targetName: "another" },
    { baseBackupManifestSha256: "c".repeat(64) },
    { capturedBeforeNamedTarget: false },
  ])
    assert.throws(() =>
      assertPhysicalCapture({
        ...evidence,
        pointReceipt: { ...pointReceipt, ...change },
      }),
    );
  for (const change of [
    { targetLsn: "invalid" },
    { physicalProject: "production" },
    { targetName: "another" },
    { capturedBeforeNamedTarget: false },
  ]) {
    const p = { ...pointReceipt, ...change };
    assert.throws(() =>
      assertPhysicalCapture({
        ...evidence,
        pointReceipt: p,
        expectedPointReceiptSha256: physicalCaptureHash(p),
      }),
    );
  }
});
test("Physical binding rejects changes to any application row or captured column metadata", () => {
  for (const change of [
    { ...snapshot, schema: [] },
    { ...snapshot, rows: { ...snapshot.rows, Other: [{ later: true }] } },
    ...["id", "organizationId", "objectKey"].map((field) => ({
      ...snapshot,
      rows: {
        ...snapshot.rows,
        Asset: [{ ...snapshot.rows.Asset[0], [field]: "wrong" }],
      },
    })),
  ])
    assert.throws(() =>
      assertPhysicalCapture({ ...evidence, applicationSnapshot: change }),
    );
});
test("Physical binding rejects altered saved version manifests and mismatched reference inventories", () => {
  assert.throws(() =>
    assertPhysicalCapture({
      ...evidence,
      manifest: {
        ...manifest,
        versions: [{ key: "synthetic/key", versionId: "later" }],
      },
    }),
  );
  const altered = { ...manifest, references: [] },
    p = { ...pointReceipt, captureSha256: physicalCaptureHash(altered) };
  assert.throws(() =>
    assertPhysicalCapture({
      ...evidence,
      manifest: altered,
      pointReceipt: p,
      expectedPointReceiptSha256: physicalCaptureHash(p),
    }),
  );
});
test("Physical reference inventory includes all supported fields and preserves shared-key identities", () => {
  const rows = {
    ...snapshot.rows,
    RenderSegment: [
      { id: "s", organizationId: "a", objectKey: "private/key", bytes: 3 },
    ],
    RenderJob: [
      {
        id: "r",
        organizationId: "a",
        outputKey: "out",
        outputBytes: 4,
        thumbnailKey: "thumb",
        captionsKey: "captions",
      },
      { id: "empty", organizationId: "a", outputKey: null },
    ],
    MediaGeneration: [
      { id: "m", organizationId: "a", outputKey: "media" },
      { id: "empty", outputKey: null },
    ],
  };
  const refs = physicalApplicationReferences({ rows });
  assert.equal(refs.length, 6);
  assert.deepEqual(
    refs.map((r) => [r.entity, r.field]),
    [
      ["Asset", "objectKey"],
      ["RenderSegment", "objectKey"],
      ["RenderJob", "outputKey"],
      ["RenderJob", "thumbnailKey"],
      ["RenderJob", "captionsKey"],
      ["MediaGeneration", "outputKey"],
    ],
  );
});
