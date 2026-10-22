// Isolated harness admission only; not a production recovery controller.
import assert from "node:assert/strict";
import {
  assertPhysicalCapture,
  physicalCaptureHash,
} from "./physical-object-binding.mjs";
import { withHistoricalRecoveryPrerequisites } from "./historical-recovery-gate.mjs";
import { withReconciledHistoricalEffects } from "./historical-effect-reconciliation.mjs";

export const physicalApplicationIds = {
  "pitr-a": "7cdd0796-a51e-442a-aab9-111111111111",
  "pitr-b": "7cdd0796-a51e-442a-aab9-222222222222",
  "pitr-asset": "7cdd0796-a51e-442a-aab9-333333333333",
  "pitr-draft": "7cdd0796-a51e-442a-aab9-444444444444",
  "pitr-other": "7cdd0796-a51e-442a-aab9-555555555555",
};
export function physicalApplicationSql(sql) {
  for (const [name, id] of Object.entries(physicalApplicationIds))
    sql = sql.replaceAll(`'${name}'`, `'${id}'`);
  return sql.replaceAll(
    "pitr-a/historical.png",
    `${physicalApplicationIds["pitr-a"]}/historical.png`,
  );
}
export function physicalQueueInventory(snapshot) {
  return Object.fromEntries(
    [
      "AIJob",
      "RenderJob",
      "MediaGeneration",
      "PublicationAttempt",
      "PublicationSchedule",
      "PublicationIntent",
    ].map((table) => {
      assert.ok(
        Array.isArray(snapshot.rows[table]),
        `Missing ${table} inventory`,
      );
      return [
        table,
        snapshot.rows[table]
          .map(({ id, status, state, requestKey }) => ({
            id,
            ...(status ? { status } : {}),
            ...(state ? { state } : {}),
            ...(requestKey ? { requestKey } : {}),
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ];
    }),
  );
}
export function physicalEffectRequestHash(job) {
  return physicalCaptureHash({
    id: job.id,
    requestKey: job.requestKey,
    task: job.task,
    input: job.input,
  });
}
export function physicalLedgerBaseline(rows) {
  return [...rows]
    .sort((a, b) => a.sequence - b.sequence)
    .map((row) => {
      // Prisma DateTime uses UTC for this fixture's timestamp-without-time-zone.
      // Host-local Date parsing would shift Windows/India timestamps by 5:30.
      assert.match(
        row.createdAt,
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?$/,
      );
      return { ...row, createdAt: new Date(row.createdAt + "Z").toISOString() };
    });
}
export async function withPhysicalApplicationStart(evidence, start) {
  assertPhysicalCapture(evidence);
  assert.match(evidence.physicalCopySha256, /^[a-f0-9]{64}$/);
  assert.equal(
    evidence.importedPhysicalCopySha256,
    evidence.physicalCopySha256,
    "Physical transfer changed",
  );
  assert.equal(
    evidence.importedSnapshotSha256,
    physicalCaptureHash(evidence.applicationSnapshot),
    "Imported physical rows changed",
  );
  assert.deepEqual(
    evidence.queueInventory,
    physicalQueueInventory(evidence.applicationSnapshot),
    "Queue inventory differs from recovered rows",
  );
  assert.equal(evidence.effects.databasePoint, evidence.pointReceipt.targetLsn);
  for (const table of [
    "RenderJob",
    "MediaGeneration",
    "PublicationAttempt",
    "PublicationSchedule",
    "PublicationIntent",
  ])
    assert.equal(
      evidence.queueInventory[table].length,
      0,
      `Unreviewed ${table} jobs in bounded physical fixture`,
    );
  const running = evidence.queueInventory.AIJob.filter(
    (j) => j.status === "RUNNING",
  )
    .map((j) => j.id)
    .sort();
  assert.deepEqual(
    evidence.effects.effects.map((e) => e.jobId).sort(),
    running,
    "Running provider jobs need an explicit effect inventory",
  );
  assert.equal(evidence.effects.effects.length, running.length);
  for (const effect of evidence.effects.effects) {
    const job = evidence.applicationSnapshot.rows.AIJob.find(
      (j) => j.id === effect.jobId,
    );
    assert.equal(
      effect.requestHash,
      physicalEffectRequestHash(job),
      "Effect request differs from recovered job",
    );
  }
  assert.deepEqual(
    evidence.objects.map((o) => o.key).sort(),
    evidence.manifest.objects.map((o) => o.key).sort(),
    "Application bucket inventory changed",
  );
  return withReconciledHistoricalEffects(evidence.effects, () =>
    withHistoricalRecoveryPrerequisites(
      {
        writersIsolated: evidence.writersIsolated,
        databasePoint: evidence.pointReceipt.targetLsn,
        objectsPoint: evidence.pointReceipt.targetLsn,
        redisKeys: evidence.redisKeys,
        queueReconstructionReviewed: evidence.queueReconstructionReviewed,
        externalEffectsReconciled: true,
        referenceInventoryComplete: true,
        references: evidence.manifest.objects.map((o) => ({
          ...o,
          contentType: o.contentType,
        })),
        objects: evidence.objects,
      },
      start,
    ),
  );
}
