// Local native verification with one generated tmpfs PostgreSQL container.
// No .env is loaded, no ports or persistent volumes are attached.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  applicationMigrations,
  applicationSeed,
  applicationAtTarget,
  applicationAfterTarget,
  applicationSnapshot,
  verifyRestoredApplication,
} from "./application-pitr-fixture.mjs";
import { withHistoricalRecoveryPrerequisites } from "./historical-recovery-gate.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureDockerEnv, checksum, redact } from "./compose-verification.mjs";
import {
  assertPitrProject,
  assertPitrCase,
  withVerifiedPhysicalBackup,
  nativeStartExit,
  waitForPromotedSql,
} from "./postgres-pitr-verification.mjs";
export async function runPostgresPitr({ hooks } = {}) {
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
    taskId: "RECOVERY-01F",
    verificationMode: "native-physical-base-backup-wal-pitr",
    passed: false,
    startedAt: new Date().toISOString(),
    project,
    checks: {},
    liveProvidersCalled: false,
    publicDeployment: false,
  };
  const interrupt = () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, interrupt);
  function docker(args, input, raw = false) {
    return new Promise((resolve, reject) => {
      if (interrupted && !cleaningUp)
        return reject(new Error("Native recovery verification interrupted."));
      const child = spawn(
        "docker",
        [
          process.platform === "win32"
            ? "--host=npipe:////./pipe/dockerDesktopLinuxEngine"
            : "--host=unix:///var/run/docker.sock",
          ...args,
        ],
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
      hooks?.sqlTransform ? hooks.sqlTransform(sql) : sql,
    );
  }
  const shell = (script) =>
    docker(["exec", "-i", "-u", "postgres", id, "sh", "-eu"], script);
  const verify = (directory) =>
    docker(["exec", "-u", "postgres", id, "pg_verifybackup", directory]);
  async function prepare(kind, target, archive, base = "base") {
    await owned();
    const directory = `/fixture/${kind}`;
    assertPitrCase(project, kind, directory);
    await shell(`rm -rf ${directory}
cp -a /fixture/${base} ${directory}
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
    const startup =
      kind === "retry"
        ? 'pg_ctl -D "$1" -l "$2" -t 20 -w start'
        : 'timeout 20 postgres -D "$1" >>"$2" 2>&1';
    return async () => {
      const output = await docker([
        "exec",
        "-u",
        "postgres",
        id,
        "sh",
        "-c",
        startup +
          '; result=$?; printf "\\nOMOS_NATIVE_START_EXIT=%s\\n" "$result"; exit 0',
        "omos-native-start",
        directory,
        `/fixture/${kind}.log`,
      ]);
      const code = nativeStartExit(output);
      report.nativeStartExitCodes ??= {};
      report.nativeStartExitCodes[kind] = code;
      report.nativeStartOutputs ??= {};
      report.nativeStartOutputs[kind] = output;
      assert.equal(code, 0, `Native PostgreSQL startup exited ${code}`);
      return output;
    };
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
    assert.equal(
      Object.keys(inspect[0].HostConfig.PortBindings ?? {}).length,
      0,
    );
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
    const migrations = applicationMigrations(root);
    for (const migration of migrations) await psql("source", migration.sql);
    await psql("source", applicationSeed);
    if (hooks?.prepareApplication)
      await hooks.prepareApplication({ query: (sql) => psql("source", sql) });
    const applicationBase = await applicationSnapshot((sql) =>
      psql("source", sql),
    );
    report.application = {
      appliedMigrationSqlFiles: migrations.length,
      migrationHashes: migrations.map(({ name, sha256 }) => ({ name, sha256 })),
      prismaDeployClaimed: false,
    };
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
      files: Number(
        (await shell("find /fixture/base -type f | wc -l\n")).trim(),
      ),
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
    await psql("source", applicationAtTarget);
    let capture, beforeTarget;
    if (hooks) {
      for (const name of ["beforeTarget", "afterTarget", "recovered"])
        assert.equal(typeof hooks[name], "function");
      beforeTarget = await applicationSnapshot((sql) => psql("source", sql));
      capture = await hooks.beforeTarget({
        physicalProject: project,
        targetName: target,
        baseBackupManifestSha256: report.baseBackup.manifestSha256,
        applicationSnapshot: beforeTarget,
      });
      assert.match(capture.captureSha256, /^[a-f0-9]{64}$/);
    }
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
    const applicationTarget = await applicationSnapshot((sql) =>
      psql("source", sql),
    );
    const pointReceipt = hooks
      ? {
          physicalProject: project,
          targetName: target,
          baseBackupManifestSha256: report.baseBackup.manifestSha256,
          captureSha256: capture.captureSha256,
          targetLsn,
          capturedBeforeNamedTarget: true,
        }
      : null;
    if (hooks) assert.deepEqual(applicationTarget, beforeTarget);
    assert.notDeepEqual(applicationTarget, applicationBase);
    await psql(
      "source",
      "DELETE FROM synthetic_pitr_record WHERE id=1; INSERT INTO synthetic_pitr_record VALUES (3,'synthetic after target');",
    );
    const sourceAfter = (await psql("source", snapshotSql)).trim();
    await psql("source", applicationAfterTarget);
    const applicationLater = await applicationSnapshot((sql) =>
      psql("source", sql),
    );
    assert.notDeepEqual(applicationLater, applicationTarget);
    if (hooks) await hooks.afterTarget(pointReceipt);
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
    // Keep a separate, verified recovery set. The successful retry must use
    // these copies, not the live source archive or the original base path.
    await shell(
      "cp -a /fixture/base /fixture/base-retained\ncp -a /fixture/archive /fixture/archive-retained\n",
    );
    assert.match(
      await verify("/fixture/base-retained"),
      /backup successfully verified/,
    );
    const retainedManifestSha256 = (
      await shell("sha256sum /fixture/base-retained/backup_manifest\n")
    ).split(" ")[0];
    const retainedWalSha256 = (
      await shell(`sha256sum /fixture/archive-retained/${targetWal}\n`)
    ).split(" ")[0];
    assert.equal(retainedManifestSha256, report.baseBackup.manifestSha256);
    assert.equal(retainedWalSha256, report.archivedWal.sha256);
    report.retainedPhysical = {
      baseManifestSha256: retainedManifestSha256,
      targetSegment: targetWal,
      targetLsn,
      targetWalSha256: retainedWalSha256,
      nativeBackupVerified: true,
    };
    report.checks.separateRetainedBaseAndWalVerified = true;
    const retainedWalPath = `/fixture/archive-retained/${targetWal}`;
    const verifyRetainedBase = async () => {
      const manifestSha256 = (
        await shell("sha256sum /fixture/base-retained/backup_manifest\n")
      ).split(" ")[0];
      assert.equal(manifestSha256, report.retainedPhysical.baseManifestSha256);
      return {
        manifestSha256,
        output: await verify("/fixture/base-retained"),
      };
    };
    const withRetainedPhysical = (start) =>
      withVerifiedPhysicalBackup(
        async () => (await verifyRetainedBase()).output,
        async () => {
          const actual = (await shell(`sha256sum ${retainedWalPath}\n`)).split(
            " ",
          )[0];
          assert.equal(actual, report.retainedPhysical.targetWalSha256);
          return await start();
        },
      );
    await shell(`cp ${retainedWalPath} ${retainedWalPath}.saved\n`);
    let retainedStarts = 0;
    try {
      await shell(`rm ${retainedWalPath}\n`);
      await assert.rejects(
        withRetainedPhysical(() => {
          retainedStarts++;
        }),
      );
      await shell(`cp ${retainedWalPath}.saved ${retainedWalPath}\n`);
      await shell(
        `printf X | dd of=${retainedWalPath} bs=1 count=1 conv=notrunc 2>/dev/null\n`,
      );
      await assert.rejects(
        withRetainedPhysical(() => {
          retainedStarts++;
        }),
      );
    } finally {
      await shell(
        `cp ${retainedWalPath}.saved ${retainedWalPath}\nrm ${retainedWalPath}.saved\n`,
      );
    }
    assert.equal(retainedStarts, 0);
    report.checks.missingOrCorruptRetainedWalDeniesRecoveryStart = true;
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
      assert.ok(
        report.nativeStartExitCodes[kind] > 0,
        "Native failed-start exit must be observed",
      );
      assert.equal(
        report.nativeStartExitCodes[kind],
        1,
        "Expected native FATAL exit, not a supervisor timeout",
      );
      const log = await shell(`cat /fixture/${kind}.log\n`);
      assert.match(
        log,
        /recovery ended before configured recovery target was reached/,
      );
      await assert.rejects(psql(kind, "SELECT 1;"));
      assert.equal((await psql("source", snapshotSql)).trim(), sourceAfter);
      assert.deepEqual(
        await applicationSnapshot((sql) => psql("source", sql)),
        applicationLater,
      );
      report.failureCases.push({
        kind,
        startupSupervisor: "foreground-postgres-with-timeout",
        nativeExitCode: report.nativeStartExitCodes[kind],
        nativeTargetNotReachedFatal: true,
        recoveryStartExitedNonZero: true,
        sqlConnectionsRejected: true,
        sourceUnchanged: true,
      });
    }
    report.checks.missingWalAndUnreachableTargetRejectReadiness = true;
    const retry = await prepare(
      "retry",
      target,
      "archive-retained",
      "base-retained",
    );
    await withRetainedPhysical(retry);
    report.sqlReadiness = await waitForPromotedSql(() =>
      psql("retry", "SELECT NOT pg_is_in_recovery();"),
    );
    report.checks.actualPromotedSqlAdmissionBeforeSnapshot = true;
    assert.equal((await psql("retry", snapshotSql)).trim(), expected);
    assert.deepEqual(
      await applicationSnapshot((sql) => psql("retry", sql)),
      applicationTarget,
    );
    // Replay telemetry belongs to this recovery startup. A hook may cleanly
    // restart the promoted cluster to export its physical data directory.
    assert.equal(
      (
        await psql(
          "retry",
          `SELECT pg_last_wal_replay_lsn() >= '${targetLsn}'::pg_lsn;`,
        )
      ).trim(),
      "t",
    );
    report.checks.nativeReplayLsnVerifiedBeforeOptionalPhysicalExport = true;
    if (hooks) {
      report.objectBinding = await hooks.recovered({
        pointReceipt,
        retainedPhysical: report.retainedPhysical,
        verifyRetainedBase,
        readRetainedWalSha256: async () =>
          (
            await shell(`sha256sum /fixture/archive-retained/${targetWal}\n`)
          ).split(" ")[0],
        applicationSnapshot: await applicationSnapshot((sql) =>
          psql("retry", sql),
        ),
        exportPhysicalCluster: async () => {
          await owned();
          await shell("pg_ctl -D /fixture/retry -m fast -w stop\n");
          try {
            // A clean, stopped physical data directory, streamed in memory only.
            // No SQL dump, persistent host backup, or network on the native fixture.
            const bytes = await docker(
              [
                "exec",
                "-u",
                "postgres",
                id,
                "tar",
                "-C",
                "/fixture/retry",
                "-cf",
                "-",
                ".",
              ],
              undefined,
              true,
            );
            return { bytes, sha256: checksum(bytes) };
          } finally {
            const output = await shell(
              "pg_ctl -D /fixture/retry -l /fixture/retry.log -t 20 -w start\n",
            );
            assert.match(output, /server started/);
            report.sqlReadinessAfterPhysicalExport = await waitForPromotedSql(
              () => psql("retry", "SELECT NOT pg_is_in_recovery();"),
            );
          }
        },
      });
      assert.equal(report.objectBinding.passed, true);
      report.checks.preTargetHistoricalManifestMatchesPhysicalApplicationSnapshot = true;
    }
    // A restored PostgreSQL point is insufficient to start application workers.
    // This database-only prerequisite check deliberately supplies no object set,
    // even when the optional separate bucket probe ran; startup must still fail.
    let applicationStarts = 0;
    await assert.rejects(
      withHistoricalRecoveryPrerequisites(
        {
          writersIsolated: true,
          databasePoint: targetLsn,
          objectsPoint: targetLsn,
          redisKeys: 0,
          queueReconstructionReviewed: true,
          externalEffectsReconciled: true,
          referenceInventoryComplete: true,
          references: applicationTarget.rows.Asset.map((a) => ({
            key: a.objectKey,
            bytes: a.bytes,
            sha256: a.sha256,
            contentType: a.mimeType,
          })),
          objects: [],
        },
        async () => {
          applicationStarts++;
        },
      ),
      /Missing historical private object/,
    );
    assert.equal(applicationStarts, 0);
    await verifyRestoredApplication((sql) => psql("retry", sql));
    report.application.tablesCompared = Object.keys(
      applicationTarget.rows,
    ).length;
    report.application.populatedTables = Object.values(
      applicationTarget.rows,
    ).filter((rows) => rows.length).length;
    report.application.rowsCompared = Object.values(
      applicationTarget.rows,
    ).reduce((n, rows) => n + rows.length, 0);
    report.application.crossStoreAcceptance = false;
    report.application.missingHistoricalObjectsBlockedStartup = true;
    report.application.restoredConstraintsAndRevisionPredicates = true;
    report.application.httpAuthorizationClaimed =
      report.objectBinding?.checks?.restoredHttpAuthentication === true;
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
          `SELECT pg_current_wal_lsn() >= '${targetLsn}'::pg_lsn;`,
        )
      ).trim(),
      "t",
    );
    await psql(
      "retry",
      "INSERT INTO synthetic_pitr_record VALUES (4,'synthetic restored independent write');",
    );
    assert.equal((await psql("source", snapshotSql)).trim(), sourceAfter);
    assert.deepEqual(
      await applicationSnapshot((sql) => psql("source", sql)),
      applicationLater,
    );
    assert.deepEqual(applicationMigrations(root), migrations);
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
      populatedApplicationSchemaPhysicalRecovery: true,
      applicationRowsAndColumnDefinitionsMatchTarget: true,
      applicationLaterChangesExcluded: true,
      applicationSourcePreserved: true,
      historicalObjectPrerequisiteBlocksApplicationStart: true,
    });
    report.passed = true;
  } catch (error) {
    report.failure = redact(error.message, [secret]);
    report.failureLocation = redact(error.stack ?? "", [secret]);
    if (id) {
      try {
        report.failureNativeLogs = await shell(
          "for kind in missing-wal unreachable retry; do if test -f /fixture/$kind.log; then printf '%s\\n' \"$kind\"; tail -n 18 /fixture/$kind.log; fi; done\n",
        );
      } catch {}
    }
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
    for (const signal of ["SIGINT", "SIGTERM"])
      process.removeListener(signal, interrupt);
  }
  return report;
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  await runPostgresPitr();
