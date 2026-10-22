import assert from "node:assert/strict";
import { test } from "node:test";
import {
  withPhysicalApplicationStart,
  physicalQueueInventory,
  physicalApplicationSql,
  physicalApplicationIds,
  physicalEffectRequestHash,
  physicalLedgerBaseline,
} from "../scripts/physical-application-start.mjs";
import {
  physicalCaptureHash,
  physicalApplicationReferences,
  bytesHash,
} from "../scripts/physical-object-binding.mjs";
function packet(extraRows = {}) {
  const applicationSnapshot = {
    rows: {
      Asset: [
        {
          id: "asset",
          organizationId: "org",
          objectKey: "private/key",
          bytes: 3,
          sha256: bytesHash(Buffer.from("old")),
        },
      ],
      RenderSegment: [],
      RenderJob: [],
      MediaGeneration: [],
      PublicationAttempt: [],
      PublicationSchedule: [],
      PublicationIntent: [],
      AIJob: [
        { id: "uncertain", status: "RUNNING" },
        { id: "queued", status: "QUEUED" },
      ],
    },
    schema: [],
  };
  Object.assign(applicationSnapshot.rows, extraRows);
  const objects = [
    {
      key: "private/key",
      bytes: 3,
      sha256: bytesHash(Buffer.from("old")),
      contentType: "image/png",
    },
  ];
  const manifest = {
    physicalProject: "omos-pitr-verify-0123456789abcdef",
    targetName: "omos_fixture_target",
    baseBackupManifestSha256: "a".repeat(64),
    applicationSnapshotSha256: physicalCaptureHash(applicationSnapshot),
    references: physicalApplicationReferences(applicationSnapshot),
    objects,
  };
  const pointReceipt = {
    physicalProject: manifest.physicalProject,
    targetName: manifest.targetName,
    baseBackupManifestSha256: manifest.baseBackupManifestSha256,
    captureSha256: physicalCaptureHash(manifest),
    targetLsn: "0/ABC",
    capturedBeforeNamedTarget: true,
  };
  const effect = {
    jobId: "uncertain",
    operationId: "operation",
    requestHash: physicalEffectRequestHash(applicationSnapshot.rows.AIJob[0]),
    provider: "synthetic",
    providerOperationId: "accepted",
    happenedAfterPoint: true,
  };
  return {
    applicationSnapshot,
    manifest,
    pointReceipt,
    expectedPointReceiptSha256: physicalCaptureHash(pointReceipt),
    physicalCopySha256: "b".repeat(64),
    importedPhysicalCopySha256: "b".repeat(64),
    importedSnapshotSha256: physicalCaptureHash(applicationSnapshot),
    queueInventory: physicalQueueInventory(applicationSnapshot),
    objects: objects.map((o) => ({ ...o, bytes: Buffer.from("old") })),
    redisKeys: 0,
    writersIsolated: true,
    queueReconstructionReviewed: true,
    effects: {
      databasePoint: "0/ABC",
      inventoryComplete: true,
      effects: [effect],
      receipts: [
        {
          ...effect,
          databasePoint: "0/ABC",
          disposition: "DO_NOT_REPLAY",
          evidenceKind: "PROVIDER_CONFIRMED",
          reviewed: true,
        },
      ],
    },
  };
}
test("Physical application starts once with exact transfer, snapshot, objects, empty Redis and reviewed effect", async () => {
  let calls = 0;
  await withPhysicalApplicationStart(packet(), async () => {
    calls++;
  });
  assert.equal(calls, 1);
});
test("Physical application rejects altered transfer or imported rows before startup", async () => {
  for (const change of [
    { importedPhysicalCopySha256: "c".repeat(64) },
    { importedSnapshotSha256: "c".repeat(64) },
  ])
    await assert.rejects(
      withPhysicalApplicationStart({ ...packet(), ...change }, async () =>
        assert.fail("started"),
      ),
    );
});
test("Physical application rejects missing changed extra or duplicate private objects", async () => {
  const p = packet();
  for (const objects of [
    [],
    [{ ...p.objects[0], bytes: Buffer.from("new") }],
    [...p.objects, p.objects[0]],
    [{ ...p.objects[0], key: "other" }],
  ])
    await assert.rejects(
      withPhysicalApplicationStart({ ...p, objects }, async () =>
        assert.fail("started"),
      ),
    );
});
test("Physical application rejects current Redis, active writers and unreviewed queue reconstruction", async () => {
  for (const change of [
    { redisKeys: 1 },
    { writersIsolated: false },
    { queueReconstructionReviewed: false },
  ])
    await assert.rejects(
      withPhysicalApplicationStart({ ...packet(), ...change }, async () =>
        assert.fail("started"),
      ),
    );
});
test("Physical application requires complete exact recovered queue and running effect inventories", async () => {
  const p = packet();
  for (const change of [
    { queueInventory: { ...p.queueInventory, AIJob: [] } },
    {
      effects: {
        ...p.effects,
        effects: [{ ...p.effects.effects[0], jobId: "another" }],
      },
    },
    { effects: { ...p.effects, inventoryComplete: false } },
  ])
    await assert.rejects(
      withPhysicalApplicationStart({ ...p, ...change }, async () =>
        assert.fail("started"),
      ),
    );
  assert.throws(() => physicalQueueInventory({ rows: {} }));
  for (const table of [
    "RenderJob",
    "MediaGeneration",
    "PublicationAttempt",
    "PublicationSchedule",
    "PublicationIntent",
  ])
    await assert.rejects(
      withPhysicalApplicationStart(
        packet({ [table]: [{ id: "unreviewed", status: "QUEUED" }] }),
        async () => assert.fail("started"),
      ),
      /Unreviewed/,
    );
  const altered = { ...p.effects.effects[0], requestHash: "different" };
  await assert.rejects(
    withPhysicalApplicationStart(
      {
        ...p,
        effects: {
          ...p.effects,
          effects: [altered],
          receipts: [{ ...p.effects.receipts[0], requestHash: "different" }],
        },
      },
      async () => assert.fail("started"),
    ),
    /Effect request differs/,
  );
});
test("Physical application rejects missing unknown replay unreviewed and wrong-point receipts", async () => {
  const p = packet(),
    r = p.effects.receipts[0];
  for (const receipts of [
    [],
    [{ ...r, operationId: "unknown" }],
    [{ ...r, disposition: "REPLAY" }],
    [{ ...r, reviewed: false }],
    [{ ...r, databasePoint: "0/DEF" }],
  ])
    await assert.rejects(
      withPhysicalApplicationStart(
        { ...p, effects: { ...p.effects, receipts } },
        async () => assert.fail("started"),
      ),
    );
});
test("Physical application SQL variant only replaces complete synthetic identities and the historical key", () => {
  const sql =
    "SELECT 'pitr-a','pitr-asset','pitr-a/historical.png','pitr-owner@example.test','pitr-job';";
  const result = physicalApplicationSql(sql);
  assert.ok(result.includes(physicalApplicationIds["pitr-a"]));
  assert.ok(result.includes(physicalApplicationIds["pitr-asset"]));
  assert.ok(result.includes("pitr-owner@example.test"));
  assert.ok(result.includes("'pitr-job'"));
  assert.ok(
    result.includes(physicalApplicationIds["pitr-a"] + "/historical.png"),
  );
});
test("Physical immutable-ledger comparison preserves UTC timestamps across host timezones", () => {
  const before = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Kolkata", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      const row = {
        id: "old",
        sequence: 1,
        reason: "unchanged",
        createdAt: "2026-10-22T12:56:02.106",
      };
      assert.deepEqual(physicalLedgerBaseline([row]), [
        { ...row, createdAt: "2026-10-22T12:56:02.106Z" },
      ]);
      assert.equal(row.createdAt, "2026-10-22T12:56:02.106");
    }
    assert.throws(() =>
      physicalLedgerBaseline([{ sequence: 1, createdAt: "invalid" }]),
    );
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});
