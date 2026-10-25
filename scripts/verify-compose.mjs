// Complete local-development Compose acceptance against generated disposable projects.
// No real .env, existing project/volume, live provider or public cloud is used.
import assert from "node:assert/strict";
import { keepVerificationAlive } from "./verification-lifecycle.mjs";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  physicalMediaIds,
  createPhysicalMediaReview,
} from "./physical-media-review.mjs";
import { interruptPhysicalWorkers } from "./physical-worker-interruption.mjs";
import { captureInflightPhysicalPoint } from "./physical-inflight-point.mjs";
import {
  createRetainedRecoveryReview,
  withRetainedRecoverySet,
} from "./retained-recovery-set.mjs";
import { runPostgresPitr } from "./verify-postgres-pitr.mjs";
import { physicalCaptureHash } from "./physical-object-binding.mjs";
import { applicationSnapshot } from "./application-pitr-fixture.mjs";
import {
  physicalApplicationIds,
  physicalApplicationSql,
  physicalQueueInventory,
  physicalEffectRequestHash,
  physicalLedgerBaseline,
  withPhysicalApplicationStart,
} from "./physical-application-start.mjs";
import {
  fixtureProject,
  assertFixtureProject,
  assertFixtureConfig,
  checksum,
  redact,
  fixtureDockerEnv,
  assertFixtureRestoreProject,
} from "./compose-verification.mjs";
import {
  restoreBarrierSql,
  restoreApplicationName,
  verifyInterruptedRestore,
} from "./postgres-restore-verification.mjs";
import {
  fixtureWriters,
  sealFixtureBackup,
  validateFixtureBackup,
  withValidatedFixtureBackup,
  invalidFixtureBackupCases,
  fixtureApplicationStartGate,
} from "./cross-store-backup-verification.mjs";
if (process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Set MOS_ALLOW_NATIVE_TESTS=isolated-test-services for disposable Compose verification.",
  );
const root = resolve(import.meta.dirname, ".."),
  suffix = randomBytes(8).toString("hex"),
  source = fixtureProject(suffix),
  restored = fixtureProject(suffix, true),
  physical = fixtureProject(randomBytes(8).toString("hex"), true),
  inflight = fixtureProject(randomBytes(8).toString("hex"), true);
const dir = resolve(root, ".local", "compose-verification", suffix);
mkdirSync(dir, { recursive: true, mode: 0o700 });
const realEnv = resolve(root, ".env"),
  beforeEnv = existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null;
const dockerEnv = fixtureDockerEnv(process.env);
const dockerBase = [
  process.platform === "win32"
    ? "--host=npipe:////./pipe/dockerDesktopLinuxEngine"
    : "--host=unix:///var/run/docker.sock",
];
const secrets = [
  randomBytes(32).toString("hex"),
  randomBytes(32).toString("hex"),
  randomBytes(32).toString("hex"),
];
const fixtureEnv = resolve(dir, "fixture.env");
writeFileSync(
  fixtureEnv,
  `NODE_ENV=development\nCOOKIE_SECURE=false\nWEB_ORIGIN=http://localhost:3000\nAPI_PORT=4000\nPOSTGRES_PASSWORD=${secrets[0]}\nENCRYPTION_KEY=${secrets[1]}\nS3_ACCESS_KEY=compose_fixture\nS3_SECRET_KEY=${secrets[2]}\nS3_BUCKET=compose-verification\nS3_REGION=us-east-1\nSMTP_HOST=mailpit\nSMTP_PORT=1025\nMAIL_FROM=Compose verification <fixture@example.test>\nAI_PRIMARY_KEY=\nAI_FALLBACK_KEY=\nYOUTUBE_LIVE_DISPATCH_ENABLED=false\nYOUTUBE_SCHEDULED_DISPATCH_ENABLED=false\nBILLING_MODE=self_hosted\n`,
  { mode: 0o600 },
);
const runtimeImage = `${source}-runtime`,
  buildImage = `${source}-build`,
  storageImage = `${source}-storage`;
const ca = process.env.CODEX_PROXY_CERT;
const override = {
  services: {
    "fixture-provider": {
      image: runtimeImage,
      command: [
        "node",
        "--input-type=module",
        "-e",
        readFileSync(
          resolve(root, "scripts/compose-recovery-provider.mjs"),
          "utf8",
        ) + "\ncreateRecoveryProvider().listen(4999, '0.0.0.0');",
      ],
      healthcheck: {
        test: [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:4999/stats').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        interval: "1s",
        timeout: "3s",
        retries: 20,
      },
    },
    storage: {
      image: storageImage,
      build: { context: root, dockerfile: "Dockerfile.minio" },
    },
    migrate: { image: buildImage, env_file: [fixtureEnv] },
    api: {
      image: runtimeImage,
      env_file: [fixtureEnv],
      ports: ["127.0.0.1::4000"],
    },
    web: { image: runtimeImage, ports: ["127.0.0.1::3000"] },
    worker: {
      image: runtimeImage,
      env_file: [fixtureEnv],
      depends_on: { "fixture-provider": { condition: "service_healthy" } },
      environment: {
        AI_PRIMARY_URL: "http://fixture-provider:4999",
        AI_PRIMARY_MODEL: "synthetic-compose-recovery",
        AI_PRIMARY_KEY: "synthetic-compose-provider-key",
        AI_FALLBACK_KEY: "",
      },
    },
    "render-worker": { image: runtimeImage, env_file: [fixtureEnv] },
    "media-worker": { image: runtimeImage, env_file: [fixtureEnv] },
    mailpit: { ports: ["127.0.0.1::1025", "127.0.0.1::8025"] },
  },
};
if (ca) {
  assert.ok(existsSync(ca));
  override.secrets = { proxy_ca: { file: ca } };
  for (const service of [
    "storage",
    "migrate",
    "api",
    "web",
    "worker",
    "render-worker",
    "media-worker",
  ]) {
    override.services[service].build ??= { context: root };
    override.services[service].build.secrets = ["proxy_ca"];
  }
}
// Compose's explicit !override prevents inherited ports/env_file from leaking
// fixed host bindings or the real source tree's .env into this fixture.
const overridePath = resolve(dir, "compose.override.yaml");
let yaml = "services:\n";
for (const [name, value] of Object.entries(override.services)) {
  yaml += `  ${name}:\n`;
  for (const [key, item] of Object.entries(value))
    yaml += `    ${key}: ${["ports", "env_file"].includes(key) ? "!override " : ""}${JSON.stringify(item)}\n`;
}
if (override.secrets) yaml += `secrets: ${JSON.stringify(override.secrets)}\n`;
writeFileSync(overridePath, yaml, { mode: 0o600 });
const physicalOverridePath = resolve(dir, "physical.override.yaml");
writeFileSync(
  physicalOverridePath,
  `services:\n  postgres:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U fixture -d postgres"]\n` +
    ["api", "worker", "render-worker", "media-worker"]
      .map(
        (name) =>
          `  ${name}:\n${name === "api" ? "    ports: !override []\n" : ""}    environment:\n      DATABASE_URL: postgresql://fixture@postgres:5432/postgres?schema=public\n`,
      )
      .join("") +
    "  web:\n    ports: !override []\n  mailpit:\n    ports: !override []\n" +
    "networks:\n  default:\n    internal: true\n",
  { mode: 0o600 },
);
const fixtureScript = readFileSync(
  resolve(root, "scripts/verify-compose-fixture.mjs"),
  "utf8",
);
const recoveryModule =
  "data:text/javascript;base64," +
  Buffer.from(
    readFileSync(resolve(root, "scripts/compose-recovery-fixture.mjs"), "utf8"),
  ).toString("base64");
const objectModule =
  "data:text/javascript;base64," +
  Buffer.from(
    readFileSync(resolve(root, "scripts/private-object-restore.mjs"), "utf8"),
  ).toString("base64");
const inlineModule = (name) =>
  "data:text/javascript;base64," +
  Buffer.from(readFileSync(resolve(root, "scripts", name), "utf8")).toString(
    "base64",
  );
const historyModule = inlineModule("compose-historical-recovery-fixture.mjs");
const applicationBindingModule = inlineModule("application-object-binding.mjs");
const physicalBindingModule = inlineModule("physical-object-binding.mjs");
const physicalObjectsModule = inlineModule("physical-object-fixture.mjs");
const physicalApplicationModule = inlineModule(
  "physical-application-fixture.mjs",
);
const physicalMediaModule = inlineModule("physical-media-fixture.mjs");
const historyObjectsModule = inlineModule("historical-object-verification.mjs");
const historyEffectsModule = inlineModule(
  "historical-effect-reconciliation.mjs",
);
const report = {
  schemaVersion: 1,
  taskId: "RECOVERY-01O",
  baselineTaskId: "RECOVERY-01D",
  passed: false,
  startedAt: new Date().toISOString(),
  sourceProject: source,
  restoreProject: restored,
  liveProvidersCalled: false,
  publicDeployment: false,
  checks: {},
  steps: [],
};
const configurationOnly = process.argv.includes("--config-only");
report.verificationMode = configurationOnly
  ? "configuration-only"
  : "complete-compose-native-restore";
const children = new Set();
let interrupted = false,
  cleaningUp = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  });
function command(args, { input, raw = false, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    if (interrupted && !cleaningUp)
      return reject(
        new Error("Verification interrupted; cleaning generated fixtures."),
      );
    const child = spawn("docker", [...dockerBase, ...args], {
      cwd: root,
      env: { ...dockerEnv, COMPOSE_PARALLEL_LIMIT: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = [],
      err = [];
    children.add(child);
    child.stdin.on("error", () => {});
    child.stdout.on("data", (b) => {
      out.push(b);
      if (!quiet && !raw) process.stdout.write(redact(b, secrets));
    });
    child.stderr.on("data", (b) => {
      err.push(b);
      if (!quiet) process.stderr.write(redact(b, secrets));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      children.delete(child);
      code === 0
        ? resolve(raw ? Buffer.concat(out) : Buffer.concat(out).toString())
        : reject(
            new Error(
              redact(
                `Docker operation failed (${code}): ${Buffer.concat(err)
                  .toString()
                  .replace(
                    /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
                    "[injected fixture module]",
                  )
                  .slice(-5000)}`,
                secrets,
              ),
            ),
          );
    });
    child.stdin.end(input ?? undefined);
  });
}
function compose(project, args, options) {
  assertFixtureProject(project);
  return command(
    [
      "compose",
      "--project-name",
      project,
      "--env-file",
      fixtureEnv,
      "--file",
      resolve(root, "compose.yaml"),
      "--file",
      overridePath,
      ...([physical, inflight].includes(project)
        ? ["--file", physicalOverridePath]
        : []),
      ...args,
    ],
    options,
  );
}
async function phase(name, fn) {
  if (interrupted) throw new Error("Verification interrupted.");
  console.log(`COMPOSE CHECK: ${name}`);
  const start = Date.now();
  try {
    const result = await fn();
    if (interrupted) throw new Error("Verification interrupted.");
    report.steps.push({ name, passed: true, durationMs: Date.now() - start });
    return result;
  } catch (error) {
    report.steps.push({ name, passed: false, durationMs: Date.now() - start });
    throw error;
  }
}
async function config(project) {
  const value = JSON.parse(
    await compose(
      project,
      ["config", "--no-env-resolution", "--format", "json"],
      { quiet: true },
    ),
  );
  assertFixtureConfig(value, project, fixtureEnv);
  return value;
}
function postgresSql(project, database, sql) {
  return compose(
    project,
    [
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
      "marketing",
      "-d",
      database,
    ],
    { input: sql, quiet: true },
  );
}
async function resetRestoreDatabase() {
  assertFixtureRestoreProject(restored);
  const cfg = await config(restored);
  const labels = JSON.parse(
    await command(
      [
        "volume",
        "inspect",
        cfg.volumes.postgres_data.name,
        "--format",
        "{{json .Labels}}",
      ],
      { quiet: true },
    ),
  );
  assert.equal(labels["com.docker.compose.project"], restored);
  await compose(
    restored,
    [
      "exec",
      "-T",
      "postgres",
      "dropdb",
      "-U",
      "marketing",
      "--force",
      "marketing",
    ],
    { quiet: true },
  );
  await compose(
    restored,
    ["exec", "-T", "postgres", "createdb", "-U", "marketing", "marketing"],
    { quiet: true },
  );
}
function restoreDatabase(dump, atomic) {
  assertFixtureRestoreProject(restored);
  return compose(
    restored,
    [
      "exec",
      "-T",
      "-e",
      `PGAPPNAME=${restoreApplicationName}`,
      "postgres",
      "pg_restore",
      "-U",
      "marketing",
      "-d",
      "marketing",
      "--exit-on-error",
      ...(atomic ? ["--single-transaction"] : []),
    ],
    { input: dump, quiet: true },
  );
}
async function node(project, mode, state = {}, running = true) {
  const args = running
    ? [
        "exec",
        "-T",
        "-e",
        `COMPOSE_VERIFY_MODE=${mode}`,
        "api",
        "node",
        "--input-type=module",
      ]
    : [
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "-e",
        `COMPOSE_VERIFY_MODE=${mode}`,
        "api",
        "node",
        "--input-type=module",
      ];
  return JSON.parse(
    await compose(project, args, {
      input: `globalThis.__composeObjects=await import(${JSON.stringify(objectModule)});\n globalThis.__composeRecovery=(await import(${JSON.stringify(recoveryModule)})).runComposeRecovery;\nglobalThis.__composeHistory=(await import(${JSON.stringify(historyModule)})).runHistoricalRecovery;\nglobalThis.__historyObjects=(await import(${JSON.stringify(historyObjectsModule)})).withVerifiedHistoricalObjects;\nglobalThis.__historyEffects=(await import(${JSON.stringify(historyEffectsModule)})).withReconciledHistoricalEffects;\nglobalThis.__applicationBinding=await import(${JSON.stringify(applicationBindingModule)});\nglobalThis.__physicalBinding=await import(${JSON.stringify(physicalBindingModule)});\nglobalThis.__physicalObjects=(await import(${JSON.stringify(physicalObjectsModule)})).runPhysicalObjects;\nglobalThis.__physicalApplication=(await import(${JSON.stringify(physicalApplicationModule)})).runPhysicalApplication;\nglobalThis.__physicalMedia=(await import(${JSON.stringify(physicalMediaModule)})).runPhysicalMedia;\nglobalThis.__composeFixtureState=${JSON.stringify(state)};\n${fixtureScript}`,
      quiet: true,
    }),
  );
}
async function port(project, service, target) {
  return Number(
    (await compose(project, ["port", service, String(target)], { quiet: true }))
      .trim()
      .split(":")
      .at(-1),
  );
}
async function ready(project) {
  if (project === physical) {
    for (let i = 0; i < 120; i++) {
      try {
        await compose(
          project,
          [
            "exec",
            "-T",
            "api",
            "node",
            "-e",
            "Promise.all(['http://api:4000/api/health','http://web:3000','http://web:3000/api/health'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('Physical application not ready')})).catch(()=>process.exit(1))",
          ],
          { quiet: true },
        );
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw Error(
      "Internal physical application API/web/proxy did not become ready",
    );
  }
  const apiPort = await port(project, "api", 4000),
    webPort = await port(project, "web", 3000);
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${apiPort}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        const web = await fetch(`http://127.0.0.1:${webPort}`, {
          signal: AbortSignal.timeout(2000),
        });
        const proxy = await fetch(`http://127.0.0.1:${webPort}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (web.ok && proxy.ok) return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Compose API/web did not become ready.");
}
async function cleanup(project) {
  // Inspect labels before any destructive cleanup, using only the generated identity.
  const cfg = await config(project);
  for (const volume of Object.values(cfg.volumes || {})) {
    const inspected = await command(
      [
        "volume",
        "ls",
        "--filter",
        `name=^${volume.name}$`,
        "--format",
        "{{.Name}}",
      ],
      { quiet: true },
    );
    if (inspected.trim()) {
      const labels = JSON.parse(
        await command(
          ["volume", "inspect", volume.name, "--format", "{{json .Labels}}"],
          { quiet: true },
        ),
      );
      assert.equal(labels["com.docker.compose.project"], project);
    }
  }
  await compose(
    project,
    ["down", "--volumes", "--remove-orphans", "--timeout", "10"],
    { quiet: true },
  );
}
const releaseLifecycle = keepVerificationAlive();
try {
  await phase("isolated configuration", async () => {
    await config(source);
    await config(restored);
    const physicalConfig = await config(physical);
    assert.equal(physicalConfig.networks.default.internal, true);
    for (const service of Object.values(physicalConfig.services))
      assert.equal(service.ports?.length ?? 0, 0);
    report.checks.generatedProjectPrivateEnvAndVolumeIsolation = true;
  });
  if (!configurationOnly) {
    await phase("build application images", async () => {
      await compose(source, ["build", "migrate"]);
      await compose(source, ["build", "api"]);
    });
    await phase("build official pinned MinIO release", () =>
      compose(source, ["build", "storage"]),
    );
    await phase("complete Compose startup", async () => {
      await compose(source, ["up", "-d", "--no-build"]);
      await ready(source);
      const version = await compose(
        source,
        ["exec", "-T", "storage", "minio", "--version"],
        { quiet: true },
      );
      assert.ok(version.includes("RELEASE.2025-09-07T16-13-09Z"));
      assert.ok(version.includes("07c3a429bfed433e49018cb0f78a52145d4bedeb"));
      report.minioVersion = version.trim();
      const rows = JSON.parse(
        await compose(source, ["ps", "--all", "--format", "json"], {
          quiet: true,
        }).then((s) =>
          s.trim().startsWith("[")
            ? s
            : "[" + s.trim().split("\n").join(",") + "]",
        ),
      );
      for (const name of [
        "postgres",
        "redis",
        "mailpit",
        "storage",
        "api",
        "web",
        "worker",
        "render-worker",
        "media-worker",
        "fixture-provider",
      ])
        assert.ok(
          rows.some((x) => x.Service === name && x.State === "running"),
          name,
        );
      report.checks.allNineLongRunningServices = true;
      report.checks.syntheticProviderService = true;
    });
    const state = await phase(
      "auth, tenant isolation, upload, real render, idempotency and no-key behavior",
      () => node(source, "seed"),
    );
    Object.assign(report.checks, state.seedChecks);
    writeFileSync(resolve(dir, "private-state.json"), JSON.stringify(state), {
      mode: 0o600,
    });
    await phase("real SMTP delivery", async () => {
      const p = await port(source, "mailpit", 8025);
      const r = await fetch(`http://127.0.0.1:${p}/api/v1/messages`);
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.ok(
        data.messages.some((x) =>
          x.To?.some((t) => t.Address === state.owner.email),
        ),
      );
      report.checks.realSmtpDelivery = true;
    });
    let backup;
    const loadBackup = () => ({
      source,
      target: restored,
      dump: readFileSync(resolve(dir, "database.dump")),
      objects: JSON.parse(
        readFileSync(resolve(dir, "private-objects.json"), "utf8"),
      ).objects,
      manifest: JSON.parse(
        readFileSync(resolve(dir, "backup-manifest.json"), "utf8"),
      ),
    });
    await phase(
      "quiesced native database and private-object backup",
      async () => {
        await compose(source, [
          "stop",
          "web",
          "api",
          "worker",
          "render-worker",
          "media-worker",
        ]);
        const stopped = JSON.parse(
          await compose(source, ["ps", "--all", "--format", "json"], {
            quiet: true,
          }).then((s) =>
            s.trim().startsWith("[")
              ? s
              : "[" + s.trim().split("\n").join(",") + "]",
          ),
        );
        for (const name of fixtureWriters)
          assert.ok(
            stopped.some(
              (row) => row.Service === name && row.State === "exited",
            ),
            `Writer ${name} is still running.`,
          );
        Object.assign(state, await node(source, "recovery-seed", state, false));
        Object.assign(report.checks, {
          allFiveWritersStoppedBeforeBackup: true,
          queuedUncertainAndPrivateOutputSeededWhileQuiesced: true,
          syntheticUncertainProviderCallsBeforeBackup: 1,
        });
        writeFileSync(
          resolve(dir, "private-state.json"),
          JSON.stringify(state),
          { mode: 0o600 },
        );
        // An isolated fixture-only CHECK function supplies a deterministic COPY
        // barrier for native backend interruption, without fixed kill timing.
        await postgresSql(source, "marketing", restoreBarrierSql);
        const dump = await compose(
          source,
          [
            "exec",
            "-T",
            "postgres",
            "pg_dump",
            "-U",
            "marketing",
            "-d",
            "marketing",
            "-Fc",
          ],
          { raw: true, quiet: true },
        );
        assert.ok(dump.length > 1000);
        writeFileSync(resolve(dir, "database.dump"), dump, { mode: 0o600 });
        report.databaseDump = { bytes: dump.length, sha256: checksum(dump) };
        const objects = await node(source, "snapshot", {}, false);
        writeFileSync(
          resolve(dir, "private-objects.json"),
          JSON.stringify(objects),
          { mode: 0o600 },
        );
        report.objectBackup = {
          objects: objects.objects.length,
          bytes: objects.objects.reduce(
            (sum, x) => sum + Buffer.from(x.body, "base64").length,
            0,
          ),
          sha256: checksum(JSON.stringify(objects)),
        };
        const manifest = sealFixtureBackup({
          source,
          target: restored,
          dump,
          objects: objects.objects,
          stoppedWriters: fixtureWriters,
          references: await node(source, "recovery-references", state, false),
        });
        writeFileSync(
          resolve(dir, "backup-manifest.json"),
          JSON.stringify(manifest),
          { mode: 0o600 },
        );
        backup = loadBackup();
        validateFixtureBackup(backup);
        report.backupManifest = {
          sha256: checksum(JSON.stringify(manifest)),
          databaseBytes: manifest.database.bytes,
          privateObjects: manifest.objects.length,
        };
        report.checks.completeSealedBackupPreflight = true;
        report.checks.everyDatabaseMediaReferenceCovered = true;
      },
    );
    await phase(
      "reject incomplete/corrupt backups while preserving original source",
      async () => {
        const observations = [];
        for (const item of invalidFixtureBackupCases(backup)) {
          let callbacks = 0;
          await assert.rejects(
            withValidatedFixtureBackup(item.input, () => {
              callbacks++;
              throw new Error("Destructive callback must not run.");
            }),
          );
          assert.equal(callbacks, 0);
          observations.push({
            name: item.name,
            rejectedBeforeDestructiveAction: true,
          });
        }
        assert.deepEqual(await node(source, "snapshot", {}, false), {
          objects: backup.objects,
        });
        await node(source, "recovery-baseline", state, false);
        report.backupFailureCases = observations;
        report.checks.invalidBackupNeverReachesSourceRemovalOrTargetMutation = true;
        report.checks.sourceRecordsAndPrivateObjectsIntactAfterRejections = true;
      },
    );
    await phase(
      "historical private-object versions and external-effect reconciliation prerequisites",
      async () => {
        const cfg = await config(source);
        const labels = JSON.parse(
          await command(
            [
              "volume",
              "inspect",
              cfg.volumes.media_data.name,
              "--format",
              "{{json .Labels}}",
            ],
            { quiet: true },
          ),
        );
        assert.equal(labels["com.docker.compose.project"], source);
        const assertStopped = async () => {
          const lines = (
            await compose(source, ["ps", "--all", "--format", "json"], {
              quiet: true,
            })
          ).trim();
          const rows = lines.split("\n").flatMap((line) => JSON.parse(line));
          for (const name of fixtureWriters)
            assert.ok(
              rows.some(
                (row) => row.Service === name && row.State === "exited",
              ),
            );
        };
        await assertStopped();
        const databasePoint = (
          await postgresSql(source, "marketing", "SELECT pg_current_wal_lsn();")
        ).trim();
        report.historicalRecovery = await node(
          source,
          "historical-recovery",
          { project: source, databasePoint },
          false,
        );
        Object.assign(report.checks, report.historicalRecovery.checks);
        await assertStopped();
        assert.deepEqual(await node(source, "snapshot", {}, false), {
          objects: backup.objects,
        });
        await node(source, "recovery-baseline", state, false);
        report.checks.originalBackupRowsAndObjectsPreservedAfterHistoricalProbe = true;
      },
    );
    await phase(
      "pre-target historical versions bound to physical application recovery",
      async () => {
        let history;
        const stopped = async () => {
          const lines = (
            await compose(source, ["ps", "--all", "--format", "json"], {
              quiet: true,
            })
          ).trim();
          const rows = lines.split("\n").flatMap((l) => JSON.parse(l));
          for (const name of fixtureWriters)
            assert.ok(
              rows.some((r) => r.Service === name && r.State === "exited"),
            );
        };
        await stopped();
        try {
          report.physicalObjectRecovery = await runPostgresPitr({
            hooks: {
              beforeTarget: async (capture) => {
                history = await node(
                  source,
                  "physical-capture",
                  { project: source, capture },
                  false,
                );
                return { captureSha256: history.captureSha256 };
              },
              afterTarget: async (pointReceipt) => {
                history.pointReceipt = pointReceipt;
                history.expectedPointReceiptSha256 =
                  physicalCaptureHash(pointReceipt);
                Object.assign(
                  history,
                  await node(
                    source,
                    "physical-later",
                    { project: source, ...history },
                    false,
                  ),
                );
              },
              recovered: async (recovered) => {
                assert.deepEqual(recovered.pointReceipt, history.pointReceipt);
                const result = await node(
                  source,
                  "physical-verify",
                  { project: source, ...history, ...recovered },
                  false,
                );
                history.expectedVersions = result.expectedVersions;
                return result.report;
              },
            },
          });
          assert.equal(report.physicalObjectRecovery.passed, true);
          Object.assign(
            report.checks,
            report.physicalObjectRecovery.objectBinding.checks,
          );
        } finally {
          if (history)
            Object.assign(
              report.checks,
              await node(
                source,
                "physical-cleanup",
                { project: source, ...history },
                false,
              ),
            );
        }
        await stopped();
        await node(source, "recovery-baseline", state, false);
        assert.deepEqual(await node(source, "snapshot", {}, false), {
          objects: backup.objects,
        });
        report.checks.originalApplicationSourceUnchangedAfterPhysicalObjectProbe = true;
      },
    );
    for (const recoveryMode of [
      "application",
      "media",
      "interrupted-media",
      "process-interruption",
    ]) {
      const mediaMode = recoveryMode !== "application",
        interruptedMode = recoveryMode === "interrupted-media",
        processMode = recoveryMode === "process-interruption";
      await phase(
        processMode
          ? "physical worker process kills and ambiguous media provider recovery"
          : interruptedMode
            ? "physical retained-media faults and interrupted worker leases"
            : mediaMode
              ? "valid historical media and populated physical render/media recovery"
              : "physical cluster application bucket and fresh-Redis recovery",
        async () => {
          let history,
            capturedApplication,
            mediaReview,
            expectedMediaReviewSha256,
            mediaFixture;
          const reportKey = processMode
            ? "physicalWorkerProcessRecovery"
            : interruptedMode
              ? "physicalInterruptedMediaRecovery"
              : mediaMode
                ? "physicalMediaRecovery"
                : "physicalApplicationRecovery";
          const ids = mediaMode
              ? { ...physicalApplicationIds, ...physicalMediaIds }
              : physicalApplicationIds,
            password = "Synthetic physical password 123",
            queuedPrompt = "COMPOSE_RECOVERY_PHYSICAL_" + suffix,
            salt = randomBytes(16).toString("hex"),
            passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
          const appState = {
            ids,
            mediaMode,
            interruptedMode,
            processMode,
            nonce: suffix,
            password,
            queuedPrompt,
            objectSha256: checksum(Buffer.from("old")),
          };
          const writersAbsent = async () => {
            const output = (
              await compose(physical, ["ps", "--all", "--format", "json"], {
                quiet: true,
              })
            ).trim();
            const rows = output
              ? output.split("\n").flatMap((l) => JSON.parse(l))
              : [];
            assert.ok(!rows.some((r) => fixtureWriters.includes(r.Service)));
          };
          const query = (sql) =>
            compose(
              physical,
              [
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
              ],
              { input: sql, quiet: true },
            );
          try {
            await writersAbsent();
            await compose(physical, [
              "up",
              "-d",
              "--no-build",
              "--no-deps",
              "redis",
              "storage",
              "mailpit",
              "fixture-provider",
            ]);
            if (mediaMode) {
              mediaFixture = await node(
                source,
                "physical-media-prepare",
                {
                  ids,
                  interruptedMode,
                  processMode,
                  renderSnapshot: state.rows.render.snapshot,
                  renderOptions: state.rows.render.options,
                },
                false,
              );
              appState.mediaFixture = mediaFixture;
            }
            report[reportKey] = await runPostgresPitr({
              hooks: {
                sqlTransform: physicalApplicationSql,
                prepareApplication: async ({ query }) => {
                  await query(`
            UPDATE "User" SET "passwordHash"='${passwordHash}';
            INSERT INTO "User" (id,email,name,"passwordHash") VALUES ('pitr-viewer','pitr-viewer@example.test','Synthetic viewer','${passwordHash}');
            INSERT INTO "Membership" ("userId","organizationId",role) VALUES ('pitr-viewer','pitr-a','CLIENT');
            UPDATE "AIJob" SET input='${JSON.stringify({ prompt: queuedPrompt })}',"brandContext"='{"name":"Synthetic physical recovery","creativeDna":{}}' WHERE id='pitr-job';
            UPDATE "AIJob" SET "startedAt"=now()-interval '2 minutes' WHERE id='pitr-uncertain';
          `);
                  if (mediaMode) await query(mediaFixture.sql);
                },
                beforeTarget: async (capture) => {
                  capturedApplication = capture.applicationSnapshot;
                  history = await node(
                    source,
                    "physical-capture",
                    {
                      project: source,
                      capture,
                      applicationKey: ids["pitr-a"] + "/historical.png",
                      additionalObjects: mediaFixture?.objects,
                    },
                    false,
                  );
                  if (mediaMode) {
                    mediaReview = createPhysicalMediaReview(
                      capturedApplication,
                      history.manifest.objects,
                      {
                        interrupted: interruptedMode,
                        processInterruption: processMode,
                      },
                    );
                    expectedMediaReviewSha256 =
                      physicalCaptureHash(mediaReview);
                  }
                  return { captureSha256: history.captureSha256 };
                },
                afterTarget: async (pointReceipt) => {
                  history.pointReceipt = pointReceipt;
                  history.expectedPointReceiptSha256 =
                    physicalCaptureHash(pointReceipt);
                  Object.assign(
                    history,
                    await node(
                      source,
                      "physical-later",
                      { project: source, ...history },
                      false,
                    ),
                  );
                  const request = {
                    operationId: "history-" + suffix,
                    requestHash: physicalEffectRequestHash(
                      capturedApplication.rows.AIJob.find(
                        (j) => j.id === "pitr-uncertain",
                      ),
                    ),
                  };
                  appState.accepted = await node(
                    physical,
                    "physical-app-effect",
                    { request },
                    false,
                  );
                },
                recovered: async ({
                  exportPhysicalCluster,
                  verifyRetainedBase,
                  readRetainedWalSha256,
                  ...recovered
                }) => {
                  assert.deepEqual(
                    recovered.pointReceipt,
                    history.pointReceipt,
                  );
                  const copied = await exportPhysicalCluster();
                  assert.equal(checksum(copied.bytes), copied.sha256);
                  const cfg = await config(physical);
                  assert.equal(
                    (
                      await command(
                        [
                          "network",
                          "inspect",
                          cfg.networks.default.name,
                          "--format",
                          "{{.Internal}}",
                        ],
                        { quiet: true },
                      )
                    ).trim(),
                    "true",
                  );
                  await compose(
                    physical,
                    ["create", "--no-build", "postgres"],
                    {
                      quiet: true,
                    },
                  );
                  const ownedLabels = JSON.parse(
                    await command(
                      [
                        "volume",
                        "inspect",
                        cfg.volumes.postgres_data.name,
                        "--format",
                        "{{json .Labels}}",
                      ],
                      { quiet: true },
                    ),
                  );
                  assert.equal(
                    ownedLabels["com.docker.compose.project"],
                    physical,
                  );
                  // This creates only a newly generated, empty, labelled target volume.
                  const transferOutput = await compose(
                    physical,
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
                      "test -z \"$(ls -A /var/lib/postgresql/data)\"; cat > /tmp/physical.tar; sha256sum /tmp/physical.tar; tar -C /var/lib/postgresql/data -xf /tmp/physical.tar; rm /tmp/physical.tar; chown -R postgres:postgres /var/lib/postgresql/data; chmod 700 /var/lib/postgresql/data; cat >> /var/lib/postgresql/data/postgresql.conf <<'CONFIG'\nlisten_addresses = '*'\nunix_socket_directories = '/var/run/postgresql'\narchive_mode = off\nrestore_command = ''\nrecovery_target_name = ''\nCONFIG\nprintf \"host all all 0.0.0.0/0 trust\\n\" >> /var/lib/postgresql/data/pg_hba.conf",
                    ],
                    { input: copied.bytes, quiet: true },
                  );
                  const importedCopySha256 = transferOutput
                    .trim()
                    .split(/\s+/)[0];
                  assert.equal(importedCopySha256, copied.sha256);
                  const labels = JSON.parse(
                    await command(
                      [
                        "volume",
                        "inspect",
                        cfg.volumes.postgres_data.name,
                        "--format",
                        "{{json .Labels}}",
                      ],
                      { quiet: true },
                    ),
                  );
                  assert.equal(labels["com.docker.compose.project"], physical);
                  await compose(physical, [
                    "up",
                    "-d",
                    "--no-build",
                    "--no-deps",
                    "postgres",
                  ]);
                  let imported;
                  for (let i = 0; i < 60; i++) {
                    try {
                      imported = await applicationSnapshot(query);
                      break;
                    } catch (e) {
                      if (i === 59) throw e;
                      await new Promise((r) => setTimeout(r, 500));
                    }
                  }
                  assert.deepEqual(imported, recovered.applicationSnapshot);
                  const objects = await node(
                    source,
                    "physical-export-objects",
                    { project: source, ...history },
                    false,
                  );
                  await node(physical, "physical-app-objects", objects, false);
                  const preflight = async () => {
                    await writersAbsent();
                    const snapshot = await applicationSnapshot(query);
                    const current = await node(
                      physical,
                      "physical-app-preflight",
                      {},
                      false,
                    );
                    const redisKeys = Number(
                      (
                        await compose(
                          physical,
                          ["exec", "-T", "redis", "redis-cli", "DBSIZE"],
                          { quiet: true },
                        )
                      ).trim(),
                    );
                    const accepted = appState.accepted,
                      effect = {
                        ...accepted,
                        jobId: "pitr-uncertain",
                        happenedAfterPoint: true,
                      };
                    return {
                      ...history,
                      ...recovered,
                      ...(mediaMode
                        ? { mediaReview, expectedMediaReviewSha256 }
                        : {}),
                      physicalCopySha256: copied.sha256,
                      importedPhysicalCopySha256: importedCopySha256,
                      importedSnapshotSha256: physicalCaptureHash(snapshot),
                      queueInventory: physicalQueueInventory(snapshot),
                      writersIsolated: true,
                      redisKeys,
                      queueReconstructionReviewed: true,
                      objects: current.objects.map((o) => ({
                        ...o,
                        bytes: Buffer.from(o.body, "base64"),
                      })),
                      effects: {
                        databasePoint: history.pointReceipt.targetLsn,
                        inventoryComplete: true,
                        effects: [effect],
                        receipts: [
                          {
                            ...effect,
                            databasePoint: history.pointReceipt.targetLsn,
                            disposition: "DO_NOT_REPLAY",
                            evidenceKind: "PROVIDER_CONFIRMED",
                            reviewed: true,
                          },
                        ],
                      },
                    };
                  };
                  let starts = 0;
                  const evidence = await preflight();
                  let retentionGate;
                  if (processMode) {
                    const review = createRetainedRecoveryReview({
                      manifest: history.manifest,
                      pointReceipt: history.pointReceipt,
                      applicationSnapshot: recovered.applicationSnapshot,
                      retainedPhysical: recovered.retainedPhysical,
                      effects: evidence.effects,
                    });
                    const readHistoricalObjects = async () =>
                      (
                        await node(
                          source,
                          "physical-export-objects",
                          { project: source, ...history },
                          false,
                        )
                      ).objects;
                    const gate = {
                      review,
                      expectedReviewSha256: physicalCaptureHash(review),
                      manifest: history.manifest,
                      pointReceipt: history.pointReceipt,
                      applicationSnapshot: recovered.applicationSnapshot,
                      retainedPhysical: recovered.retainedPhysical,
                      effects: evidence.effects,
                      verifyRetainedBase,
                      readRetainedWalSha256,
                      readHistoricalObjects,
                      restoredObjects: evidence.objects,
                      redisKeys: evidence.redisKeys,
                      writersAbsent: true,
                    };
                    let denied = 0;
                    for (const changed of [
                      { expectedReviewSha256: "0".repeat(64) },
                      {
                        pointReceipt: {
                          ...gate.pointReceipt,
                          targetLsn: "0/DEAD",
                        },
                      },
                      {
                        verifyRetainedBase: async () => ({
                          manifestSha256: "0".repeat(64),
                          output: "backup successfully verified",
                        }),
                      },
                      { readRetainedWalSha256: async () => "0".repeat(64) },
                      { readHistoricalObjects: async () => [] },
                      { restoredObjects: [] },
                      { effects: { ...gate.effects, receipts: [] } },
                      { redisKeys: 1 },
                      { writersAbsent: false },
                    ]) {
                      await assert.rejects(
                        withRetainedRecoverySet(
                          { ...gate, ...changed },
                          async () => {
                            starts++;
                          },
                        ),
                      );
                      denied++;
                    }
                    assert.equal(starts, 0);
                    retentionGate = { gate, denied };
                  }
                  for (const changed of [
                    { objects: [] },
                    { redisKeys: 1 },
                    {
                      queueInventory: { ...evidence.queueInventory, AIJob: [] },
                    },
                    { queueReconstructionReviewed: false },
                    { effects: { ...evidence.effects, receipts: [] } },
                    {
                      effects: {
                        ...evidence.effects,
                        receipts: evidence.effects.receipts.map((r) => ({
                          ...r,
                          disposition: "REPLAY",
                        })),
                      },
                    },
                    {
                      effects: {
                        ...evidence.effects,
                        receipts: evidence.effects.receipts.map((r) => ({
                          ...r,
                          reviewed: false,
                        })),
                      },
                    },
                  ])
                    await assert.rejects(
                      withPhysicalApplicationStart(
                        { ...evidence, ...changed },
                        async () => {
                          starts++;
                        },
                      ),
                    );
                  assert.equal(starts, 0);
                  if (mediaMode) {
                    for (const changed of [
                      { mediaReview: undefined },
                      { expectedMediaReviewSha256: "0".repeat(64) },
                      { mediaReview: { ...mediaReview, reviewed: false } },
                    ])
                      await assert.rejects(
                        withPhysicalApplicationStart(
                          { ...evidence, ...changed },
                          async () => {
                            starts++;
                          },
                        ),
                      );
                    assert.equal(starts, 0);
                  }
                  const objectFaults = [];
                  if (interruptedMode || processMode) {
                    for (const key of [
                      mediaFixture.sourceKey,
                      mediaFixture.outputKey,
                    ]) {
                      const object = objects.objects.find((o) => o.key === key);
                      assert.ok(object);
                      for (const fault of ["missing", "corrupt"]) {
                        try {
                          await node(
                            physical,
                            "physical-media-object-fault",
                            { ...appState, object, fault },
                            false,
                          );
                          const changed = await preflight();
                          await assert.rejects(
                            withPhysicalApplicationStart(changed, async () => {
                              starts++;
                            }),
                            /Application bucket inventory changed|Historical private object bytes changed/,
                          );
                          assert.equal(starts, 0);
                          assert.equal(changed.redisKeys, 0);
                          await writersAbsent();
                          assert.deepEqual(
                            await applicationSnapshot(query),
                            imported,
                          );
                          objectFaults.push({
                            key,
                            fault,
                            startCallbacks: 0,
                            redisKeys: 0,
                            applicationSnapshotUnchanged: true,
                          });
                        } finally {
                          await node(
                            physical,
                            "physical-media-object-fault",
                            { ...appState, object, fault: "restore" },
                            false,
                          );
                        }
                        const restoredEvidence = await preflight();
                        const readback = restoredEvidence.objects.find(
                          (o) => o.key === key,
                        );
                        assert.equal(checksum(readback.bytes), object.sha256);
                        assert.equal(
                          readback.bytes.length,
                          Buffer.from(object.body, "base64").length,
                        );
                      }
                    }
                    assert.equal(objectFaults.length, 4);
                  }
                  await writersAbsent();
                  appState.beforeLedger = physicalLedgerBaseline(
                    recovered.applicationSnapshot.rows.CreditEntry,
                  );
                  const startVerifiedApplication = async (currentEvidence) =>
                    withPhysicalApplicationStart(
                      currentEvidence ?? (await preflight()),
                      async () => {
                        starts++;
                        await compose(physical, [
                          "up",
                          "-d",
                          "--no-build",
                          "--no-deps",
                          "api",
                          "web",
                          ...(processMode
                            ? []
                            : ["worker", "render-worker", "media-worker"]),
                        ]);
                      },
                    );
                  if (retentionGate) {
                    const currentEvidence = await preflight();
                    await withRetainedRecoverySet(
                      {
                        ...retentionGate.gate,
                        effects: currentEvidence.effects,
                        restoredObjects: currentEvidence.objects,
                        redisKeys: currentEvidence.redisKeys,
                      },
                      () => startVerifiedApplication(currentEvidence),
                    );
                  } else await startVerifiedApplication();
                  assert.equal(starts, 1);
                  await ready(physical);
                  if (processMode) {
                    appState.processInterruption =
                      await interruptPhysicalWorkers({
                        project: physical,
                        nonce: suffix,
                        appState,
                        compose,
                        command,
                        node,
                        query,
                        capturePoint: (barrier) =>
                          captureInflightPhysicalPoint({
                            source: physical,
                            target: inflight,
                            nonce: suffix,
                            barrier,
                            compose,
                            command,
                            config,
                            node,
                            sourceQuery: query,
                            targetQuery: (sql) =>
                              compose(
                                inflight,
                                [
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
                                ],
                                { input: sql, quiet: true },
                              ),
                          }),
                      });
                    await compose(physical, [
                      "up",
                      "-d",
                      "--no-build",
                      "--no-deps",
                      "worker",
                      "render-worker",
                      "media-worker",
                    ]);
                  }
                  const checks = await node(
                    physical,
                    "physical-app-http",
                    appState,
                  );
                  if (interruptedMode || processMode) {
                    appState.interruption = await node(
                      physical,
                      "physical-media-interrupted",
                      appState,
                    );
                    appState.ids = {
                      ...ids,
                      render: appState.interruption.retryRenderId,
                    };
                  }
                  let mediaWork, mediaRestart;
                  if (mediaMode) {
                    try {
                      mediaWork = await node(
                        physical,
                        "physical-media-workers",
                        appState,
                      );
                    } catch (error) {
                      writeFileSync(
                        resolve(
                          root,
                          ".local/recovery01l-worker-diagnostic.json",
                        ),
                        JSON.stringify(
                          await node(
                            physical,
                            "physical-media-diagnostic",
                            appState,
                          ),
                          null,
                          2,
                        ),
                      );
                      writeFileSync(
                        resolve(
                          root,
                          ".local/recovery01l-worker-diagnostic.log",
                        ),
                        await compose(
                          physical,
                          [
                            "logs",
                            "--no-color",
                            "--tail",
                            "100",
                            "render-worker",
                            "media-worker",
                          ],
                          { quiet: true },
                        ),
                      );
                      throw error;
                    }
                    appState.mediaAfter = mediaWork.after;
                    appState.mediaHashes = mediaWork.hashes;
                  }
                  const work = await node(
                    physical,
                    "physical-app-workers",
                    appState,
                  );
                  appState.after = work.after;
                  appState.restartAfter = Date.now();
                  await compose(physical, [
                    "restart",
                    "worker",
                    "render-worker",
                    "media-worker",
                  ]);
                  const restarted = await node(
                    physical,
                    "physical-app-restart",
                    appState,
                  );
                  if (mediaMode)
                    mediaRestart = await node(
                      physical,
                      "physical-media-restart",
                      appState,
                    );
                  const binding = await node(
                    source,
                    "physical-verify",
                    { project: source, ...history, ...recovered },
                    false,
                  );
                  history.expectedVersions = binding.expectedVersions;
                  return {
                    ...binding.report,
                    ...(mediaMode
                      ? {
                          mediaReview,
                          expectedMediaReviewSha256,
                          mediaOutputHashes: mediaWork.hashes,
                          ...(interruptedMode || processMode
                            ? {
                                objectFaults,
                                interruptedRender: {
                                  originalRenderId:
                                    appState.interruption.originalRenderId,
                                  retryRenderId:
                                    appState.interruption.retryRenderId,
                                  originalFailedRowSha256: physicalCaptureHash(
                                    appState.interruption.failedRender,
                                  ),
                                  checks: appState.interruption.checks,
                                },
                              }
                            : {}),
                        }
                      : {}),
                    ...(processMode
                      ? {
                          processInterruption: appState.processInterruption,
                          retainedRecoverySet: {
                            reviewSha256:
                              retentionGate.gate.expectedReviewSha256,
                            baseManifestSha256:
                              recovered.retainedPhysical.baseManifestSha256,
                            targetLsn: recovered.retainedPhysical.targetLsn,
                            targetWalSegment:
                              recovered.retainedPhysical.targetSegment,
                            targetWalSha256:
                              recovered.retainedPhysical.targetWalSha256,
                            historicalVersions:
                              history.manifest.versions.length,
                            deniedControls: retentionGate.denied,
                            admittedCallbacks: starts,
                          },
                        }
                      : {}),
                    applicationStartedFromHistoricalObjects: true,
                    physicalCopySha256: copied.sha256,
                    importedPhysicalCopySha256: importedCopySha256,
                    applicationStartCallbacks: starts,
                    startupControlsDenied:
                      interruptedMode || processMode ? 14 : mediaMode ? 10 : 7,
                    redisKeysBeforeApplicationStart: evidence.redisKeys,
                    reviewedEffectEvidence: evidence.effects,
                    boundedFreshRedisApplicationRecoveryVerified: true,
                    physicalApplicationProject: physical,
                    importedSnapshotSha256: physicalCaptureHash(imported),
                    queueInventory: evidence.queueInventory,
                    checks: {
                      ...binding.report.checks,
                      ...checks,
                      ...work.checks,
                      ...restarted.checks,
                      ...mediaWork?.checks,
                      ...mediaRestart?.checks,
                      ...appState.interruption?.checks,
                      ...appState.processInterruption?.checks,
                      ...(interruptedMode || processMode
                        ? {
                            physicalMissingAndCorruptMediaDenyWriters: true,
                            physicalMediaFaultsPreserveDatabaseAndEmptyRedis: true,
                            physicalMediaFaultsRepairedFromVerifiedHistoricalBytes: true,
                          }
                        : {}),
                      sevenInvalidStartupPrerequisitesDenied: true,
                      ...(mediaMode
                        ? { unreviewedPopulatedMediaStartupDenied: true }
                        : {}),
                      allWritersAbsentBeforeVerifiedAdmission: true,
                      physicalDataDirectoryCopiedWithoutLogicalDump: true,
                      importedFullSnapshotMatchesPhysicalTarget: true,
                      emptyRedisBeforePhysicalApplicationStart: true,
                      isolatedApplicationBucketRestoredFromRetainedVersion: true,
                    },
                    fixtureOnlyReviewedEffectInventory: true,
                    queuedRenderOrMediaExecutionClaimed: mediaMode,
                    productionRecoveryClaimed: false,
                  };
                },
              },
            });
            assert.equal(
              report[reportKey].passed,
              true,
              report[reportKey].failure,
            );
            Object.assign(
              report.checks,
              report[reportKey].objectBinding.checks,
            );
          } finally {
            if (history)
              await node(
                source,
                "physical-cleanup",
                { project: source, ...history },
                false,
              );
            await cleanup(physical);
          }
          await node(source, "recovery-baseline", state, false);
          assert.deepEqual(await node(source, "snapshot", {}, false), {
            objects: backup.objects,
          });
          report.checks.originalSourcePreservedAfterPhysicalApplicationRecovery = true;
        },
      );
    }
    await phase(
      "capture real in-flight claims and provider effect in a second physical point",
      async () => {
        const point =
          report.physicalWorkerProcessRecovery.objectBinding.processInterruption
            .physicalPoint;
        assert.ok(point);
        assert.equal(point.deniedControls, 9);
        assert.equal(point.admissionCallbacks, 1);
        assert.equal(point.redisKeys, 0);
        assert.equal(point.sourceSnapshotSha256, point.restoredSnapshotSha256);
        assert.ok(Object.values(point.checks).every(Boolean));
        report.inflightPhysicalPoint = point;
        Object.assign(report.checks, point.checks);
      },
    );
    await phase(
      "verify retained WAL target and historical private-object recovery set",
      async () => {
        const native = report.physicalWorkerProcessRecovery;
        const retained = native.objectBinding.retainedRecoverySet;
        assert.ok(retained);
        assert.equal(native.checks.separateRetainedBaseAndWalVerified, true);
        assert.equal(
          native.checks.missingOrCorruptRetainedWalDeniesRecoveryStart,
          true,
        );
        assert.match(retained.reviewSha256, /^[a-f0-9]{64}$/);
        assert.equal(
          retained.baseManifestSha256,
          native.baseBackup.manifestSha256,
        );
        assert.equal(retained.targetLsn, native.archivedWal.targetLsn);
        assert.equal(
          retained.targetWalSegment,
          native.archivedWal.targetSegment,
        );
        assert.equal(retained.targetWalSha256, native.archivedWal.sha256);
        assert.equal(retained.historicalVersions, 3);
        assert.equal(retained.deniedControls, 9);
        assert.equal(retained.admittedCallbacks, 1);
        report.retainedRecoverySet = retained;
        report.checks.retainedBaseAndWalUsedForNamedTargetRecovery = true;
        report.checks.historicalVersionAndProviderReviewGateApplicationStart = true;
      },
    );
    // Remove the entire original disposable stack and all its data volumes before
    // restoring. The new project cannot accidentally read old volumes/objects.
    await phase("remove original disposable source targets", async () => {
      await withValidatedFixtureBackup(loadBackup(), () => cleanup(source));
      report.checks.originalSourceVolumesRemoved = true;
    });
    await phase(
      "restore into separate PostgreSQL and MinIO targets",
      async () => {
        validateFixtureBackup(loadBackup());
        await compose(restored, [
          "up",
          "-d",
          "--no-build",
          "postgres",
          "redis",
          "storage",
          "mailpit",
        ]);
        for (let i = 0; i < 60; i++) {
          try {
            await compose(
              restored,
              [
                "exec",
                "-T",
                "postgres",
                "pg_isready",
                "-h",
                "127.0.0.1",
                "-U",
                "marketing",
                "-d",
                "marketing",
              ],
              { quiet: true },
            );
            assert.equal(
              (
                await compose(
                  restored,
                  ["exec", "-T", "redis", "redis-cli", "PING"],
                  { quiet: true },
                )
              ).trim(),
              "PONG",
            );
            break;
          } catch {
            if (i === 59)
              throw new Error("Restore PostgreSQL readiness failed");
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        assert.equal(
          (
            await compose(
              restored,
              ["exec", "-T", "redis", "redis-cli", "DBSIZE"],
              { quiet: true },
            )
          ).trim(),
          "0",
        );
        report.checks.freshRedisEmptyBeforeApplicationStart = true;
        const verified = loadBackup();
        validateFixtureBackup(verified);
        const dump = verified.dump;
        assert.equal(
          checksum(dump),
          report.databaseDump.sha256,
          "Saved native database dump changed before restore.",
        );
        report.restoreInterruption = await verifyInterruptedRestore({
          project: restored,
          query: (sql) => postgresSql(restored, "marketing", sql),
          reset: () =>
            withValidatedFixtureBackup(loadBackup(), resetRestoreDatabase),
          setPause: (on) =>
            postgresSql(
              restored,
              "postgres",
              `ALTER DATABASE marketing SET omos.fixture_restore_pause = '${on ? "on" : "off"}';`,
            ),
          restore: (atomic) => restoreDatabase(dump, atomic),
          progress: (name) => console.log("POSTGRES RECOVERY CHECK: " + name),
        });
        Object.assign(report.checks, report.restoreInterruption.checks);
        await withValidatedFixtureBackup(loadBackup(), () =>
          restoreDatabase(dump, true),
        );
        report.checks.cleanAtomicNativeDatabaseRetry = true;
      },
    );
    await phase(
      "partial private-object failure, gated startup and clean retry",
      async () => {
        const gate = fixtureApplicationStartGate(loadBackup);
        const objects = () => ({ objects: loadBackup().objects });
        const baseline = () =>
          node(restored, "recovery-database-baseline", state, false);
        const assertWritersAbsent = async () => {
          const lines = (
            await compose(restored, ["ps", "--all", "--format", "json"], {
              quiet: true,
            })
          ).trim();
          const containers = lines
            ? lines.split("\n").flatMap((line) => JSON.parse(line))
            : [];
          assert.ok(
            !containers.some((c) => fixtureWriters.includes(c.Service)),
          );
        };
        await assertWritersAbsent();
        await baseline();
        await assert.rejects(
          gate.restore(
            () =>
              node(restored, "restore-objects-interrupted", objects(), false),
            baseline,
          ),
          /Controlled fixture failure after first acknowledged private-object PUT/,
        );
        let starts = 0;
        await assert.rejects(
          gate.start(() => {
            starts++;
          }),
          /Application start denied/,
        );
        assert.equal(starts, 0);
        await assertWritersAbsent();
        Object.assign(
          report.checks,
          await node(restored, "inspect-partial-objects", objects(), false),
        );
        await baseline();
        await withValidatedFixtureBackup(loadBackup(), async () => {
          assertFixtureRestoreProject(restored);
          const cfg = await config(restored);
          const labels = JSON.parse(
            await command(
              [
                "volume",
                "inspect",
                cfg.volumes.media_data.name,
                "--format",
                "{{json .Labels}}",
              ],
              { quiet: true },
            ),
          );
          assert.equal(labels["com.docker.compose.project"], restored);
          await assertWritersAbsent();
          Object.assign(
            report.checks,
            await node(restored, "clear-partial-objects", objects(), false),
          );
        });
        await baseline();
        const restoredObjects = await gate.restore(
          () => node(restored, "restore-objects", objects(), false),
          baseline,
        );
        assert.equal(
          restoredObjects.objectsRestored,
          report.objectBackup.objects,
        );
        Object.assign(report.checks, restoredObjects, {
          controlledFailureAfterAcknowledgedPrivatePut: true,
          applicationStartDeniedWhileObjectsIncomplete: true,
          allFiveApplicationServicesAbsentDuringPartialRestore: true,
          ownedRestoreBucketOnlyCleanup: true,
          recoveryDatabaseUnchangedAcrossObjectFailureCleanupRetry: true,
          sameValidatedBackupRetriedBeforeApplicationStart: true,
        });
        // Verify restored rows before starting any worker that can consume them.
        await phase(
          "bind restored application references to historical versions",
          async () => {
            await assertWritersAbsent();
            assert.equal(
              (
                await compose(
                  restored,
                  ["exec", "-T", "redis", "redis-cli", "DBSIZE"],
                  { quiet: true },
                )
              ).trim(),
              "0",
            );
            await compose(restored, [
              "up",
              "-d",
              "--no-build",
              "fixture-provider",
            ]);
            const verified = loadBackup();
            validateFixtureBackup(verified);
            report.applicationHistoricalBinding = await node(
              restored,
              "application-history",
              {
                ...state,
                project: source,
                databasePoint: `logical-sha256:${checksum(verified.dump)}`,
                binding: {
                  snapshotSha256: checksum(verified.dump),
                  expectedSnapshotSha256: verified.manifest.database.sha256,
                  expected: verified.manifest.references,
                  objects: verified.manifest.objects,
                },
              },
              false,
            );
            Object.assign(
              report.checks,
              report.applicationHistoricalBinding.checks,
            );
            await assertWritersAbsent();
            await baseline();
            assert.deepEqual(await node(restored, "snapshot", {}, false), {
              objects: verified.objects,
            });
            report.checks.applicationBindingBeforeAnyWriterStart = true;
            report.checks.originalRestoredObjectsUnchangedAfterApplicationBinding = true;
          },
        );
        await gate.start(() =>
          compose(restored, [
            "up",
            "-d",
            "--no-build",
            "migrate",
            "api",
            "web",
          ]),
        );
        report.checks.applicationStartAllowedOnlyAfterVerifiedRestore = true;
        await ready(restored);
      },
    );
    await phase(
      "restored records/media/tenant access through actual application",
      async () => {
        Object.assign(
          report.checks,
          await node(restored, "verify-restored", state),
        );
        Object.assign(
          report.checks,
          await node(restored, "recovery-baseline", state),
        );
      },
    );
    await phase(
      "fresh-Redis reconstruction and uncertain/private-output recovery",
      async () => {
        await compose(restored, [
          "up",
          "-d",
          "--no-build",
          "fixture-provider",
          "worker",
          "render-worker",
          "media-worker",
        ]);
        const recovered = await node(restored, "recovery-verify", state);
        state.recoveryAfter = recovered.after;
        Object.assign(report.checks, recovered.checks);
        writeFileSync(
          resolve(dir, "private-state.json"),
          JSON.stringify(state),
          { mode: 0o600 },
        );
      },
    );
    await phase(
      "restart all three workers without replay or duplicate settlements",
      async () => {
        state.restartAfter = Date.now();
        await compose(restored, [
          "restart",
          "worker",
          "render-worker",
          "media-worker",
        ]);
        const repeated = await node(restored, "recovery-recheck", state);
        Object.assign(report.checks, repeated.checks);
      },
    );
  }
  report.passed = true;
} catch (error) {
  report.failure = redact(error.message, secrets);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  cleaningUp = true;
  try {
    if (!configurationOnly) {
      await cleanup(source);
      await cleanup(restored);
      await cleanup(physical);
      await cleanup(inflight);
      report.checks.fixtureCleanup = true;
    }
  } catch (error) {
    report.passed = false;
    process.exitCode = 1;
    report.cleanupFailure = redact(error.message, secrets);
  }
  releaseLifecycle();
  const after = existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null;
  report.checks.realEnvironmentUnchanged = beforeEnv === after;
  if (beforeEnv !== after) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.completedAt = new Date().toISOString();
  const out = resolve(
    root,
    ".local",
    configurationOnly
      ? "compose-configuration-evidence.json"
      : "compose-evidence.json",
  );
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Compose evidence: ${out}`);
}
