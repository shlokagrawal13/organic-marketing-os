// Owned disposable stores only. The provider ledger remains outside restored DB/S3.
import assert from "node:assert/strict";
import {
  assertFixtureRestoreProject,
  checksum,
} from "./compose-verification.mjs";
import { applicationSnapshot } from "./application-pitr-fixture.mjs";
import { physicalCaptureHash } from "./physical-object-binding.mjs";
import { physicalMediaIds } from "./physical-media-review.mjs";
import {
  createInflightPointReview,
  assertInflightPointAdmission,
} from "./physical-inflight-point.mjs";

const archive = "/tmp/omos_fixture_archive";
const data = "/var/lib/postgresql/data";
const hex = /^[a-f0-9]{64}$/;
const sleep = () => new Promise((resolve) => setTimeout(resolve, 500));
const sqlArgs = [
  "exec",
  "-T",
  "postgres",
  "psql",
  "-X",
  "-q",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "fixture",
  "-d",
  "postgres",
];
const claims = (snapshot) => [
  snapshot.rows.RenderJob.find((r) => r.id === physicalMediaIds.render),
  snapshot.rows.MediaGeneration.find((r) => r.id === physicalMediaIds.media),
  snapshot.rows.MediaGeneration.find(
    (r) => r.id === physicalMediaIds.ambiguous,
  ),
];
export function assertBeforeInflightClaims(snapshot) {
  const rows = claims(snapshot);
  assert.ok(rows.every((row) => row && !row.runToken && !row.heartbeatAt));
  assert.equal(rows[0].status, "QUEUED");
  assert.equal(rows[1].state, "OUTPUT_READY");
  assert.equal(rows[2].state, "QUEUED");
}
export function assertInflightWalAdmission(evidence) {
  assertInflightPointAdmission(evidence);
  const {
    walReview,
    expectedWalReviewSha256,
    baseSnapshotSha256,
    targetName,
    targetLsn,
    walArchiveSha256,
    restoredMarkers,
    sourceUnavailable,
  } = evidence;
  assert.equal(physicalCaptureHash(walReview), expectedWalReviewSha256);
  assert.equal(walReview.version, 1);
  assert.equal(walReview.inflightReviewSha256, evidence.expectedReviewSha256);
  assert.equal(walReview.baseSnapshotSha256, baseSnapshotSha256);
  assert.notEqual(baseSnapshotSha256, physicalCaptureHash(evidence.snapshot));
  assert.equal(walReview.targetName, targetName);
  assert.match(targetName, /^omos_inflight_[a-f0-9]{16}$/);
  assert.equal(walReview.targetLsn, targetLsn);
  assert.match(targetLsn, /^[0-9A-F]+\/[0-9A-F]+$/);
  assert.match(walArchiveSha256, hex);
  assert.equal(walReview.walArchiveSha256, walArchiveSha256);
  assert.deepEqual(restoredMarkers, [1, 2]);
  assert.equal(sourceUnavailable, true);
  return true;
}
export async function prepareInflightWalPoint({
  source,
  nonce,
  compose,
  sourceQuery,
}) {
  assertFixtureRestoreProject(source);
  assert.match(nonce, /^[a-f0-9]{16}$/);
  assert.equal((await sourceQuery("SHOW archive_mode;")).trim(), "on");
  await sourceQuery(
    "CREATE SCHEMA omos_inflight_wal; CREATE TABLE omos_inflight_wal.marker(id integer PRIMARY KEY); INSERT INTO omos_inflight_wal.marker VALUES(1);",
  );
  const snapshot = await applicationSnapshot(sourceQuery);
  assertBeforeInflightClaims(snapshot);
  const directory = `/tmp/omos_walbase_${nonce}`;
  const output = await compose(
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
      `pg_basebackup -h /var/run/postgresql -U fixture -D ${directory} -Fp -X stream -c fast --no-password --manifest-checksums=SHA256; pg_verifybackup ${directory}; sha256sum ${directory}/backup_manifest`,
    ],
    { quiet: true },
  );
  assert.match(output, /backup successfully verified/);
  const manifestSha256 = output.trim().split("\n").at(-1).split(/\s+/)[0];
  assert.match(manifestSha256, hex);
  const bytes = await compose(
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
  assert.deepEqual(await applicationSnapshot(sourceQuery), snapshot);
  await sourceQuery("SELECT pg_switch_wal();");
  return {
    bytes,
    manifestSha256,
    tarSha256: checksum(bytes),
    snapshotSha256: physicalCaptureHash(snapshot),
  };
}
export async function captureInflightWalPoint({
  source,
  target,
  nonce,
  prepared,
  barrier,
  compose,
  command,
  config,
  node,
  sourceQuery,
  recoverApplication,
}) {
  assertFixtureRestoreProject(source);
  assertFixtureRestoreProject(target);
  assert.notEqual(source, target);
  assert.match(nonce, /^[a-f0-9]{16}$/);
  const query = (sql) => compose(target, sqlArgs, { input: sql, quiet: true });
  const shell = (project, script) =>
    compose(
      project,
      ["exec", "-T", "-u", "postgres", "postgres", "sh", "-eu", "-c", script],
      { quiet: true },
    );
  const targetRun = (script, options = {}) =>
    compose(
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
        script,
      ],
      { quiet: true, ...options },
    );
  const snapshot = await applicationSnapshot(sourceQuery);
  const objects = (await node(source, "physical-app-preflight", {}, false))
    .objects;
  const targetName = `omos_inflight_${nonce}`;
  await sourceQuery("INSERT INTO omos_inflight_wal.marker VALUES(2);");
  const targetLsn = (
    await sourceQuery(`SELECT pg_create_restore_point('${targetName}');`)
  ).trim();
  const targetSegment = (
    await sourceQuery(`SELECT pg_walfile_name('${targetLsn}'::pg_lsn);`)
  ).trim();
  assert.match(targetSegment, /^[0-9A-F]{24}$/);
  const timeline = Number(
    (
      await sourceQuery("SELECT timeline_id FROM pg_control_checkpoint();")
    ).trim(),
  );
  assert.ok(Number.isSafeInteger(timeline) && timeline > 0);
  await sourceQuery(
    "DELETE FROM omos_inflight_wal.marker WHERE id=1; INSERT INTO omos_inflight_wal.marker VALUES(3); SELECT pg_switch_wal();",
  );
  let archived = false;
  for (let i = 0; i < 100; i++) {
    try {
      await shell(source, `test -s ${archive}/${targetSegment}`);
      archived = true;
      break;
    } catch {
      await sleep();
    }
  }
  assert.ok(archived, "Live-claim WAL target was not archived");
  const targetWalSha256 = (
    await shell(source, `sha256sum ${archive}/${targetSegment}`)
  )
    .trim()
    .split(/\s+/)[0];
  assert.match(targetWalSha256, hex);
  const walBytes = await compose(
    source,
    [
      "exec",
      "-T",
      "-u",
      "postgres",
      "postgres",
      "tar",
      "-C",
      archive,
      "-cf",
      "-",
      ".",
    ],
    { raw: true, quiet: true },
  );
  assert.ok(walBytes.length > 0 && walBytes.length < 512 * 1024 * 1024);
  const walArchiveSha256 = checksum(walBytes);
  assert.deepEqual(await applicationSnapshot(sourceQuery), snapshot);
  const review = createInflightPointReview({
    snapshot,
    objects,
    barrier,
    backupManifestSha256: prepared.manifestSha256,
    backupTarSha256: prepared.tarSha256,
  });
  const expectedReviewSha256 = physicalCaptureHash(review);
  const walReview = {
    version: 1,
    inflightReviewSha256: expectedReviewSha256,
    baseSnapshotSha256: prepared.snapshotSha256,
    targetName,
    targetLsn,
    timeline,
    targetSegment,
    targetWalSha256,
    walArchiveSha256,
  };
  const expectedWalReviewSha256 = physicalCaptureHash(walReview);
  const cfg = await config(target);
  await compose(target, ["create", "--no-build", "postgres"], { quiet: true });
  const volume = JSON.parse(
    await command(["volume", "inspect", cfg.volumes.postgres_data.name], {
      quiet: true,
    }),
  )[0];
  assert.equal(volume.Labels["com.docker.compose.project"], target);
  const imported = await targetRun(
    `test -z "$(ls -A ${data})"; mkdir ${data}/pgdata; cat >/tmp/base.tar; sha256sum /tmp/base.tar; tar -C ${data}/pgdata -xf /tmp/base.tar; chown -R postgres:postgres ${data}; chmod 700 ${data}/pgdata`,
    { input: prepared.bytes },
  );
  assert.equal(imported.trim().split(/\s+/)[0], prepared.tarSha256);
  const walImported = await targetRun(
    `mkdir ${data}/retained-wal; cat >/tmp/wal.tar; sha256sum /tmp/wal.tar; tar -C ${data}/retained-wal -xf /tmp/wal.tar; chown -R postgres:postgres ${data}/retained-wal`,
    { input: walBytes },
  );
  assert.equal(walImported.trim().split(/\s+/)[0], walArchiveSha256);
  const packet = JSON.stringify({ walReview, review, barrier });
  const receiptHash = checksum(Buffer.from(packet));
  const receiptOutput = await targetRun(
    `cat >${data}/retained-receipt.json; sha256sum ${data}/retained-receipt.json; chown postgres:postgres ${data}/retained-receipt.json`,
    { input: packet },
  );
  assert.equal(receiptOutput.trim().split(/\s+/)[0], receiptHash);
  const retainedWalPath = `${data}/retained-wal/${targetSegment}`;
  const verifySet = async (start) => {
    const result = await targetRun(
      `su postgres -c 'pg_verifybackup ${data}/pgdata'; sha256sum ${data}/pgdata/backup_manifest ${retainedWalPath} ${data}/retained-receipt.json`,
    );
    assert.match(result, /backup successfully verified/);
    assert.deepEqual(
      result
        .trim()
        .split("\n")
        .slice(-3)
        .map((line) => line.split(/\s+/)[0]),
      [prepared.manifestSha256, targetWalSha256, receiptHash],
    );
    return await start();
  };
  let nativeStarts = 0;
  await targetRun(`cp ${retainedWalPath} ${retainedWalPath}.saved`);
  try {
    await targetRun(`rm ${retainedWalPath}`);
    await assert.rejects(verifySet(() => nativeStarts++));
    await targetRun(
      `cp ${retainedWalPath}.saved ${retainedWalPath}; printf X | dd of=${retainedWalPath} bs=1 count=1 conv=notrunc 2>/dev/null`,
    );
    await assert.rejects(verifySet(() => nativeStarts++));
  } finally {
    await targetRun(
      `cp ${retainedWalPath}.saved ${retainedWalPath}; rm ${retainedWalPath}.saved; chown postgres:postgres ${retainedWalPath}`,
    );
  }
  assert.equal(nativeStarts, 0);
  await verifySet(async () => {
    nativeStarts++;
    await targetRun(
      `cat >>${data}/pgdata/postgresql.conf <<'CONFIG'\narchive_mode = off\nrestore_command = 'cp ${data}/retained-wal/%f %p'\nrecovery_target_name = '${targetName}'\nrecovery_target_timeline = '${timeline}'\nrecovery_target_action = 'promote'\nhot_standby = off\nCONFIG\ntouch ${data}/pgdata/recovery.signal; chown -R postgres:postgres ${data}/pgdata`,
    );
  });
  assert.equal(nativeStarts, 1);
  let sourceStopped = false,
    connected = false;
  const providerId = (
    await compose(source, ["ps", "-q", "fixture-provider"], { quiet: true })
  ).trim();
  const provider = JSON.parse(
    await command(["inspect", providerId], { quiet: true }),
  )[0];
  assert.equal(provider.Config.Labels["com.docker.compose.project"], source);
  let applicationRecovery;
  try {
    await command(
      [
        "network",
        "connect",
        "--alias",
        "provider-receipts",
        cfg.networks.default.name,
        providerId,
      ],
      { quiet: true },
    );
    connected = true;
    sourceStopped = true;
    await compose(source, ["stop", "--timeout", "10", "postgres", "storage"], {
      quiet: true,
    });
    const stopped = (
      await compose(source, ["ps", "--all", "--format", "json"], {
        quiet: true,
      })
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .flatMap((s) => JSON.parse(s));
    for (const service of ["postgres", "storage"])
      assert.ok(
        stopped.some(
          (row) => row.Service === service && row.State === "exited",
        ),
      );
    await assert.rejects(sourceQuery("SELECT 1;"));
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
    let restored;
    for (let i = 0; i < 100; i++) {
      try {
        assert.equal(
          (await query("SELECT NOT pg_is_in_recovery();")).trim(),
          "t",
        );
        restored = await applicationSnapshot(query);
        break;
      } catch (error) {
        if (i === 99) throw error;
        await sleep();
      }
    }
    assert.deepEqual(restored, snapshot);
    assert.equal(
      (
        await query(
          `SELECT pg_last_wal_replay_lsn() >= '${targetLsn}'::pg_lsn;`,
        )
      ).trim(),
      "t",
    );
    assert.ok(
      Number(
        (
          await query("SELECT timeline_id FROM pg_control_checkpoint();")
        ).trim(),
      ) > timeline,
    );
    const restoredMarkers = JSON.parse(
      (
        await query(
          "SELECT json_agg(id ORDER BY id) FROM omos_inflight_wal.marker;",
        )
      ).trim(),
    );
    assert.deepEqual(restoredMarkers, [1, 2]);
    const restoredObjects = (
      await node(target, "physical-app-objects", { objects }, false)
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
      .flatMap((s) => JSON.parse(s));
    const writersAbsent = !running.some((row) =>
      ["api", "web", "worker", "render-worker", "media-worker"].includes(
        row.Service,
      ),
    );
    const readback = (
      await shell(target, `sha256sum ${data}/retained-receipt.json`)
    )
      .trim()
      .split(/\s+/)[0];
    assert.equal(readback, receiptHash);
    const evidence = {
      snapshot: restored,
      objects: restoredObjects,
      barrier,
      review,
      expectedReviewSha256,
      backupManifestSha256: prepared.manifestSha256,
      backupTarSha256: prepared.tarSha256,
      redisKeys,
      writersAbsent,
      walReview,
      expectedWalReviewSha256,
      baseSnapshotSha256: prepared.snapshotSha256,
      targetName,
      targetLsn,
      walArchiveSha256,
      restoredMarkers,
      sourceUnavailable: true,
    };
    let callbacks = 0;
    for (const changed of [
      { targetName: `omos_inflight_${"0".repeat(16)}` },
      { targetLsn: "0/DEAD" },
      { walArchiveSha256: "0".repeat(64) },
      { baseSnapshotSha256: physicalCaptureHash(restored) },
      { restoredMarkers: [2, 3] },
      { sourceUnavailable: false },
      { objects: [] },
      { redisKeys: 1 },
      { writersAbsent: false },
      {
        barrier: {
          ...barrier,
          media: { ...barrier.media, submissionAttempts: 2 },
        },
      },
    ])
      assert.throws(() => {
        assertInflightWalAdmission({ ...evidence, ...changed });
        callbacks++;
      });
    assert.equal(callbacks, 0);
    assertInflightWalAdmission(evidence);
    callbacks++;
    applicationRecovery = await recoverApplication({
      snapshot: restored,
      barrier,
      query,
    });
    assert.equal(applicationRecovery.passed, true);
    return {
      passed: true,
      baseSnapshotSha256: prepared.snapshotSha256,
      targetSnapshotSha256: physicalCaptureHash(snapshot),
      restoredSnapshotSha256: physicalCaptureHash(restored),
      targetName,
      targetLsn,
      sourceTimeline: timeline,
      targetSegment,
      targetWalSha256,
      walArchiveSha256,
      receiptHash,
      expectedWalReviewSha256,
      historicalObjects: objects.length,
      admissionControlsDenied: 10,
      admissionCallbacks: callbacks,
      actualWalFaultsDenied: 2,
      sourcePostgresAndStorageStopped: true,
      applicationRecovery,
      checks: {
        liveClaimsAbsentFromBasePresentAtWalTarget: true,
        actualNativeWalReplayAndPromotion: true,
        postTargetMarkersExcluded: true,
        independentFixtureStoresRecoverDuringSourceOutage: true,
        actualProviderReceiptBoundWithoutResubmission: true,
        restoredApplicationWorkersVerified: true,
      },
    };
  } finally {
    await compose(
      target,
      [
        "stop",
        "--timeout",
        "10",
        "api",
        "web",
        "worker",
        "render-worker",
        "media-worker",
      ],
      { quiet: true },
    );
    if (connected)
      await command(
        ["network", "disconnect", cfg.networks.default.name, providerId],
        { quiet: true },
      );
    if (sourceStopped) {
      await compose(
        source,
        ["up", "-d", "--no-build", "--no-deps", "postgres", "storage"],
        { quiet: true },
      );
      for (let i = 0; i < 100; i++) {
        try {
          assert.deepEqual(await applicationSnapshot(sourceQuery), snapshot);
          break;
        } catch (error) {
          if (i === 99) throw error;
          await sleep();
        }
      }
    }
  }
}
