// Local native verification with one generated tmpfs PostgreSQL container.
// No .env is loaded, no ports or persistent volumes are attached.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fixtureDockerEnv, checksum, redact } from "./compose-verification.mjs";
import {
  assertPitrProject,
  assertPitrCase,
  withVerifiedPhysicalBackup,
} from "./postgres-pitr-verification.mjs";
if (process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Native recovery tests require MOS_ALLOW_NATIVE_TESTS=isolated-test-services.",
  );
const root = resolve(import.meta.dirname, ".."),
  project = "omos-pitr-verify-" + randomBytes(8).toString("hex"),
  secret = randomBytes(32).toString("hex");
const realEnv = resolve(root, ".env"),
  beforeEnv = existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null;
const env = fixtureDockerEnv(process.env),
  children = new Set();
let id,
  interrupted = false,
  cleaningUp = false;
const report = {
  schemaVersion: 1,
  taskId: "RECOVERY-01E",
  verificationMode: "native-physical-base-backup-wal-pitr",
  passed: false,
  startedAt: new Date().toISOString(),
  project,
  checks: {},
  liveProvidersCalled: false,
  publicDeployment: false,
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  });
function docker(args, input, raw = false) {
  return new Promise((resolve, reject) => {
    if (interrupted && !cleaningUp)
      return reject(new Error("Native recovery verification interrupted."));
    const child = spawn(
      "docker",
      ["--host=unix:///var/run/docker.sock", ...args],
      { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] },
    );
    children.add(child);
    const out = [],
      err = [];
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.stdin.on("error", () => {});
    child.on("error", reject);
    child.on("close", (code) => {
      children.delete(child);
      code === 0
        ? resolve(raw ? Buffer.concat(out) : Buffer.concat(out).toString())
        : reject(
            new Error(
              redact(
                `Docker native fixture operation failed (${code}): ${Buffer.concat(err).toString().slice(-3000)}`,
                [secret],
              ),
            ),
          );
    });
    child.stdin.end(input);
  });
}
async function owned() {
  assertPitrProject(project);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(
    (
      await docker([
        "inspect",
        id,
        "--format",
        '{{index .Config.Labels "omos.pitr-fixture"}}',
      ])
    ).trim(),
    project,
  );
}
function psql(kind, sql) {
  return docker(
    [
      "exec",
      "-i",
      "-u",
      "postgres",
      id,
      "psql",
      "-X",
      "-q",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      `/fixture/socket-${kind}`,
      "-U",
      "fixture",
      "-d",
      "postgres",
    ],
    sql,
  );
}
const shell = (script) =>
  docker(["exec", "-i", "-u", "postgres", id, "sh", "-eu"], script);
const verify = (directory) =>
  docker(["exec", "-u", "postgres", id, "pg_verifybackup", directory]);
async function prepare(kind, target, archive) {
  await owned();
  const directory = `/fixture/${kind}`;
  assertPitrCase(project, kind, directory);
  await shell(`rm -rf ${directory}
cp -a /fixture/base ${directory}
mkdir -p /fixture/socket-${kind}
cat >> ${directory}/postgresql.conf <<'CONFIG'
archive_mode = off
listen_addresses = ''
unix_socket_directories = '/fixture/socket-${kind}'
hot_standby = off
restore_command = 'cp /fixture/${archive}/%f %p'
recovery_target_name = '${target}'
recovery_target_action = 'promote'
CONFIG
touch ${directory}/recovery.signal
`);
  return () =>
    docker([
      "exec",
      "-u",
      "postgres",
      id,
      "pg_ctl",
      "-D",
      directory,
      "-l",
      `/fixture/${kind}.log`,
      "-t",
      "20",
      "-w",
      "start",
    ]);
}
try {
  assertPitrProject(project);
  id = (
    await docker([
      "run",
      "--rm",
      "-d",
      "--name",
      project,
      "--label",
      `omos.pitr-fixture=${project}`,
      "--network",
      "none",
      "--tmpfs",
      "/var/lib/postgresql/data",
      "--tmpfs",
      "/fixture:rw,size=1g,mode=0700",
      "--entrypoint",
      "sh",
      "postgres:17-alpine",
      "-c",
      "exec sleep infinity",
    ])
  ).trim();
  await owned();
  const inspect = JSON.parse(await docker(["inspect", id]));
  assert.equal(inspect[0].HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(inspect[0].HostConfig.PortBindings ?? {}).length, 0);
  assert.ok(inspect[0].Mounts.every((m) => m.Type === "tmpfs"));
  report.checks.noNetworkPortsOrPersistentVolumes = true;
  await docker([
    "exec",
    "-u",
    "root",
    id,
    "chown",
    "postgres:postgres",
    "/fixture",
  ]);
  await shell(`mkdir -p /fixture/archive /fixture/archive-missing /fixture/socket-source
initdb -D /fixture/source -U fixture --auth=trust --no-locale --encoding=UTF8 --data-checksums >/fixture/init.log
cat >> /fixture/source/postgresql.conf <<'CONFIG'
listen_addresses = ''
unix_socket_directories = '/fixture/socket-source'
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /fixture/archive/%f && cp %p /fixture/archive/%f'
max_wal_senders = 3
shared_buffers = '16MB'
max_wal_size = '128MB'
min_wal_size = '32MB'
CONFIG
pg_ctl -D /fixture/source -l /fixture/source.log -t 20 -w start
`);
  report.postgresVersion = (
    await docker(["exec", id, "postgres", "--version"])
  ).trim();
  await psql(
    "source",
    "CREATE TABLE synthetic_pitr_record(id integer PRIMARY KEY, value text NOT NULL); INSERT INTO synthetic_pitr_record VALUES (1,'synthetic baseline');",
  );
  await docker([
    "exec",
    "-u",
    "postgres",
    id,
    "pg_basebackup",
    "-h",
    "/fixture/socket-source",
    "-U",
    "fixture",
    "-D",
    "/fixture/base",
    "-Fp",
    "-X",
    "stream",
    "-c",
    "fast",
    "--no-password",
    "--manifest-checksums=SHA256",
  ]);
  assert.match(await verify("/fixture/base"), /backup successfully verified/);
  report.baseBackup = {
    manifestSha256: (
      await shell("sha256sum /fixture/base/backup_manifest\n")
    ).split(" ")[0],
    files: Number((await shell("find /fixture/base -type f | wc -l\n")).trim()),
  };
  assert.ok(report.baseBackup.files > 100);
  report.checks.actualPhysicalBaseBackupAndNativeManifestVerified = true;
  // Force subsequent target transactions into a segment not captured by the base.
  await psql("source", "SELECT pg_switch_wal();");
  await psql(
    "source",
    "INSERT INTO synthetic_pitr_record VALUES (2,'synthetic before target');",
  );
  const target = "omos_fixture_target";
  const targetLsn = (
    await psql("source", `SELECT pg_create_restore_point('${target}');`)
  ).trim();
  const targetWal = (
    await psql("source", `SELECT pg_walfile_name('${targetLsn}'::pg_lsn);`)
  ).trim();
  assert.match(targetWal, /^[0-9A-F]{24}$/);
  const snapshotSql =
    "SELECT json_agg(t ORDER BY id) FROM synthetic_pitr_record t;";
  const expected = (await psql("source", snapshotSql)).trim();
  await psql(
    "source",
    "DELETE FROM synthetic_pitr_record WHERE id=1; INSERT INTO synthetic_pitr_record VALUES (3,'synthetic after target');",
  );
  const sourceAfter = (await psql("source", snapshotSql)).trim();
  assert.notEqual(expected, sourceAfter);
  await psql("source", "SELECT pg_switch_wal();");
  let archived = false;
  for (let i = 0; i < 100; i++) {
    try {
      await shell(`test -s /fixture/archive/${targetWal}\n`);
      archived = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(archived, "Target WAL was not archived.");
  report.archivedWal = {
    targetSegment: targetWal,
    targetLsn,
    sha256: (await shell(`sha256sum /fixture/archive/${targetWal}\n`)).split(
      " ",
    )[0],
  };
  report.checks.targetTransactionsArchivedAfterBaseBackup = true;
  await owned();
  assertPitrCase(project, "corrupt", "/fixture/corrupt");
  await shell(
    "cp -a /fixture/base /fixture/corrupt\nprintf '99\\n' > /fixture/corrupt/PG_VERSION\n",
  );
  let starts = 0;
  await assert.rejects(
    withVerifiedPhysicalBackup(
      () => verify("/fixture/corrupt"),
      () => {
        starts++;
      },
    ),
    /checksum|match|verification/i,
  );
  assert.equal(starts, 0);
  report.checks.corruptPhysicalBackupRejectedBeforeRecoveryStart = true;
  report.failureCases = [];
  for (const [kind, name, archive] of [
    ["missing-wal", target, "archive-missing"],
    ["unreachable", "omos_fixture_nonexistent", "archive"],
  ]) {
    const start = await prepare(kind, name, archive);
    await assert.rejects(
      withVerifiedPhysicalBackup(() => verify("/fixture/base"), start),
    );
    const log = await shell(`cat /fixture/${kind}.log\n`);
    assert.match(
      log,
      /recovery ended before configured recovery target was reached/,
    );
    await assert.rejects(psql(kind, "SELECT 1;"));
    assert.equal((await psql("source", snapshotSql)).trim(), sourceAfter);
    report.failureCases.push({
      kind,
      nativeTargetNotReachedFatal: true,
      recoveryStartExitedNonZero: true,
      sqlConnectionsRejected: true,
      sourceUnchanged: true,
    });
  }
  report.checks.missingWalAndUnreachableTargetRejectReadiness = true;
  const retry = await prepare("retry", target, "archive");
  await withVerifiedPhysicalBackup(() => verify("/fixture/base"), retry);
  assert.equal((await psql("retry", snapshotSql)).trim(), expected);
  assert.equal(
    (await psql("retry", "SELECT pg_is_in_recovery();")).trim(),
    "f",
  );
  const timeline = Number(
    (
      await psql("retry", "SELECT timeline_id FROM pg_control_checkpoint();")
    ).trim(),
  );
  assert.ok(timeline > 1);
  assert.equal(
    (
      await psql("source", "SELECT timeline_id FROM pg_control_checkpoint();")
    ).trim(),
    "1",
  );
  assert.equal(
    (
      await psql(
        "retry",
        `SELECT pg_last_wal_replay_lsn() >= '${targetLsn}'::pg_lsn;`,
      )
    ).trim(),
    "t",
  );
  await psql(
    "retry",
    "INSERT INTO synthetic_pitr_record VALUES (4,'synthetic restored independent write');",
  );
  assert.equal((await psql("source", snapshotSql)).trim(), sourceAfter);
  assert.equal(
    (await shell("sha256sum /fixture/base/backup_manifest\n")).split(" ")[0],
    report.baseBackup.manifestSha256,
  );
  assert.match(await verify("/fixture/base"), /backup successfully verified/);
  report.recovery = {
    targetRows: JSON.parse(expected).length,
    sourceRows: JSON.parse(sourceAfter).length,
    promotedTimeline: timeline,
  };
  Object.assign(report.checks, {
    sameVerifiedBaseBackupCleanRetry: true,
    namedTargetRowsRestored: true,
    laterInsertAndDeleteNotReplayed: true,
    actualWalReplayAndPromotion: true,
    restoredClusterAcceptsIndependentWrites: true,
    sourceRecordsAndTimelineUnchanged: true,
    savedBaseBackupUnchanged: true,
  });
  report.passed = true;
} catch (error) {
  report.failure = redact(error.message, [secret]);
  process.exitCode = 1;
} finally {
  cleaningUp = true;
  try {
    if (id) {
      await owned();
      await docker(["rm", "-f", id]);
    }
    report.checks.fixtureCleanup = true;
  } catch (error) {
    report.passed = false;
    process.exitCode = 1;
    report.cleanupFailure = redact(error.message, [secret]);
  }
  report.checks.realEnvironmentUnchanged =
    beforeEnv ===
    (existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null);
  if (!report.checks.realEnvironmentUnchanged) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.completedAt = new Date().toISOString();
  mkdirSync(resolve(root, ".local"), { recursive: true });
  writeFileSync(
    resolve(root, ".local/postgres-pitr-evidence.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log("POSTGRES PITR EVIDENCE " + JSON.stringify(report));
}
