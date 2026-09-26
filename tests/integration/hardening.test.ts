import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { db, actor, base, draft, scene } from "../support/http";
const users: string[] = [],
  orgs: string[] = [];
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const aiQueue = new Queue("marketing-ai", { connection: redis as any });
const renderQueue = new Queue("marketing-render", { connection: redis as any });
after(async () => {
  await aiQueue.resume();
  await renderQueue.resume();
  await aiQueue.close();
  await renderQueue.close();
  await redis.quit();
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test(
  "roles, concurrent request guards, full private export, large uploads and revoked access",
  { timeout: 60000 },
  async () => {
    const org = await db.organization.create({
      data: { name: "Hardening verification" },
    });
    orgs.push(org.id);
    const other = await db.organization.create({
      data: { name: "Other tenant" },
    });
    orgs.push(other.id);
    const root = `/workspaces/${org.id}`;
    const owner = await actor(org.id);
    users.push(owner.id);
    const outsider = await actor(other.id);
    users.push(outsider.id);
    for (const role of [
      "OWNER",
      "ADMIN",
      "EDITOR",
      "CREATOR",
      "ANALYST",
      "CLIENT",
    ] as const) {
      const a = role === "OWNER" ? owner : await actor(org.id, role);
      if (a !== owner) users.push(a.id);
      assert.equal((await a.call(root + "/content")).status, 200);
      const created = await a.call(root + "/content", "POST", draft);
      const writer = ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
      assert.equal(created.status, writer ? 201 : 403, role);
      assert.equal(
        (await a.call(root + "/operations/status")).status,
        ["OWNER", "ADMIN"].includes(role) ? 200 : 403,
        role,
      );
      if (writer) {
        const id = created.body.id;
        assert.equal(
          (
            await a.call(`${root}/content/${id}/review`, "POST", {
              revision: 1,
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await a.call(`${root}/content/${id}/approve`, "POST", {
              revision: 1,
              factsAndRightsReviewed: true,
            })
          ).status,
          role === "CREATOR" ? 403 : 201,
        );
        if (role !== "CREATOR") {
          assert.equal(
            (
              await a.call(`${root}/content/${id}/archive`, "POST", {
                revision: 1,
              })
            ).status,
            201,
          );
          assert.equal(
            (await db.contentItem.findUniqueOrThrow({ where: { id } }))
              .approvedAt,
            null,
          );
        }
      }
    }
    assert.equal(
      (await outsider.call(root + "/operations/status")).status,
      404,
    );
    assert.equal(
      (await outsider.call(root + "/operations/export")).status,
      404,
    );
    const brand = {
      profile: { name: "Original brand" },
      creativeDna: {},
      revision: 0,
    };
    const brands = await Promise.all(
      [1, 2, 3].map(() => owner.call(root + "/brand", "PUT", brand)),
    );
    assert.deepEqual(brands.map((r) => r.status).sort(), [200, 409, 409]);
    const created = await owner.call(root + "/content", "POST", draft),
      id = created.body.id;
    const edits = await Promise.all(
      [1, 2, 3].map((n) =>
        owner.call(`${root}/content/${id}`, "PUT", {
          ...draft,
          title: `Revision ${n}`,
          revision: 1,
        }),
      ),
    );
    assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409, 409]);
    assert.equal(
      (
        await owner.call(`${root}/content/${id}/review`, "POST", {
          revision: 1,
        })
      ).status,
      409,
    );
    await aiQueue.pause();
    await renderQueue.pause();
    try {
      const input = {
        task: "content",
        prompt: "Create a factual test draft",
        requestKey: randomUUID(),
      };
      const submitted = await Promise.all(
        [1, 2, 3].map(() => owner.call(root + "/ai/jobs", "POST", input)),
      );
      assert.ok(
        submitted.every((r) => r.status === 201),
        JSON.stringify(submitted),
      );
      assert.equal(new Set(submitted.map((r) => r.body.id)).size, 1);
      assert.equal(
        (
          await owner.call(root + "/ai/jobs", "POST", {
            ...input,
            prompt: "Changed input using the same request key",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await owner.call(root + "/ai/jobs", "POST", {
            task: "scene",
            prompt: "Rewrite this scene please",
            requestKey: randomUUID(),
          })
        ).status,
        400,
      );
      const job = await db.aIJob.findUniqueOrThrow({
        where: { id: submitted[0].body.id },
      });
      await owner.call(root + "/brand", "PUT", {
        ...brand,
        profile: { name: "Changed brand" },
        revision: 1,
      });
      assert.equal((job.brandContext as any).profile.name, "Original brand");
      assert.equal("runToken" in submitted[0].body, false);
      assert.equal(
        (await owner.call(`${root}/ai/jobs/${job.id}/cancel`, "POST")).status,
        201,
      );
      const video = await owner.call(root + "/content", "POST", {
        ...draft,
        format: "Video",
        scenes: [scene],
      });
      const attempts = await Promise.all(
        [1, 2, 3, 4].map(() =>
          owner.call(root + "/renders", "POST", {
            contentId: video.body.id,
            revision: 1,
            requestKey: randomUUID(),
          }),
        ),
      );
      assert.deepEqual(
        attempts.map((r) => r.status).sort(),
        [201, 201, 201, 400],
      );
      for (const r of attempts.filter((r) => r.status === 201))
        await owner.call(`${root}/renders/${r.body.id}/cancel`, "POST");
    } finally {
      await aiQueue.resume();
      await renderQueue.resume();
    }
    const malicious = new FormData();
    malicious.set("rightsConfirmed", "true");
    malicious.set("a[999999999999999999]", "bad");
    const bad = await fetch(base + root + "/assets", {
      method: "POST",
      headers: owner.headers,
      body: malicious,
    });
    assert.ok([400, 413].includes(bad.status));
    assert.equal(
      (await fetch(base + "/health")).status,
      200,
      "malformed multipart must not crash API",
    );
    const huge = new FormData();
    huge.set("rightsConfirmed", "true");
    huge.set(
      "file",
      new Blob([new Uint8Array(25 * 1024 * 1024 + 1)]),
      "oversized.png",
    );
    assert.equal(
      (
        await fetch(base + root + "/assets", {
          method: "POST",
          headers: owner.headers,
          body: huge,
        })
      ).status,
      413,
    );
    // More than the old UI limit, plus unrelated tenant data that must never leak.
    await db.contentItem.createMany({
      data: Array.from({ length: 125 }, (_, i) => ({
        ...draft,
        id: randomUUID(),
        organizationId: org.id,
        createdBy: owner.id,
        title: `Paginated ${i}`,
      })),
    });
    await db.contentItem.create({
      data: {
        ...draft,
        organizationId: other.id,
        createdBy: outsider.id,
        title: "SECRET OUTSIDE WORKSPACE",
      },
    });
    const exported = await fetch(base + root + "/operations/export", {
      headers: owner.headers,
    });
    assert.equal(
      exported.status,
      200,
      await (exported.status === 200 ? Promise.resolve("") : exported.text()),
    );
    assert.equal(exported.headers.get("cache-control"), "private, no-store");
    const text = await exported.text(),
      lines = text.trimEnd().split("\n"),
      records = lines.map((l) => JSON.parse(l));
    const complete = records.at(-1);
    assert.equal(complete.type, "complete");
    assert.equal(
      complete.data.sha256,
      createHash("sha256")
        .update(lines.slice(0, -1).join("\n") + "\n")
        .digest("hex"),
    );
    assert.equal(
      records.filter((r) => r.type === "content").length,
      await db.contentItem.count({ where: { organizationId: org.id } }),
    );
    for (const forbidden of [
      "passwordHash",
      "tokenHash",
      "runToken",
      "objectKey",
      "SECRET OUTSIDE WORKSPACE",
      process.env.S3_SECRET_KEY!,
    ])
      assert.equal(text.includes(forbidden), false, forbidden);
    assert.equal(
      (
        await fetch(base + root + "/operations/export", {
          headers: owner.headers,
        })
      ).status,
      429,
    );
    await db.membership.delete({
      where: {
        userId_organizationId: { userId: owner.id, organizationId: org.id },
      },
    });
    assert.equal((await owner.call(root + "/content")).status, 404);
    assert.equal((await owner.call(root + "/operations/export")).status, 404);
    await db.session.deleteMany({ where: { userId: owner.id } });
    assert.equal((await owner.call("/auth/me")).status, 401);
  },
);
