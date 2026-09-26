// Optional constrained-environment harness. CI uses native PostgreSQL and Redis.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  createWriteStream,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { SMTPServer } from "smtp-server";
import { startTestStorage } from "./test-storage.mjs";
try {
  process.loadEnvFile(".env");
} catch {}
process.env.NODE_ENV = "development";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.COOKIE_SECURE = "false";
process.env.SMTP_SECURE = "false";
process.env.BILLING_MODE = "self_hosted";
process.env.PLATFORM_ADMIN_USER_IDS = "";
process.env.AI_STRATEGY_CREDITS = "5";
process.env.AI_CONTENT_CREDITS = "3";
process.env.AI_SCENE_CREDITS = "1";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;
mkdirSync(".local", { recursive: true });
writeFileSync(".local/mailbox.ndjson", "");
const smtp = new SMTPServer({
  disabledCommands: ["AUTH", "STARTTLS"],
  authOptional: true,
  onData(stream, session, callback) {
    let body = "";
    stream.on("data", (chunk) => (body += chunk.toString()));
    stream.on("end", () => {
      appendFileSync(
        ".local/mailbox.ndjson",
        JSON.stringify({
          to: session.envelope.rcptTo.map((r) => r.address),
          body,
        }) + "\n",
      );
      callback();
    });
  },
});
const processes = [];
let storage;
function start(cmd, args, log, env = process.env) {
  const child = spawn(cmd, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const file = createWriteStream(`.local/${log}.log`);
  child.stdout.pipe(file);
  child.stderr.pipe(file);
  processes.push(child);
  return child;
}
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}
const native = process.argv.includes("--native");
process.env.MOS_TEST_DATABASE = native ? "native" : "pglite";
if (native && process.env.MOS_ALLOW_NATIVE_TESTS !== "isolated-test-services")
  throw new Error(
    "Native tests require isolated DATABASE_URL/REDIS_URL services and MOS_ALLOW_NATIVE_TESTS=isolated-test-services.",
  );
const db = native ? null : await PGlite.create();
const server = db
  ? new PGLiteSocketServer({
      db,
      port: 5433,
      host: "127.0.0.1",
      maxConnections: 10,
    })
  : null;
const fixtureCalls = {};
const fixtureServer = createServer(async (req, res) => {
  if (req.url === "/stats") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(fixtureCalls));
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (req.url?.startsWith("/primary")) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end("{}");
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const strategy = {
    title: "Test-only strategy",
    goal: "Qualified conversations",
    audience: "Small teams",
    positioning: "Useful advice",
    pillars: [{ name: "Education", purpose: "Explain the problem" }],
    ideas: [
      {
        title: "A test idea",
        hook: "A useful question",
        platform: "LinkedIn",
        format: "Text",
        purpose: "Help the reader",
        cta: "Share your experience",
      },
    ],
    cadence: "One thoughtful draft",
    experiments: ["Compare two hooks"],
    assumptions: ["Fixture for automated tests; not live AI output"],
  };
  const draft = {
    title: "Test-only generated draft",
    platform: "LinkedIn",
    format: "Text",
    hook: "A useful question",
    body: "This is an automated provider fixture used only in testing.",
    cta: "Share your experience.",
    scenes: [],
  };
  const input = JSON.parse(parsed.messages?.[1]?.content || "{}").input || {};
  fixtureCalls[input.prompt || "unknown"] =
    (fixtureCalls[input.prompt || "unknown"] || 0) + 1;
  if (input.prompt?.startsWith("HOLD:")) {
    // Test-only provider holds the connection until a worker interruption closes it.
    const timer = setTimeout(() => {
      if (!res.destroyed) res.end("{}");
    }, 90000);
    res.on("close", () => clearTimeout(timer));
    return;
  }
  const output = parsed.messages?.[0]?.content?.includes("task scene")
    ? { ...input.scene, onScreenText: "A rewritten QA scene" }
    : parsed.messages?.[0]?.content?.includes("task strategy")
      ? strategy
      : draft;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: input.prompt?.startsWith("INVALID:")
              ? '{"invalid":"test-only"}'
              : JSON.stringify(output),
          },
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    }),
  );
});
let failed = false;
try {
  storage = await startTestStorage();
  mkdirSync(".local/media-fixtures", { recursive: true });
  await run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-nostdin",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x194b37:s=640x640:d=1",
    "-vf",
    "drawbox=x=55:y=70:w=530:h=500:color=0xc7f06b:t=8,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='ORGANIC STUDIO':fontcolor=white:fontsize=38:x=(w-tw)/2:y=270,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='QA MEDIA FIXTURE':fontcolor=white:fontsize=22:x=(w-tw)/2:y=335",
    "-frames:v",
    "1",
    "-threads",
    "1",
    ".local/media-fixtures/product.png",
  ]);
  await run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000:duration=2",
    "-ac",
    "2",
    ".local/media-fixtures/tone.wav",
  ]);
  await run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-nostdin",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=stereo",
    "-t",
    "60",
    "-c:a",
    "pcm_s16le",
    ".local/media-fixtures/large-audio.wav",
  ]);
  await run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-nostdin",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x240:rate=30:duration=2",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    ".local/media-fixtures/clip.mp4",
  ]);
  // Check fixture integrity before testing uploads; a broken fixture is not
  // evidence of an application upload failure.
  const { probeMedia, validateProbe } =
    await import("../dist/packages/core/media.js");
  for (const [name, kind] of [
    ["product.png", "IMAGE"],
    ["tone.wav", "AUDIO"],
    ["large-audio.wav", "AUDIO"],
    ["clip.mp4", "VIDEO"],
  ])
    validateProbe(await probeMedia(`.local/media-fixtures/${name}`), kind);
  if (server) await server.start();
  if (!native)
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5433/postgres?schema=public&connection_limit=1&pgbouncer=true";
  if (!native) process.env.REDIS_URL = "redis://127.0.0.1:6379";
  await new Promise((r) => smtp.listen(1025, "127.0.0.1", r));
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1025";
  await new Promise((r) => fixtureServer.listen(4999, "127.0.0.1", r));
  process.env.AI_PRIMARY_URL = "http://127.0.0.1:4999/primary";
  process.env.AI_PRIMARY_KEY = "test-fixture";
  process.env.AI_PRIMARY_MODEL = "fixture";
  process.env.AI_FALLBACK_URL = "http://127.0.0.1:4999/fallback";
  process.env.AI_FALLBACK_KEY = "test-fixture";
  process.env.AI_FALLBACK_MODEL = "fixture";
  if (!native)
    start(
      process.env.TEST_REDIS_BINARY || "redis-server",
      [
        "--bind",
        "127.0.0.1",
        "--port",
        "6379",
        "--save",
        "",
        "--appendonly",
        "no",
      ],
      "redis",
    );
  await run("node_modules/.bin/prisma", ["migrate", "deploy"]);
  start("node", ["dist/apps/api/src/main.js"], "api");
  process.env.TEST_AI_WORKER_PID = String(
    start("node", ["dist/apps/api/src/worker.js"], "worker").pid,
  );
  process.env.TEST_RENDER_WORKER_PID = String(
    start("node", ["dist/apps/api/src/render-worker.js"], "render-worker").pid,
  );
  process.env.MOS_ISOLATED_TEST_HARNESS = "true";
  start(
    "node",
    [
      "node_modules/next/dist/bin/next",
      process.argv.includes("--production-web") ? "start" : "dev",
      "apps/web",
      "-H",
      "127.0.0.1",
    ],
    "web",
    {
      ...process.env,
      NODE_ENV: process.argv.includes("--production-web")
        ? "production"
        : "development",
    },
  );
  async function ready(url) {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(url)).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Not ready: ${url}`);
  }
  await ready("http://127.0.0.1:4000/api/health");
  await ready("http://localhost:3000");
  await run("node", [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "tests/integration/*.test.ts",
  ]);
  if (!process.argv.includes("--skip-ui")) {
    const { readFileSync, writeFileSync, chmodSync } = await import("node:fs");
    const { brotliDecompressSync } = await import("node:zlib");
    writeFileSync(
      ".local/chromium",
      brotliDecompressSync(
        readFileSync("node_modules/@sparticuz/chromium/bin/chromium.br"),
      ),
    );
    chmodSync(".local/chromium", 0o755);
    process.env.CHROMIUM_EXECUTABLE_PATH = process.cwd() + "/.local/chromium";
    await run("node_modules/.bin/playwright", ["test"]);
  }
  await run("node", [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "tests/recovery/*.test.ts",
  ]);
  console.log(
    native
      ? "Verification passed against configured native PostgreSQL and Redis."
      : "Local verification passed. Database: PGlite WASM PostgreSQL; Redis: native test binary.",
  );
} catch (e) {
  failed = true;
  console.error(e.message);
} finally {
  for (const p of processes) p.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  for (const p of processes) if (p.exitCode === null) p.kill("SIGKILL");
  fixtureServer.close();
  smtp.close();
  await storage?.close();
  if (server) await server.stop();
  if (db) await db.close();
}
process.exit(failed ? 1 : 0);
