import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateYoutubeLiveReadiness } from "../packages/core/youtube-live-readiness";
import { youtubePolicyVersion } from "../packages/core/youtube-policy";

type Env = Record<string, string | undefined>;
const canonicalChecks = evaluateYoutubeLiveReadiness({}).checks;
const maxResponseBytes = 64 * 1024;

export function captureConfig(env: Env) {
  let origin: URL;
  try {
    origin = new URL(env.MOS_DEPLOYED_API_ORIGIN || "");
  } catch {
    throw new Error("MOS_DEPLOYED_API_ORIGIN must be an API origin.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    origin.hostname,
  );
  if (
    (origin.protocol !== "https:" &&
      !(origin.protocol === "http:" && loopback)) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "The API origin must use HTTPS (HTTP is allowed only on loopback), without credentials, path, query or fragment.",
    );
  const organizationId = env.MOS_DEPLOYED_ORGANIZATION_ID || "";
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
      organizationId,
    )
  ) {
    throw new Error("MOS_DEPLOYED_ORGANIZATION_ID must be a workspace UUID.");
  }
  const token = (env.MOS_DEPLOYED_SESSION_COOKIE || "").replace(
    /^mos_session=/u,
    "",
  );
  if (!/^[a-f0-9]{64}$/u.test(token)) {
    throw new Error(
      "MOS_DEPLOYED_SESSION_COOKIE must contain only the session token or mos_session=<token>.",
    );
  }
  const timeoutMs = Number(env.MOS_DEPLOYED_RECEIPT_TIMEOUT_MS || "15000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new Error(
      "MOS_DEPLOYED_RECEIPT_TIMEOUT_MS must be an integer from 100 to 120000.",
    );
  }
  return {
    apiOrigin: origin.origin,
    organizationId,
    cookie: `mos_session=${token}`,
    timeoutMs,
    outputPath: resolve(
      env.MOS_DEPLOYED_RECEIPT_OUTPUT ||
        `.local/youtube-deployed-readiness-${Date.now()}.json`,
    ),
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function sanitizeReadinessReceipt(value: unknown) {
  const invalid = () => {
    throw new Error("The endpoint returned an invalid readiness receipt.");
  };
  if (!record(value)) return invalid();
  if (
    typeof value.ok !== "boolean" ||
    typeof value.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    value.checkedAt.length > 40 ||
    new Date(value.checkedAt).toISOString() !== value.checkedAt ||
    value.policyVersion !== youtubePolicyVersion ||
    !record(value.receipt) ||
    value.receipt.type !== "youtube-live-readiness" ||
    value.receipt.generatedBy !== "operations" ||
    value.receipt.secretValuesIncluded !== false ||
    value.receipt.liveGoogleCallAttempted !== false ||
    value.receipt.externalPostAttempted !== false ||
    !Array.isArray(value.checks) ||
    value.checks.length !== canonicalChecks.length
  )
    return invalid();
  const seen = new Set<string>();
  const checks = canonicalChecks.map((expected) => {
    const item = (value.checks as unknown[]).find(
      (candidate) => record(candidate) && candidate.id === expected.id,
    );
    if (
      !record(item) ||
      typeof item.ok !== "boolean" ||
      item.severity !== expected.severity ||
      seen.has(expected.id)
    )
      return invalid();
    seen.add(expected.id);
    return {
      id: expected.id,
      ok: item.ok,
      severity: expected.severity,
      message: expected.message,
    };
  });
  if (
    value.ok !== checks.every((item) => item.severity !== "critical" || item.ok)
  )
    return invalid();
  // Only fixed fields and locally defined messages are retained. Server extensions and
  // arbitrary strings cannot leak secret values into the saved evidence or console.
  return {
    ok: value.ok,
    checkedAt: new Date(value.checkedAt).toISOString(),
    policyVersion: youtubePolicyVersion,
    checks,
    receipt: {
      type: "youtube-live-readiness",
      generatedBy: "operations",
      secretValuesIncluded: false,
      liveGoogleCallAttempted: false,
      externalPostAttempted: false,
    },
  };
}

export async function captureDeployedReadiness(env: Env = process.env) {
  const config = captureConfig(env);
  let response: Response;
  try {
    response = await fetch(
      `${config.apiOrigin}/api/workspaces/${config.organizationId}/operations/youtube-live-readiness`,
      {
        method: "GET",
        headers: { Accept: "application/json", Cookie: config.cookie },
        redirect: "error",
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
  } catch {
    throw new Error(
      "The readiness GET request failed or timed out; no receipt was saved.",
    );
  }
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(
      `The readiness endpoint returned HTTP ${response.status}; no receipt was saved.`,
    );
  }
  if (
    !/^application\/json(?:\s*;|$)/iu.test(
      response.headers.get("content-type") || "",
    )
  ) {
    await response.body?.cancel();
    throw new Error(
      "The readiness endpoint must return JSON; no receipt was saved.",
    );
  }
  let value: unknown;
  try {
    if (!response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > maxResponseBytes) throw new Error();
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error(
      "The readiness response was invalid, oversized or interrupted; no receipt was saved.",
    );
  }
  const readiness = sanitizeReadinessReceipt(value);
  const evidence = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    apiOrigin: config.apiOrigin,
    organizationId: config.organizationId,
    requestMethod: "GET",
    httpStatus: response.status,
    readiness,
    sessionCookieIncluded: false,
    liveGoogleCallAttempted: false,
    externalPostAttempted: false,
  };
  try {
    await mkdir(dirname(config.outputPath), { recursive: true });
    // Never overwrite an earlier receipt or follow an existing file symlink.
    await writeFile(
      config.outputPath,
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
  } catch {
    throw new Error(
      "Could not create the private receipt file; choose a new writable output path.",
    );
  }
  return evidence;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  captureDeployedReadiness()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.readiness.ok) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Readiness capture failed."}\n`,
      );
      process.exitCode = 1;
    });
}
