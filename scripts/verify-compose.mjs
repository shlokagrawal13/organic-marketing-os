// Complete local-development Compose acceptance against generated disposable projects.
// No real .env, existing project/volume, live provider or public cloud is used.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  fixtureProject,
  assertFixtureProject,
  assertFixtureConfig,
  checksum,
  redact,
  fixtureDockerEnv,
} from "./compose-verification.mjs";
if (process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Set MOS_ALLOW_NATIVE_TESTS=isolated-test-services for disposable Compose verification.",
  );
const root = resolve(import.meta.dirname, ".."),
  suffix = randomBytes(8).toString("hex"),
  source = fixtureProject(suffix),
  restored = fixtureProject(suffix, true);
const dir = resolve(root, ".local", "compose-verification", suffix);
mkdirSync(dir, { recursive: true, mode: 0o700 });
const realEnv = resolve(root, ".env"),
  beforeEnv = existsSync(realEnv) ? checksum(readFileSync(realEnv)) : null;
const dockerEnv = fixtureDockerEnv(process.env);
const dockerBase = ["--host=unix:///var/run/docker.sock"];
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
    worker: { image: runtimeImage, env_file: [fixtureEnv] },
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
const fixtureScript = readFileSync(
  resolve(root, "scripts/verify-compose-fixture.mjs"),
  "utf8",
);
const report = {
  schemaVersion: 1,
  taskId: "NATIVE-01A",
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
                `Docker operation failed (${code}): ${Buffer.concat(err).toString().slice(-5000)}`,
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
      input: `globalThis.__composeFixtureState=${JSON.stringify(state)};\n${fixtureScript}`,
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
try {
  await phase("isolated configuration", async () => {
    await config(source);
    await config(restored);
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
      ])
        assert.ok(
          rows.some((x) => x.Service === name && x.State === "running"),
          name,
        );
      report.checks.allNineLongRunningServices = true;
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
      },
    );
    // Remove the entire original disposable stack and all its data volumes before
    // restoring. The new project cannot accidentally read old volumes/objects.
    await phase("remove original disposable source targets", async () => {
      await cleanup(source);
      report.checks.originalSourceVolumesRemoved = true;
    });
    await phase(
      "restore into separate PostgreSQL and MinIO targets",
      async () => {
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
            break;
          } catch {
            if (i === 59)
              throw new Error("Restore PostgreSQL readiness failed");
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        await compose(
          restored,
          [
            "exec",
            "-T",
            "postgres",
            "pg_restore",
            "-U",
            "marketing",
            "-d",
            "marketing",
            "--exit-on-error",
          ],
          { input: readFileSync(resolve(dir, "database.dump")), quiet: true },
        );
        const objects = JSON.parse(
          readFileSync(resolve(dir, "private-objects.json"), "utf8"),
        );
        const restoredObjects = await node(
          restored,
          "restore-objects",
          objects,
          false,
        );
        assert.equal(
          restoredObjects.objectsRestored,
          report.objectBackup.objects,
        );
        Object.assign(report.checks, restoredObjects);
        await compose(restored, ["up", "-d", "--no-build"]);
        await ready(restored);
      },
    );
    await phase(
      "restored records/media/tenant access through actual application",
      async () =>
        Object.assign(
          report.checks,
          await node(restored, "verify-restored", state),
        ),
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
      report.checks.fixtureCleanup = true;
    }
  } catch (error) {
    report.passed = false;
    process.exitCode = 1;
    report.cleanupFailure = redact(error.message, secrets);
  }
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
