// Local native verification with one generated tmpfs PostgreSQL container.
// No .env is loaded, no ports or persistent volumes are attached.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  fixtureProject,
  assertFixtureRestoreProject,
  fixtureDockerEnv,
  checksum,
  redact,
} from "./compose-verification.mjs";
import {
  restoreBarrierSql,
  restoreApplicationName,
  verifyInterruptedRestore,
} from "./postgres-restore-verification.mjs";
if (process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Native recovery tests require MOS_ALLOW_NATIVE_TESTS=isolated-test-services.",
  );
const root = resolve(import.meta.dirname, ".."),
  project = fixtureProject(randomBytes(8).toString("hex"), true),
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
  taskId: "RECOVERY-01A",
  verificationMode: "standalone-native-postgres-interruption",
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
  assertFixtureRestoreProject(project);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(
    (
      await docker([
        "inspect",
        id,
        "--format",
        '{{index .Config.Labels "omos.restore-fixture"}}',
      ])
    ).trim(),
    project,
  );
}
function psql(database, sql) {
  return docker(
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
    sql,
  );
}
try {
  id = (
    await docker([
      "run",
      "--rm",
      "-d",
      "--name",
      project + "-postgres",
      "--label",
      `omos.restore-fixture=${project}`,
      "--network",
      "none",
      "--tmpfs",
      "/var/lib/postgresql/data",
      "-e",
      "POSTGRES_USER=fixture",
      "-e",
      `POSTGRES_PASSWORD=${secret}`,
      "-e",
      "POSTGRES_DB=fixture_source",
      "postgres:17-alpine",
    ])
  ).trim();
  await owned();
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      await docker([
        "exec",
        id,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "fixture",
        "-d",
        "fixture_source",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, "Disposable PostgreSQL did not become ready.");
  report.postgresVersion = (
    await docker(["exec", id, "postgres", "--version"])
  ).trim();
  await psql(
    "fixture_source",
    `CREATE TABLE public.synthetic_record (id integer PRIMARY KEY, value jsonb NOT NULL); INSERT INTO public.synthetic_record VALUES (1,'{"kind":"synthetic account"}'),(2,'{"kind":"synthetic private media reference"}'),(3,'{"kind":"synthetic review"}');\n${restoreBarrierSql}`,
  );
  const sourceRows = (
    await psql(
      "fixture_source",
      "SELECT json_agg(t ORDER BY id) FROM public.synthetic_record t;",
    )
  ).trim();
  const dump = await docker(
    [
      "exec",
      "-i",
      id,
      "pg_dump",
      "-U",
      "fixture",
      "-d",
      "fixture_source",
      "-Fc",
    ],
    undefined,
    true,
  );
  assert.ok(dump.length > 1000);
  report.databaseDump = { bytes: dump.length, sha256: checksum(dump) };
  const reset = async () => {
    await owned();
    await docker([
      "exec",
      id,
      "dropdb",
      "-U",
      "fixture",
      "--if-exists",
      "--force",
      "fixture_restore",
    ]);
    await docker(["exec", id, "createdb", "-U", "fixture", "fixture_restore"]);
  };
  const restore = (atomic) =>
    docker(
      [
        "exec",
        "-i",
        "-e",
        `PGAPPNAME=${restoreApplicationName}`,
        id,
        "pg_restore",
        "-U",
        "fixture",
        "-d",
        "fixture_restore",
        "--exit-on-error",
        ...(atomic ? ["--single-transaction"] : []),
      ],
      dump,
    );
  report.interruption = await verifyInterruptedRestore({
    project,
    query: (sql) => psql("fixture_restore", sql),
    reset,
    setPause: (on) =>
      psql(
        "postgres",
        `ALTER DATABASE fixture_restore SET omos.fixture_restore_pause = '${on ? "on" : "off"}';`,
      ),
    restore,
    progress: (name) => console.log("POSTGRES RECOVERY CHECK: " + name),
  });
  Object.assign(report.checks, report.interruption.checks);
  await restore(true);
  assert.equal(
    (
      await psql(
        "fixture_restore",
        "SELECT json_agg(t ORDER BY id) FROM public.synthetic_record t;",
      )
    ).trim(),
    sourceRows,
  );
  assert.equal(
    (
      await psql(
        "fixture_restore",
        "SELECT count(*) FROM omos_restore_fixture.barrier;",
      )
    ).trim(),
    "1",
  );
  assert.equal(
    (
      await psql(
        "fixture_source",
        "SELECT json_agg(t ORDER BY id) FROM public.synthetic_record t;",
      )
    ).trim(),
    sourceRows,
  );
  report.checks.cleanAtomicRetryRestoresAllSyntheticRows = true;
  report.checks.sourceRecordsUnchanged = true;
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
  const after = existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null;
  report.checks.realEnvironmentUnchanged = beforeEnv === after;
  if (beforeEnv !== after) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.completedAt = new Date().toISOString();
  mkdirSync(resolve(root, ".local"), { recursive: true });
  writeFileSync(
    resolve(root, ".local/postgres-recovery-evidence.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
