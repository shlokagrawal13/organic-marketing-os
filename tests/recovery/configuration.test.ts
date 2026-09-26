import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { db, actor, draft, scene, until } from "../support/http";
test(
  "no API keys: manual drafting and MP4 rendering work, AI fails explicitly, unsafe production config refuses startup",
  { timeout: 20000 },
  async () => {
    const env = {
      ...process.env,
      API_PORT: "4001",
      AI_PRIMARY_KEY: "",
      AI_PRIMARY_MODEL: "",
      AI_PRIMARY_URL: "",
      AI_FALLBACK_KEY: "",
      AI_FALLBACK_MODEL: "",
      AI_FALLBACK_URL: "",
    };
    const api = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
      env,
      stdio: "ignore",
    });
    let orgId = "",
      userId = "";
    try {
      await until(
        async () => {
          try {
            return (await fetch("http://127.0.0.1:4001/api/health")).status;
          } catch {
            return 0;
          }
        },
        (s) => s === 200,
      );
      const org = await db.organization.create({
        data: { name: "No-provider QA" },
      });
      orgId = org.id;
      const a = await actor(orgId);
      userId = a.id;
      const root = `http://127.0.0.1:4001/api/workspaces/${orgId}`;
      const call = async (path: string, method = "GET", body?: unknown) => {
        const r = await fetch(root + path, {
          method,
          headers: { ...a.headers, "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: r.status, body: await r.json() };
      };
      assert.equal((await call("/ai/status")).body.configured, false);
      assert.equal(
        (
          await call("/ai/jobs", "POST", {
            task: "content",
            prompt: "This must not start any paid generation",
            requestKey: randomUUID(),
          })
        ).status,
        503,
      );
      assert.equal(
        await db.aIJob.count({ where: { organizationId: orgId } }),
        0,
      );
      const content = await call("/content", "POST", {
        ...draft,
        format: "Video",
        scenes: [{ ...scene, duration: 1 }],
      });
      assert.equal(content.status, 201);
      const render = await call("/renders", "POST", {
        contentId: content.body.id,
        revision: 1,
        requestKey: randomUUID(),
      });
      assert.equal(render.status, 201);
      const done = await until(
        () => db.renderJob.findUniqueOrThrow({ where: { id: render.body.id } }),
        (r) => ["SUCCEEDED", "FAILED"].includes(r.status),
      );
      assert.equal(done.status, "SUCCEEDED", done.error || "");
      assert.equal(
        (
          await fetch(root + `/renders/${render.body.id}/file/video`, {
            headers: a.headers,
          })
        ).status,
        200,
      );
    } finally {
      api.kill("SIGTERM");
      if (orgId) await db.organization.delete({ where: { id: orgId } });
      if (userId) await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
    }
    const invalid = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
      env: {
        ...env,
        NODE_ENV: "production",
        WEB_ORIGIN: "http://localhost:3000",
        COOKIE_SECURE: "false",
      },
      stdio: "ignore",
    });
    const code = await new Promise((resolve) => invalid.once("exit", resolve));
    assert.equal(code, 1);
  },
);
