// Actual Prisma migrate deploy/resolve against generated native PostgreSQL only.
// Private fixture packages prevent Prisma from discovering the real root .env.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  realpathSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { createRequire } from "node:module";
import { checksum, fixtureDockerEnv, redact } from "./compose-verification.mjs";
import {
  assertUpgradeFixture,
  assertPreservedRows,
} from "./prisma-upgrade-verification.mjs";

if (process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Native upgrades require MOS_ALLOW_NATIVE_TESTS=isolated-test-services.",
  );
const root = resolve(import.meta.dirname, ".."),
  nonce = randomBytes(8).toString("hex"),
  project = `omos-upgrade-verify-${nonce}`,
  secret = randomBytes(32).toString("hex"),
  privateRoot = resolve(root, ".local/native-upgrade", nonce),
  cli = join(
    dirname(createRequire(import.meta.url).resolve("prisma/package.json")),
    "build/index.js",
  ),
  env = fixtureDockerEnv(process.env),
  children = new Set(),
  realEnv = join(root, ".env"),
  envHash = () =>
    existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null,
  beforeEnv = envHash(),
  migrations = readdirSync(join(root, "prisma/migrations"))
    .filter((n) => /^\d/.test(n))
    .sort(),
  protectedPaths = [
    "docs/MASTER_SPEC.md",
    ...migrations.map((n) => `prisma/migrations/${n}/migration.sql`),
  ],
  protectedHashes = () =>
    Object.fromEntries(
      protectedPaths.map((p) => [p, checksum(readFileSync(join(root, p)))]),
    ),
  beforeHashes = protectedHashes();
assert.equal(
  migrations.length,
  24,
  "Review predecessor boundaries when adding application migrations.",
);
mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
assert.equal(realpathSync(privateRoot), privateRoot);
const report = {
  schemaVersion: 1,
  taskId: "RECOVERY-01B",
  verificationMode: "native-populated-prisma-upgrade-and-migration-recovery",
  passed: false,
  startedAt: new Date().toISOString(),
  project,
  boundaries: [],
  cases: [],
  checks: {},
  liveProvidersCalled: false,
  publicDeployment: false,
  prismaVersion: JSON.parse(
    readFileSync(
      createRequire(import.meta.url).resolve("prisma/package.json"),
      "utf8",
    ),
  ).version,
};
let id,
  networkId,
  port,
  interrupted = false,
  cleaningUp = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function run(
  command,
  args,
  {
    input,
    cwd = root,
    childEnv = env,
    allowFailure = false,
    timeout = 90000,
  } = {},
) {
  return new Promise((accept, reject) => {
    if (interrupted && !cleaningUp)
      return reject(new Error("Native upgrade interrupted."));
    const child = spawn(command, args, {
      cwd,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.add(child);
    const out = [],
      err = [],
      timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      clearTimeout(timer);
      children.delete(child);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      children.delete(child);
      const result = {
        code,
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(err).toString(),
      };
      if (code === 0 || allowFailure) accept(result);
      else
        reject(
          new Error(
            redact(
              `${command} failed (${code}): ${result.stdout.slice(-1500)} ${result.stderr.slice(-2500)}`,
              [secret],
            ),
          ),
        );
    });
    child.stdin.end(input);
  });
}
const dockerResult = (args, opts) =>
  run("docker", ["--host=unix:///var/run/docker.sock", ...args], opts);
const docker = async (args, opts) => (await dockerResult(args, opts)).stdout;
async function owned() {
  assert.match(project, /^omos-upgrade-verify-[0-9a-f]{16}$/);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(
    (
      await docker([
        "inspect",
        id,
        "--format",
        '{{index .Config.Labels "omos.upgrade-fixture"}}',
      ])
    ).trim(),
    project,
  );
}
async function sql(database, text, allowFailure = false) {
  assert.ok(
    ["postgres", "fixture_upgrade", "fixture_fault"].includes(database),
  );
  await owned();
  return dockerResult(
    [
      "exec",
      "-i",
      id,
      "psql",
      "-X",
      "-q",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "fixture",
      "-d",
      database,
    ],
    { input: text, allowFailure },
  );
}
const query = async (database, text) =>
  (await sql(database, text)).stdout.trim();
function packageFor(kind) {
  const dir = join(privateRoot, kind),
    schemaDir = join(dir, "prisma");
  mkdirSync(join(schemaDir, "migrations"), { recursive: true, mode: 0o700 });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      private: true,
      name: "isolated-upgrade-fixture",
      prisma: { schema: "prisma/schema.prisma" },
    }),
  );
  copyFileSync(
    join(root, "prisma/schema.prisma"),
    join(schemaDir, "schema.prisma"),
  );
  copyFileSync(
    join(root, "prisma/migrations/migration_lock.toml"),
    join(schemaDir, "migrations/migration_lock.toml"),
  );
  return dir;
}
function copyMigrations(dir, count) {
  for (const name of migrations.slice(0, count)) {
    const target = join(dir, "prisma/migrations", name);
    mkdirSync(target, { recursive: true });
    copyFileSync(
      join(root, "prisma/migrations", name, "migration.sql"),
      join(target, "migration.sql"),
    );
  }
}
async function prisma(kind, args, allowFailure = false) {
  const caseRoot = join(privateRoot, kind),
    database = kind === "upgrade" ? "fixture_upgrade" : "fixture_fault",
    url = `postgresql://fixture:${secret}@127.0.0.1:${port}/${database}?schema=public`;
  assertUpgradeFixture({ project, root, caseRoot, port, url, kind });
  assert.equal(realpathSync(caseRoot), caseRoot);
  assert.ok(
    !existsSync(join(caseRoot, ".env")) &&
      !existsSync(join(caseRoot, "prisma/.env")),
  );
  await owned();
  const result = await run(
    process.execPath,
    [
      cli,
      "migrate",
      ...args,
      "--schema",
      join(caseRoot, "prisma/schema.prisma"),
    ],
    {
      cwd: caseRoot,
      childEnv: {
        ...env,
        DATABASE_URL: url,
        CHECKPOINT_DISABLE: "1",
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
      allowFailure,
    },
  );
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /Environment variables loaded from/,
  );
  return result;
}
const tables = ["User", "Organization", "Membership", "ContentItem", "AIJob"];
async function snapshot(database, names = tables) {
  const result = {};
  for (const table of names)
    result[table] = JSON.parse(
      await query(
        database,
        `SELECT coalesce(json_agg(t ORDER BY to_jsonb(t)::text),'[]'::json) FROM "${table}" t;`,
      ),
    );
  return result;
}
const history = (database) =>
  query(
    database,
    "SELECT coalesce(json_agg(t ORDER BY migration_name,started_at),'[]'::json) FROM \"_prisma_migrations\" t;",
  ).then(JSON.parse);
async function verifyHistory(database, count) {
  const rows = await history(database);
  assert.equal(rows.length, count);
  assert.deepEqual(
    rows.map((r) => r.migration_name),
    migrations.slice(0, count),
  );
  for (const row of rows) {
    assert.ok(row.finished_at && !row.rolled_back_at);
    assert.equal(
      row.checksum,
      beforeHashes[`prisma/migrations/${row.migration_name}/migration.sql`],
    );
  }
  return rows;
}
async function immutable(database) {
  for (const statement of [
    'UPDATE "CreditEntry" SET "availableDelta"=99',
    'DELETE FROM "CreditEntry"',
  ]) {
    const result = await sql(database, statement, true);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Credit entries are immutable/);
  }
}
try {
  networkId = (
    await docker([
      "network",
      "create",
      "--label",
      `omos.upgrade-fixture=${project}`,
      project,
    ])
  ).trim();
  assert.match(networkId, /^[0-9a-f]{64}$/);
  id = (
    await docker([
      "run",
      "--rm",
      "-d",
      "--name",
      project + "-postgres",
      "--label",
      `omos.upgrade-fixture=${project}`,
      "--network",
      project,
      "--tmpfs",
      "/var/lib/postgresql/data",
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=fixture",
      "-e",
      `POSTGRES_PASSWORD=${secret}`,
      "-e",
      "POSTGRES_DB=fixture_upgrade",
      "postgres:17-alpine",
    ])
  ).trim();
  await owned();
  const binding = (await docker(["port", id, "5432/tcp"])).trim();
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  port = Number(binding.split(":")[1]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await dockerResult(
      [
        "exec",
        id,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "fixture",
        "-d",
        "fixture_upgrade",
      ],
      { allowFailure: true },
    );
    if (result.code === 0) {
      ready = true;
      break;
    }
    await delay(500);
  }
  assert.ok(ready, "Disposable PostgreSQL did not become ready.");
  report.postgresVersion = (
    await docker(["exec", id, "postgres", "--version"])
  ).trim();
  const upgrade = packageFor("upgrade"),
    ids = Object.fromEntries(
      ["user", "org", "content", "job", "entry", "research"].map((key) => [
        key,
        randomUUID(),
      ]),
    );
  let preserved = {};
  for (const count of [4, 7, 23, 24]) {
    copyMigrations(upgrade, count);
    await prisma("upgrade", ["deploy"]);
    await verifyHistory("fixture_upgrade", count);
    assertPreservedRows(preserved, await snapshot("fixture_upgrade"));
    if (count === 4)
      await sql(
        "fixture_upgrade",
        `
      INSERT INTO "User" (id,email,name,"passwordHash") VALUES ('${ids.user}','native-upgrade@example.test','Synthetic legacy user','fixture-only-hash');
      INSERT INTO "Organization" (id,name) VALUES ('${ids.org}','Synthetic legacy workspace');
      INSERT INTO "Membership" ("userId","organizationId",role) VALUES ('${ids.user}','${ids.org}','OWNER');
      INSERT INTO "ContentItem" (id,"organizationId",title,platform,format,body,"createdBy","updatedAt") VALUES ('${ids.content}','${ids.org}','Synthetic saved draft','LinkedIn','Text','Saved before native upgrade','${ids.user}',now());
      INSERT INTO "AIJob" (id,"organizationId","actorId","requestKey",task,input) VALUES ('${ids.job}','${ids.org}','${ids.user}','${randomUUID()}','content','{"prompt":"Synthetic queued request before upgrade"}');`,
      );
    if (count === 7) {
      await sql(
        "fixture_upgrade",
        `INSERT INTO "CreditAccount" ("organizationId",available,revision,"updatedAt") VALUES ('${ids.org}',10,1,now());
        INSERT INTO "CreditEntry" (id,"organizationId","operationKey","requestHash",kind,"availableDelta","reservedDelta","availableAfter","reservedAfter",sequence,reference,reason)
        VALUES ('${ids.entry}','${ids.org}','native-upgrade-grant','synthetic-hash','GRANT',10,0,10,0,1,'fixture','Synthetic pre-upgrade grant');`,
      );
      tables.push("CreditAccount", "CreditEntry");
    }
    if (count === 23) {
      await sql(
        "fixture_upgrade",
        `INSERT INTO "ResearchRecord" (id,"organizationId",title,category,"temporalScope",summary,"authorizedSource","createdBy","updatedAt") VALUES ('${ids.research}','${ids.org}','Synthetic legacy observation','INDUSTRY','HISTORICAL','Saved before insight column',true,'${ids.user}',now());`,
      );
      tables.push("ResearchRecord");
    }
    const current = await snapshot("fixture_upgrade");
    assertPreservedRows(preserved, current);
    preserved = current;
    report.boundaries.push({
      appliedMigrations: count,
      legacyTables: tables.length,
      rowValuesPreserved: true,
      prismaChecksumsVerified: true,
    });
    console.log(`NATIVE UPGRADE CHECK: predecessor ${count}/24 preserved`);
  }
  assert.equal(preserved.AIJob[0].brandContext, null);
  assert.equal(preserved.AIJob[0].status, "QUEUED");
  assert.equal(preserved.ResearchRecord[0].insight, null);
  await immutable("fixture_upgrade");
  const baselineHistory = await verifyHistory("fixture_upgrade", 24);
  for (const atomic of [false, true]) {
    const kind = atomic ? "fault-atomic" : "fault-default",
      caseRoot = packageFor(kind),
      name = `209901010001_fixture_${atomic ? "atomic" : "default"}`;
    copyMigrations(caseRoot, 24);
    await owned();
    await docker([
      "exec",
      id,
      "dropdb",
      "-U",
      "fixture",
      "--if-exists",
      "--force",
      "fixture_fault",
    ]);
    await docker([
      "exec",
      id,
      "createdb",
      "-U",
      "fixture",
      "--template",
      "fixture_upgrade",
      "fixture_fault",
    ]);
    const migrationDir = join(caseRoot, "prisma/migrations", name);
    mkdirSync(migrationDir);
    const probeSql = `${atomic ? "BEGIN;\n" : ""}CREATE SCHEMA omos_migration_fixture;
CREATE TABLE omos_migration_fixture.prefix (id integer PRIMARY KEY);
INSERT INTO omos_migration_fixture.prefix VALUES (1);
DO $$ BEGIN IF current_setting('omos.fixture_migration_pause',true)='on' THEN PERFORM pg_sleep(120); END IF; END $$; -- omos_fixture_migration_pause
CREATE TABLE omos_migration_fixture.tail (id integer PRIMARY KEY);
INSERT INTO omos_migration_fixture.tail VALUES (2);
${atomic ? "COMMIT;\n" : ""}`;
    const sqlPath = join(migrationDir, "migration.sql");
    writeFileSync(sqlPath, probeSql);
    const probeHash = checksum(probeSql);
    await sql(
      "postgres",
      "ALTER DATABASE fixture_fault SET omos.fixture_migration_pause = 'on';",
    );
    const pending = prisma(kind, ["deploy"], true);
    pending.catch(() => {});
    let pid;
    try {
      for (let attempt = 0; attempt < 150; attempt++) {
        const paused = await query(
          "fixture_fault",
          "SELECT coalesce(json_agg(pid),'[]'::json) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event='PgSleep' AND query LIKE '%omos_fixture_migration_pause%';",
        );
        const matches = JSON.parse(paused);
        assert.ok(matches.length <= 1);
        if (matches.length) {
          [pid] = matches;
          break;
        }
        await delay(200);
      }
      assert.ok(
        Number.isInteger(pid),
        "Real Prisma migration did not reach the SQL pause barrier.",
      );
      const visible = () =>
        query(
          "fixture_fault",
          "SELECT count(*) FROM pg_tables WHERE schemaname='omos_migration_fixture';",
        ).then(Number);
      const during = await visible();
      assert.equal(
        await query("fixture_fault", `SELECT pg_terminate_backend(${pid});`),
        "t",
      );
      const failed = await pending;
      assert.notEqual(failed.code, 0);
      const after = await visible();
      if (atomic) {
        assert.equal(during, 0);
        assert.equal(after, 0);
      }
      const failedHistory = await history("fixture_fault"),
        failedRow = failedHistory.find((r) => r.migration_name === name);
      assert.equal(failedHistory.length, 25);
      assert.ok(
        failedRow && !failedRow.finished_at && !failedRow.rolled_back_at,
      );
      assert.deepEqual(
        failedHistory.filter((r) => r.migration_name !== name),
        baselineHistory,
      );
      assertPreservedRows(preserved, await snapshot("fixture_fault"));
      const blocked = await prisma(kind, ["deploy"], true);
      assert.notEqual(blocked.code, 0);
      assert.match(blocked.stdout + blocked.stderr, /P3009/);
      assert.deepEqual(await history("fixture_fault"), failedHistory);
      // Operator-style recovery is restricted to the synthetic probe schema.
      // Existing application migrations and SQL bytes are never edited.
      await sql(
        "fixture_fault",
        "DROP SCHEMA IF EXISTS omos_migration_fixture CASCADE;",
      );
      await sql(
        "postgres",
        "ALTER DATABASE fixture_fault SET omos.fixture_migration_pause = 'off';",
      );
      await prisma(kind, ["resolve", "--rolled-back", name]);
      assert.equal(checksum(readFileSync(sqlPath)), probeHash);
      await prisma(kind, ["deploy"]);
      const recovered = await history("fixture_fault"),
        attempts = recovered.filter((r) => r.migration_name === name);
      assert.equal(recovered.length, 26);
      assert.equal(attempts.length, 2);
      assert.ok(
        attempts.some(
          (r) => r.id === failedRow.id && r.rolled_back_at && !r.finished_at,
        ),
      );
      assert.ok(attempts.some((r) => r.finished_at && !r.rolled_back_at));
      assert.ok(attempts.every((r) => r.checksum === probeHash));
      assert.deepEqual(
        recovered.filter((r) => r.migration_name !== name),
        baselineHistory,
      );
      assert.equal(
        await query(
          "fixture_fault",
          "SELECT (SELECT sum(id) FROM omos_migration_fixture.prefix)+(SELECT sum(id) FROM omos_migration_fixture.tail);",
        ),
        "3",
      );
      assertPreservedRows(preserved, await snapshot("fixture_fault"));
      await immutable("fixture_fault");
      assert.deepEqual(await snapshot("fixture_upgrade"), preserved);
      assert.deepEqual(await history("fixture_upgrade"), baselineHistory);
      report.cases.push({
        transaction: atomic ? "explicit-BEGIN-COMMIT" : "Prisma-default-batch",
        actualBackendTerminated: true,
        visibleProbeTablesDuringPause: during,
        visibleProbeTablesAfterTermination: after,
        failedMigrationRecorded: true,
        ordinaryRetryBlockedP3009: true,
        rolledBackAttemptRetained: true,
        unchangedSqlRetrySucceeded: true,
        legacyDataAndHistoryPreserved: true,
        immutableLedgerEnforced: true,
      });
      console.log(
        `NATIVE UPGRADE CHECK: ${kind} interrupted, P3009 gated, resolve and unchanged SQL retry passed`,
      );
    } finally {
      // Wait for the subprocess before dropping any owned resource, including on
      // a barrier assertion failure (run() also enforces a hard timeout).
      if (!pid) for (const child of children) child.kill("SIGTERM");
      await pending.catch(() => {});
    }
  }
  Object.assign(report.checks, {
    populatedNativePrismaUpgrade: true,
    legacyQueuedJobAndNullDefaults: true,
    immutableLedgerEnforced: true,
    actualInterruptedMigration: true,
    failedLedgerRetryGate: true,
    explicitResolveAndUnchangedSqlRetry: true,
    sourceDatabaseUnchanged: true,
    noDotenvLoaded: true,
  });
  report.passed = true;
} catch (error) {
  report.error = redact(String(error?.stack || error), [secret]);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  cleaningUp = true;
  try {
    if (id) {
      await owned();
      await docker(["rm", "-f", id]);
    }
    if (networkId) {
      assert.equal(
        (
          await docker([
            "network",
            "inspect",
            networkId,
            "--format",
            '{{index .Labels "omos.upgrade-fixture"}}',
          ])
        ).trim(),
        project,
      );
      await docker(["network", "rm", networkId]);
    }
    report.checks.ownedContainerAndNetworkRemoved = true;
  } catch (error) {
    report.cleanupError = redact(String(error), [secret]);
    report.passed = false;
    process.exitCode = 1;
  }
  report.checks.realEnvUnchanged = envHash() === beforeEnv;
  report.checks.protectedHashesUnchanged =
    JSON.stringify(protectedHashes()) === JSON.stringify(beforeHashes);
  report.protectedFileCount = protectedPaths.length;
  if (
    !report.checks.realEnvUnchanged ||
    !report.checks.protectedHashesUnchanged
  ) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  writeFileSync(
    join(root, ".local/native-upgrade-evidence.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log("NATIVE UPGRADE EVIDENCE " + JSON.stringify(report));
}
