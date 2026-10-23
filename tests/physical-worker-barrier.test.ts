import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecoveryProvider } from "../scripts/compose-recovery-provider.mjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
async function provider(t) {
  const server = createRecoveryProvider();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return "http://127.0.0.1:" + (server.address() as any).port;
}
const nonce = "0123456789abcdef",
  org = "7cdd0796-a51e-442a-aab9-111111111111";
test("Barrier observer refuses malformed identities and unacknowledged phases", async (t) => {
  const url = await provider(t);
  for (const path of [
    "/worker-barriers/wrong/render",
    "/worker-barriers/" + nonce + "/wrong",
    "/worker-barriers/" + nonce + "/render",
  ])
    assert.equal(
      (
        await fetch(url + path, {
          method: "POST",
          body: JSON.stringify({
            pid: 1,
            bytes: 500,
            sha256: "a".repeat(64),
            key: org + "/segment",
            boundary: "other",
          }),
        })
      ).status,
      400,
    );
  assert.deepEqual(
    await (await fetch(url + "/worker-barriers/" + nonce)).json(),
    { barriers: [], media: null },
  );
});
test("Barrier observer acknowledges one exact private boundary and rejects duplicate hits", async (t) => {
  const url = await provider(t),
    path = url + "/worker-barriers/" + nonce + "/render";
  const body = {
    pid: 1,
    bytes: 500,
    sha256: "a".repeat(64),
    key: org + "/segments/s.mp4",
    boundary: "encoded-segment-put-acknowledged",
    width: 1280,
    height: 720,
  };
  assert.equal(
    (await fetch(path, { method: "POST", body: JSON.stringify(body) })).status,
    201,
  );
  assert.equal(
    (await fetch(path, { method: "POST", body: JSON.stringify(body) })).status,
    409,
  );
  const r = await (await fetch(url + "/worker-barriers/" + nonce)).json();
  assert.deepEqual(r.barriers[0], {
    kind: "render",
    ...body,
    observedAtUtc: r.barriers[0].observedAtUtc,
  });
  assert.equal(r.media, null);
});
test("Actual fixture provider retains accepted media before sending a worker response", async (t) => {
  const url = await provider(t),
    abort = new AbortController();
  t.after(() => abort.abort());
  let returned = false;
  const request = {
    model: "fixture-image",
    prompt: "COMPOSE_RECOVERY_PHYSICAL_AMBIGUOUS",
  };
  const headers = {
    "Idempotency-Key": org + ":7cdd0796-a51e-442a-aab9-aaaaaaaaaaaa",
  };
  const pending = fetch(url + "/worker-media/" + nonce, {
    method: "POST",
    body: JSON.stringify(request),
    headers,
    signal: abort.signal,
  })
    .then(() => {
      returned = true;
    })
    .catch(() => {});
  let r;
  for (let i = 0; i < 50; i++) {
    r = await (await fetch(url + "/worker-barriers/" + nonce)).json();
    if (r.media) break;
    await new Promise((res) => setTimeout(res, 10));
  }
  assert.equal(r.media.acceptedCalls, 1);
  assert.equal(r.media.submissionAttempts, 1);
  assert.equal(r.media.responseHeld, true);
  assert.equal(returned, false);
  assert.equal(
    (
      await fetch(url + "/worker-media/" + nonce, {
        method: "POST",
        body: JSON.stringify(request),
        headers,
      })
    ).status,
    409,
  );
  const after = await (await fetch(url + "/worker-barriers/" + nonce)).json();
  assert.equal(after.media.acceptedCalls, 1);
  assert.equal(after.media.submissionAttempts, 2);
  assert.equal(after.media.providerRequestId, r.media.providerRequestId);
  abort.abort();
  await pending;
});
function loader(env, storeClass, fetcher) {
  const output = { exports: {} as any };
  const source = readFileSync(
    new URL("../scripts/physical-worker-barrier.cjs", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source, {
    module: output,
    require: (p) =>
      p === "/app/dist/packages/core/object-store.js"
        ? { ObjectStore: storeClass }
        : p === "node:child_process"
          ? {
              execFileSync: () =>
                JSON.stringify({
                  streams: [{ codec_type: "video", width: 1280, height: 720 }],
                }),
            }
          : p === "node:fs"
            ? { readFileSync: () => Buffer.alloc(500) }
            : requireLocal(p),
    process: { env, pid: 91 },
    fetch: fetcher,
    AbortSignal,
    Buffer,
  });
  return output.exports.installPhysicalWorkerBarrier;
}
import { createRequire } from "node:module";
const requireLocal = createRequire(import.meta.url);
test("Barrier injection refuses production and absent harness authorization", () => {
  for (const env of [
    { NODE_ENV: "production", MOS_ISOLATED_TEST_HARNESS: "true" },
    { NODE_ENV: "development" },
  ])
    assert.throws(() =>
      loader(env, class {}, async () => {})({ nonce, kind: "render", org }),
    );
});
test("Render barrier follows acknowledged real storage write and holds continuation", async () => {
  const calls = [];
  class Store {
    async putFile() {
      calls.push("stored");
    }
  }
  let report;
  const install = loader(
    { NODE_ENV: "development", MOS_ISOLATED_TEST_HARNESS: "true" },
    Store,
    async (_url, args) => {
      calls.push("barrier");
      report = JSON.parse(args.body);
      return { status: 201 };
    },
  );
  install({ nonce, kind: "render", org });
  let returned = false;
  void new Store()
    .putFile(org + "/segments/hash.mp4", "fixture.mp4", "video/mp4")
    .then(() => (returned = true));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, ["stored", "barrier"]);
  assert.equal(returned, false);
  assert.equal(report.boundary, "encoded-segment-put-acknowledged");
  assert.equal(report.bytes, 500);
});
test("Render storage failure never acknowledges a crash barrier", async () => {
  let acknowledged = false;
  class Store {
    async putFile() {
      throw Error("write failed");
    }
  }
  const install = loader(
    { NODE_ENV: "development", MOS_ISOLATED_TEST_HARNESS: "true" },
    Store,
    async () => {
      acknowledged = true;
      return { status: 201 };
    },
  );
  install({ nonce, kind: "render", org });
  await assert.rejects(
    new Store().putFile(org + "/segments/hash.mp4", "fixture", "video/mp4"),
    /write failed/,
  );
  assert.equal(acknowledged, false);
});
