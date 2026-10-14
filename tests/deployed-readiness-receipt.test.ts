import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, stat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureConfig,
  sanitizeReadinessReceipt,
} from "../scripts/capture-youtube-deployed-readiness-receipt";
import { evaluateYoutubeLiveReadiness } from "../packages/core/youtube-live-readiness";

const session = "a".repeat(64);
const organizationId = "00000000-0000-4000-8000-000000000001";
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

function receipt(ok = false) {
  const value = evaluateYoutubeLiveReadiness({});
  value.checks = value.checks.map((item) => ({ ...item, ok }));
  return {
    ...value,
    ok,
    receipt: {
      type: "youtube-live-readiness",
      generatedBy: "operations",
      secretValuesIncluded: false,
      liveGoogleCallAttempted: false,
      externalPostAttempted: false,
    },
  };
}

function env(origin = "https://api.example.test") {
  return {
    MOS_DEPLOYED_API_ORIGIN: origin,
    MOS_DEPLOYED_ORGANIZATION_ID: organizationId,
    MOS_DEPLOYED_SESSION_COOKIE: session,
  };
}

test("deployed receipt config and sanitizer reject unsafe origins, cookies, incomplete checks and false success", () => {
  assert.equal(captureConfig(env()).cookie, `mos_session=${session}`);
  assert.equal(
    captureConfig({
      ...env(),
      MOS_DEPLOYED_SESSION_COOKIE: `mos_session=${session}`,
    }).cookie,
    `mos_session=${session}`,
  );
  for (const origin of [
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://[::1]:4000",
  ])
    assert.doesNotThrow(() => captureConfig(env(origin)));
  for (const origin of [
    "",
    "ftp://localhost",
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test/path",
    "https://api.example.test/?secret=value",
    "https://api.example.test/#secret",
  ])
    assert.throws(() => captureConfig(env(origin)));
  for (const token of [
    "",
    `mos_session=${session}; other=secret`,
    session.toUpperCase(),
    `${session}\r\nInjected: secret`,
  ])
    assert.throws(() =>
      captureConfig({ ...env(), MOS_DEPLOYED_SESSION_COOKIE: token }),
    );
  for (const id of ["", "../other-workspace", "other?key=secret"])
    assert.throws(() =>
      captureConfig({ ...env(), MOS_DEPLOYED_ORGANIZATION_ID: id }),
    );
  for (const timeout of ["0", "NaN", "99", "120001", "1.5"])
    assert.throws(() =>
      captureConfig({ ...env(), MOS_DEPLOYED_RECEIPT_TIMEOUT_MS: timeout }),
    );

  const valid = receipt(true);
  assert.equal(sanitizeReadinessReceipt(valid).ok, true);
  for (const invalid of [
    null,
    [],
    { ...valid, ok: "true" },
    { ...valid, checkedAt: "not a date" },
    { ...valid, policyVersion: "obsolete" },
    { ...valid, receipt: { ...valid.receipt, liveGoogleCallAttempted: true } },
    { ...valid, receipt: { ...valid.receipt, externalPostAttempted: true } },
    { ...valid, receipt: { ...valid.receipt, secretValuesIncluded: true } },
    { ...valid, checks: valid.checks.slice(1) },
    { ...valid, checks: [...valid.checks.slice(1), valid.checks[1]] },
    {
      ...valid,
      checks: valid.checks.map((item) => ({ ...item, severity: "warning" })),
    },
    { ...receipt(false), ok: true },
  ])
    assert.throws(() => sanitizeReadinessReceipt(invalid));
  const extra = {
    ...valid,
    secret: session,
    checks: valid.checks.map((item) => ({
      ...item,
      message: session,
      secret: session,
    })),
    receipt: { ...valid.receipt, secret: session },
  };
  assert.doesNotMatch(
    JSON.stringify(sanitizeReadinessReceipt(extra)),
    new RegExp(session),
  );
});

test("deployed capture CLI performs authenticated GET, saves private sanitized proof and fails closed on readiness/transport errors", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mos-deployed-receipt-"));
  let mode = "ready";
  let redirected = 0;
  const requests: { method?: string; url?: string; cookie?: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({
      method: req.method,
      url: req.url,
      cookie: req.headers.cookie,
    });
    if (req.url === "/redirect-target") redirected++;
    if (mode === "redirect") {
      res.writeHead(302, { Location: "/redirect-target" });
      res.end();
      return;
    }
    if (mode === "forbidden") {
      res.writeHead(403);
      res.end(session);
      return;
    }
    if (mode === "timeout") {
      setTimeout(() => res.end("late"), 500).unref();
      return;
    }
    if (mode === "html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(session);
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    if (mode === "malformed") {
      res.end(`invalid-${session}`);
      return;
    }
    if (mode === "oversized") {
      res.end(
        JSON.stringify({ padding: "x".repeat(70 * 1024), secret: session }),
      );
      return;
    }
    const value = receipt(mode === "ready");
    res.end(
      JSON.stringify({
        ...value,
        secret: session,
        checks: value.checks.map((item) => ({ ...item, message: session })),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const serverPort = address.port;
  let runNumber = 0;
  async function run(output = join(directory, `receipt-${++runNumber}.json`)) {
    const config = {
      ...process.env,
      ...env(`http://127.0.0.1:${serverPort}`),
      MOS_DEPLOYED_RECEIPT_OUTPUT: output,
      MOS_DEPLOYED_RECEIPT_TIMEOUT_MS: mode === "timeout" ? "100" : "5000",
    };
    try {
      const result = await exec(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/capture-youtube-deployed-readiness-receipt.ts",
        ],
        { cwd: root, env: config, timeout: 15000 },
      );
      return { ...result, code: 0, output };
    } catch (error: any) {
      return {
        stdout: String(error.stdout || ""),
        stderr: String(error.stderr || ""),
        code: error.code,
        output,
      };
    }
  }
  const ready = await run();
  assert.equal(ready.code, 0, ready.stderr);
  const saved = JSON.parse(await readFile(ready.output, "utf8"));
  assert.equal(saved.readiness.ok, true);
  assert.equal(saved.organizationId, organizationId);
  assert.equal(saved.requestMethod, "GET");
  assert.equal(saved.sessionCookieIncluded, false);
  assert.equal(saved.liveGoogleCallAttempted, false);
  assert.equal(saved.externalPostAttempted, false);
  assert.equal(saved.readiness.checks.length, 9);
  assert.doesNotMatch(
    JSON.stringify(saved) + ready.stdout + ready.stderr,
    new RegExp(session),
  );
  if (process.platform !== "win32")
    assert.equal((await stat(ready.output)).mode & 0o777, 0o600);
  mode = "not-ready";
  const failedReadiness = await run();
  assert.equal(failedReadiness.code, 1);
  assert.equal(
    JSON.parse(await readFile(failedReadiness.output, "utf8")).readiness.ok,
    false,
  );
  for (const failure of [
    "forbidden",
    "redirect",
    "html",
    "malformed",
    "oversized",
    "timeout",
  ]) {
    mode = failure;
    const result = await run();
    assert.equal(result.code, 1, `${failure}: ${result.stderr}`);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(session));
    await assert.rejects(stat(result.output), { code: "ENOENT" });
  }
  assert.equal(redirected, 0);
  for (const request of requests) {
    assert.equal(request.method, "GET");
    assert.equal(
      request.url,
      `/api/workspaces/${organizationId}/operations/youtube-live-readiness`,
    );
    assert.equal(request.cookie, `mos_session=${session}`);
  }
  mode = "ready";
  const existing = join(directory, "existing.json");
  await writeFile(existing, "preserve prior receipt");
  assert.equal((await run(existing)).code, 1);
  assert.equal(await readFile(existing, "utf8"), "preserve prior receipt");
});
