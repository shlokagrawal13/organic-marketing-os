// Injected only into disposable Compose one-off workers; never imported by runtime code.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
function installPhysicalWorkerBarrier(options) {
  assert.equal(process.env.MOS_ISOLATED_TEST_HARNESS, "true");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.match(options.nonce, /^[a-f0-9]{16}$/);
  assert.ok(["render", "media"].includes(options.kind));
  const provider = "http://fixture-provider:4999";
  const hold = async (kind, detail) => {
    const r = await fetch(
      provider + "/worker-barriers/" + options.nonce + "/" + kind,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: process.pid, ...detail }),
        signal: AbortSignal.timeout(5000),
      },
    );
    assert.equal(r.status, 201, "Barrier acknowledgement failed");
    await new Promise(() => {});
  };
  const { ObjectStore } = require("/app/dist/packages/core/object-store.js");
  if (options.kind === "render") {
    const put = ObjectStore.prototype.putFile;
    ObjectStore.prototype.putFile = async function (key, path, mime) {
      const result = await put.call(this, key, path, mime);
      if (key.startsWith(options.org + "/segments/")) {
        const bytes = readFileSync(path);
        const probe = JSON.parse(
          execFileSync(
            "ffprobe",
            ["-v", "error", "-show_streams", "-of", "json", path],
            { encoding: "utf8" },
          ),
        );
        const video = probe.streams.find((v) => v.codec_type === "video");
        assert.ok(video);
        await hold("render", {
          boundary: "encoded-segment-put-acknowledged",
          key,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          width: video.width,
          height: video.height,
        });
      }
      return result;
    };
  } else {
    const read = ObjectStore.prototype.read;
    ObjectStore.prototype.read = async function (key, max) {
      const bytes = await read.call(this, key, max);
      if (key === options.retainedKey)
        await hold("media", {
          boundary: "retained-output-read-before-ingest",
          key,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      return bytes;
    };
    // The existing media provider permits this loopback address only in a test harness.
    // Requests reach the real provider adapter, then the internal fixture's held response.
    const { createServer } = require("node:http");
    const server = createServer(async (req, res) => {
      try {
        assert.equal(req.method, "POST");
        assert.equal(req.url, "/v1/images/generations");
        let body = "";
        for await (const b of req) {
          body += b;
          if (body.length > 10000) throw Error("Large fixture request");
        }
        await fetch(provider + "/worker-media/" + options.nonce, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": req.headers["idempotency-key"] || "",
          },
          body,
          signal: AbortSignal.timeout(170000),
        });
        res.writeHead(500);
        res.end("{}");
      } catch {
        res.writeHead(500);
        res.end("{}");
      }
    });
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(4998, "127.0.0.1", () => resolve(server));
    });
  }
}
module.exports = { installPhysicalWorkerBarrier };
