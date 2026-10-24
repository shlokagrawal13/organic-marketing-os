// Disposable fixture only: bind an online physical backup to actual live claims
// and the provider effect observed before that backup. No production backup API.
import assert from "node:assert/strict";
import {
  assertFixtureRestoreProject,
  checksum,
} from "./compose-verification.mjs";
import { applicationSnapshot } from "./application-pitr-fixture.mjs";
import { physicalCaptureHash } from "./physical-object-binding.mjs";
import { physicalMediaIds } from "./physical-media-review.mjs";

const hex = /^[a-f0-9]{64}$/;
const inventory = (objects) =>
  objects
    .map(({ key, body, sha256, contentType }) => {
      const bytes = Buffer.from(body, "base64");
      assert.equal(checksum(bytes), sha256);
      return { key, bytes: bytes.length, sha256, contentType };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

export function createInflightPointReview({
  snapshot,
  objects,
  barrier,
  backupManifestSha256,
  backupTarSha256,
}) {
  for (const digest of [backupManifestSha256, backupTarSha256])
    assert.match(digest, hex);
  assert.equal(barrier.media.acceptedCalls, 1);
  assert.equal(barrier.media.submissionAttempts, 1);
  assert.equal(barrier.media.responseHeld, true);
  const claims = [
    snapshot.rows.RenderJob.find((r) => r.id === physicalMediaIds.render),
    snapshot.rows.MediaGeneration.find((r) => r.id === physicalMediaIds.media),
    snapshot.rows.MediaGeneration.find(
      (r) => r.id === physicalMediaIds.ambiguous,
    ),
  ];
  assert.ok(claims.every((row) => row?.runToken && row.heartbeatAt));
  assert.deepEqual(
    claims.map((row) => checksum(Buffer.from(row.runToken))),
    barrier.claimRunTokenHashes,
  );
  assert.equal(claims[0].status, "RUNNING");
  assert.equal(claims[1].state, "OUTPUT_READY");
  assert.equal(claims[2].state, "SUBMITTING");
  const objectsAtPoint = inventory(objects);
  assert.ok(
    objectsAtPoint.some(
      (o) => o.key === barrier.barriers.find((b) => b.kind === "render")?.key,
    ),
  );
  for (const observed of barrier.barriers) {
    const item = objectsAtPoint.find((o) => o.key === observed.key);
    assert.ok(item);
    assert.equal(item.sha256, observed.sha256);
    assert.equal(item.bytes, observed.bytes);
  }
  return {
    version: 1,
    backupManifestSha256,
    backupTarSha256,
    applicationSnapshotSha256: physicalCaptureHash(snapshot),
    objectsAtPoint,
    objectsSha256: physicalCaptureHash(objectsAtPoint),
    claimRunTokenHashes: barrier.claimRunTokenHashes,
    providerEffect: {
      acceptedCalls: 1,
      submissionAttempts: 1,
      requestSha256: barrier.media.requestSha256,
      idempotencyKey: barrier.media.idempotencyKey,
      receiptSha256: physicalCaptureHash(barrier.media),
      disposition: "UNKNOWN_REVIEW_DO_NOT_REPLAY",
    },
    reviewed: true,
  };
}

export function assertInflightPointAdmission({
  snapshot,
  objects,
  barrier,
  review,
  expectedReviewSha256,
  backupManifestSha256,
  backupTarSha256,
  redisKeys,
  writersAbsent,
}) {
  assert.match(expectedReviewSha256, hex);
  assert.equal(
    physicalCaptureHash(review),
    expectedReviewSha256,
    "In-flight review changed",
  );
  assert.equal(review.version, 1);
  assert.equal(review.reviewed, true);
  assert.equal(review.backupManifestSha256, backupManifestSha256);
  assert.equal(review.backupTarSha256, backupTarSha256);
  assert.equal(review.applicationSnapshotSha256, physicalCaptureHash(snapshot));
  assert.deepEqual(review.objectsAtPoint, inventory(objects));
  assert.equal(
    review.objectsSha256,
    physicalCaptureHash(review.objectsAtPoint),
  );
  assert.deepEqual(review.claimRunTokenHashes, barrier.claimRunTokenHashes);
  assert.equal(
    review.providerEffect.receiptSha256,
    physicalCaptureHash(barrier.media),
  );
  assert.equal(
    review.providerEffect.requestSha256,
    barrier.media.requestSha256,
  );
  assert.equal(
    review.providerEffect.idempotencyKey,
    barrier.media.idempotencyKey,
  );
  assert.equal(review.providerEffect.acceptedCalls, 1);
  assert.equal(review.providerEffect.submissionAttempts, 1);
  assert.equal(
    review.providerEffect.disposition,
    "UNKNOWN_REVIEW_DO_NOT_REPLAY",
  );
  assert.equal(redisKeys, 0);
  assert.equal(writersAbsent, true);
  // Re-run all claim and exact-object checks on the restored bytes, too.
  createInflightPointReview({
    snapshot,
    objects,
    barrier,
    backupManifestSha256,
    backupTarSha256,
  });
  return true;
}

export async function captureInflightPhysicalPoint({
  source,
  target,
  nonce,
  barrier,
  compose,
  command,
  config,
  node,
  sourceQuery,
  targetQuery,
}) {
  assertFixtureRestoreProject(source);
  assertFixtureRestoreProject(target);
  assert.notEqual(source, target);
  assert.match(nonce, /^[a-f0-9]{16}$/);
  const sourceSnapshot = await applicationSnapshot(sourceQuery);
  const sourceObjects = (
    await node(source, "physical-app-preflight", {}, false)
  ).objects;
  const directory = `/tmp/omos-inflight-${nonce}`;
  const backupManifestSha256 = (
    await compose(
      source,
      [
        "exec",
        "-T",
        "-u",
        "postgres",
        "postgres",
        "sh",
        "-eu",
        "-c",
        `pg_basebackup -h /var/run/postgresql -U fixture -D ${directory} -Fp -X stream -c fast --no-password --manifest-checksums=SHA256; pg_verifybackup ${directory} >/dev/null; sha256sum ${directory}/backup_manifest`,
      ],
      { quiet: true },
    )
  )
    .trim()
    .split(/\s+/)[0];
  assert.match(backupManifestSha256, hex);
  const backup = await compose(
    source,
    [
      "exec",
      "-T",
      "-u",
      "postgres",
      "postgres",
      "tar",
      "-C",
      directory,
      "-cf",
      "-",
      ".",
    ],
    { raw: true, quiet: true },
  );
  const backupTarSha256 = checksum(backup);
  const afterBackup = await applicationSnapshot(sourceQuery);
  assert.deepEqual(
    afterBackup,
    sourceSnapshot,
    "In-flight source rows changed during online backup",
  );
  const review = createInflightPointReview({
    snapshot: sourceSnapshot,
    objects: sourceObjects,
    barrier,
    backupManifestSha256,
    backupTarSha256,
  });
  const expectedReviewSha256 = physicalCaptureHash(review);
  const targetConfig = await config(target);
  await compose(target, ["create", "--no-build", "postgres"], { quiet: true });
  const volume = JSON.parse(
    await command(
      ["volume", "inspect", targetConfig.volumes.postgres_data.name],
      { quiet: true },
    ),
  )[0];
  assert.equal(volume.Labels["com.docker.compose.project"], target);
  const imported = await compose(
    target,
    [
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "--entrypoint",
      "sh",
      "postgres",
      "-eu",
      "-c",
      'test -z "$(ls -A /var/lib/postgresql/data)"; cat >/tmp/inflight.tar; sha256sum /tmp/inflight.tar; tar -C /var/lib/postgresql/data -xf /tmp/inflight.tar; chown -R postgres:postgres /var/lib/postgresql/data; chmod 700 /var/lib/postgresql/data',
    ],
    { input: backup, quiet: true },
  );
  assert.equal(imported.trim().split(/\s+/)[0], backupTarSha256);
  await compose(
    target,
    [
      "up",
      "-d",
      "--no-build",
      "--no-deps",
      "postgres",
      "redis",
      "storage",
      "fixture-provider",
    ],
    { quiet: true },
  );
  let restoredSnapshot;
  for (let i = 0; i < 60; i++) {
    try {
      restoredSnapshot = await applicationSnapshot(targetQuery);
      break;
    } catch (error) {
      if (i === 59) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.deepEqual(restoredSnapshot, sourceSnapshot);
  const restoredObjects = (
    await node(
      target,
      "physical-app-objects",
      { objects: sourceObjects },
      false,
    )
  ).objects;
  const redisKeys = Number(
    (
      await compose(target, ["exec", "-T", "redis", "redis-cli", "DBSIZE"], {
        quiet: true,
      })
    ).trim(),
  );
  const running = (
    await compose(target, ["ps", "--all", "--format", "json"], {
      quiet: true,
    })
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const writersAbsent = !running.some((row) =>
    ["api", "worker", "render-worker", "media-worker"].includes(row.Service),
  );
  assert.equal(writersAbsent, true);
  const evidence = {
    snapshot: restoredSnapshot,
    objects: restoredObjects,
    barrier,
    review,
    expectedReviewSha256,
    backupManifestSha256,
    backupTarSha256,
    redisKeys,
    writersAbsent,
  };
  let admitted = 0;
  for (const changed of [
    {
      snapshot: {
        ...restoredSnapshot,
        rows: { ...restoredSnapshot.rows, RenderJob: [] },
      },
    },
    { objects: restoredObjects.slice(1) },
    { review: { ...review, reviewed: false } },
    {
      review: {
        ...review,
        providerEffect: { ...review.providerEffect, disposition: "REPLAY" },
      },
    },
    {
      barrier: {
        ...barrier,
        media: { ...barrier.media, submissionAttempts: 2 },
      },
    },
    { backupManifestSha256: "0".repeat(64) },
    { backupTarSha256: "0".repeat(64) },
    { redisKeys: 1 },
    { writersAbsent: false },
  ])
    await assert.rejects(
      Promise.resolve().then(() => {
        assertInflightPointAdmission({ ...evidence, ...changed });
        admitted++;
      }),
    );
  assert.equal(admitted, 0);
  assertInflightPointAdmission(evidence);
  admitted++;
  assert.equal(admitted, 1);
  return {
    backupManifestSha256,
    backupTarSha256,
    sourceSnapshotSha256: physicalCaptureHash(sourceSnapshot),
    restoredSnapshotSha256: physicalCaptureHash(restoredSnapshot),
    expectedReviewSha256,
    review,
    objectsAtPoint: review.objectsAtPoint.length,
    deniedControls: 9,
    admissionCallbacks: admitted,
    redisKeys,
    checks: {
      actualInFlightClaimsPhysicallyCaptured: true,
      acceptedProviderReceiptBoundBeforePhysicalCopy: true,
      onlineBackupNativeManifestVerified: true,
      freshPhysicalVolumeRestoredExactClaims: true,
      privateObjectsRestoredExact: true,
      changedPointAndReplayEvidenceDenied: true,
    },
  };
}
