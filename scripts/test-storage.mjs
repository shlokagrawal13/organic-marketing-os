// Test infrastructure only. Runtime storage always uses its configured S3 service.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

export async function startTestStorage() {
  const jar = resolve(
    process.env.TEST_S3_JAR || ".local/test-tools/s3proxy-4.1.1.jar",
  );
  if (!existsSync(jar))
    throw new Error(
      "Install test storage with python scripts/install_test_storage.py (requires Java 17+).",
    );
  if (
    createHash("sha256").update(readFileSync(jar)).digest("hex") !==
    "cd2e81919e7e1b8d8a23750c9792bb306a2f841a0222a80919b72e989eedd94b"
  )
    throw new Error("S3Proxy test server checksum mismatch.");
  const directory = await mkdtemp(join(tmpdir(), "mos-s3-test-"));
  const credentials = {
    accessKeyId: "isolated-marketing-test",
    secretAccessKey: randomBytes(24).toString("hex"),
  };
  const endpoint = "http://127.0.0.1:4569",
    bucket = "marketing-test";
  const config = join(directory, "s3proxy.properties");
  const data = join(directory, "data");
  await mkdir(data);
  // Java properties escape Windows drive/path separators as well.
  const property = (value) =>
    value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
  await writeFile(
    config,
    [
      "s3proxy.authorization=aws-v4",
      `s3proxy.identity=${credentials.accessKeyId}`,
      `s3proxy.credential=${credentials.secretAccessKey}`,
      `s3proxy.endpoint=${endpoint}`,
      "jclouds.provider=filesystem",
      `jclouds.filesystem.basedir=${property(data)}`,
    ].join("\n"),
    { mode: 0o600 },
  );
  const log = createWriteStream(".local/test-storage.log", { mode: 0o600 });
  const child = spawn(
    process.env.TEST_JAVA_BINARY || "java",
    ["-Xmx256m", "-jar", jar, "--properties", config],
    {
      cwd: directory,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let spawnError,
    closed = false;
  child.on("error", (error) => {
    spawnError = error;
  });
  const exited = new Promise((done) => child.once("close", done));
  async function close() {
    if (closed) return;
    closed = true;
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(force);
    log.end();
    await rm(directory, { recursive: true, force: true });
  }
  const client = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials,
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 1000, requestTimeout: 2000 },
  });
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(
          "S3Proxy exited before readiness; inspect .local/test-storage.log",
        );
      try {
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch (error) {
          if (error.$metadata?.httpStatusCode !== 404) throw error;
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        }
        const anonymous = await fetch(`${endpoint}/${bucket}`, {
          method: "HEAD",
          signal: AbortSignal.timeout(2000),
        });
        if (anonymous.status !== 403)
          throw new Error("Test S3 bucket permits unsigned access");
        Object.assign(process.env, {
          S3_ENDPOINT: endpoint,
          S3_ACCESS_KEY: credentials.accessKeyId,
          S3_SECRET_KEY: credentials.secretAccessKey,
          S3_REGION: "us-east-1",
          S3_BUCKET: bucket,
          S3_AUTO_CREATE_BUCKET: "true",
          S3_FORCE_PATH_STYLE: "true",
        });
        return { close };
      } catch (error) {
        if (error.message === "Test S3 bucket permits unsigned access")
          throw error;
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    throw new Error(
      "S3Proxy did not become ready; inspect .local/test-storage.log",
    );
  } catch (error) {
    await close();
    throw error;
  } finally {
    client.destroy();
  }
}
