import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { db, actor, until } from "../support/http";
let server: ChildProcess | undefined;
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue("marketing-ai", { connection: redis as any });
after(async () => {
  await queue.resume();
  await queue.close();
  await redis.quit();
  if (server) {
    const done = new Promise((r) => server!.once("close", r));
    server.kill("SIGTERM");
    const force = setTimeout(() => server!.kill("SIGKILL"), 3000);
    await done;
    clearTimeout(force);
  }
  // Immutable financial rows remain in the disposable harness DB until it is discarded.
  await db.$disconnect();
});
test(
  "credits reserve atomically, reject unauthorized changes, settle once and retain failed-call review",
  { timeout: 60000 },
  async () => {
    const org = await db.organization.create({
      data: { name: "Credit accounting QA" },
    });
    const owner = await actor(org.id),
      creator = await actor(org.id, "CREATOR"),
      outsider = await actor(null),
      admin = await actor(null);
    const url = "http://127.0.0.1:4002/api";
    server = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
      env: {
        ...process.env,
        API_PORT: "4002",
        BILLING_MODE: "credits",
        PLATFORM_ADMIN_USER_IDS: admin.id,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const log = createWriteStream(".local/credits-api.log");
    server.stdout!.pipe(log);
    server.stderr!.pipe(log);
    await until(async () => {
      try {
        return (await fetch(url + "/health")).ok;
      } catch {
        return false;
      }
    }, Boolean);
    const call = async (
      who: typeof owner,
      path: string,
      method = "GET",
      body?: unknown,
    ) => {
      const r = await fetch(url + path, {
        method,
        headers: { ...who.headers, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: r.status, body: await r.json() };
    };
    const root = `/workspaces/${org.id}`;
    await owner.call(root + "/brand", "PUT", {
      profile: { name: "Accounting brand" },
      creativeDna: {},
      revision: 0,
    });
    const adjustment = {
      requestKey: randomUUID(),
      amount: 20,
      reason: "Synthetic verification grant; no payment",
    };
    const grant = `/platform/credits/${org.id}/adjust`;
    assert.equal(
      (await call(owner, grant, "POST", adjustment)).status,
      403,
      "tenant ownership is not platform authority",
    );
    assert.equal(
      (await call(admin, grant, "POST", adjustment)).status,
      403,
      "unverified admin cannot grant credits",
    );
    await db.user.update({
      where: { id: admin.id },
      data: { verifiedAt: new Date() },
    });
    const grants = await Promise.all([
      call(admin, grant, "POST", adjustment),
      call(admin, grant, "POST", adjustment),
    ]);
    assert.equal(grants[0].status, 201, JSON.stringify(grants[0].body));
    assert.equal(grants[1].body.id, grants[0].body.id);
    assert.equal(
      (await call(admin, grant, "POST", { ...adjustment, amount: 99 })).status,
      409,
    );
    assert.equal((await call(creator, root + "/credits")).status, 403);
    assert.equal((await call(outsider, root + "/credits")).status, 404);
    assert.equal((await call(owner, root + "/credits")).body.available, 20);
    // PGlite's socket bridge can disconnect after a trigger exception. The
    // direct PGlite upgrade/restore suite verifies these exact SQL errors.
    // Native CI must also prove that Prisma receives the immutable rejection.
    if (process.env.MOS_TEST_DATABASE === "native") {
      await assert.rejects(
        db.creditEntry.update({
          where: { id: grants[0].body.id },
          data: { availableDelta: 999 },
        }),
        /immutable/,
      );
      await assert.rejects(
        db.creditEntry.delete({ where: { id: grants[0].body.id } }),
        /immutable/,
      );
    }
    assert.equal(
      (
        await db.creditEntry.findUniqueOrThrow({
          where: { id: grants[0].body.id },
        })
      ).availableDelta,
      20,
    );
    const request = {
      requestKey: randomUUID(),
      task: "content",
      prompt: "Create a credit-accounted factual draft",
      maxCredits: 3,
    };
    assert.equal(
      (
        await call(owner, root + "/ai/jobs", "POST", {
          ...request,
          maxCredits: 2,
        })
      ).status,
      409,
    );
    await queue.pause();
    const pending = await call(owner, root + "/ai/jobs", "POST", request);
    assert.equal(pending.status, 201, JSON.stringify(pending.body));
    let summary = (await call(owner, root + "/credits")).body;
    assert.equal(summary.available, 17);
    assert.equal(summary.reserved, 3);
    const replay = await call(owner, root + "/ai/jobs", "POST", request);
    assert.equal(replay.body.id, pending.body.id);
    assert.equal(
      (await call(owner, root + `/ai/jobs/${pending.body.id}/cancel`, "POST"))
        .status,
      201,
    );
    summary = (await call(owner, root + "/credits")).body;
    assert.equal(summary.available, 20);
    assert.equal(summary.reserved, 0);
    assert.equal(
      (await call(owner, root + `/ai/jobs/${pending.body.id}/cancel`, "POST"))
        .status,
      409,
    );
    await queue.resume();
    const run = await call(owner, root + "/ai/jobs", "POST", {
      ...request,
      requestKey: randomUUID(),
    });
    const done = await until(
      () => db.aIJob.findUniqueOrThrow({ where: { id: run.body.id } }),
      (r) => ["SUCCEEDED", "FAILED"].includes(r.status),
    );
    assert.equal(done.status, "SUCCEEDED", done.error || "");
    summary = (await call(owner, root + "/credits")).body;
    assert.equal(summary.available, 17);
    assert.equal(summary.reserved, 0);
    assert.equal(
      await db.creditEntry.count({
        where: { organizationId: org.id, kind: "CONSUME" },
      }),
      1,
    );
    const invalid = await call(owner, root + "/ai/jobs", "POST", {
      ...request,
      requestKey: randomUUID(),
      prompt: "INVALID: produce the intentionally invalid provider fixture",
    });
    await until(
      () => db.aIJob.findUniqueOrThrow({ where: { id: invalid.body.id } }),
      (r) => r.status === "FAILED",
    );
    summary = (await call(owner, root + "/credits")).body;
    assert.equal(summary.available, 14);
    assert.equal(summary.reserved, 3);
    const reservation = summary.reservations.find(
      (r: any) => r.id === invalid.body.creditReservationId,
    );
    assert.equal(reservation.state, "REVIEW");
    const review = `/platform/credits/reservations/${reservation.id}/resolve`;
    assert.equal(
      (
        await call(owner, review, "POST", {
          consumed: 0,
          reason: "Unauthorized credit release attempt",
        })
      ).status,
      403,
    );
    const released = await call(admin, review, "POST", {
      consumed: 0,
      reason: "Fixture review confirms this test credit should be released",
    });
    assert.equal(released.status, 201);
    assert.equal(
      (
        await call(admin, review, "POST", {
          consumed: 1,
          reason: "Conflicting duplicate resolution attempt",
        })
      ).status,
      409,
    );
    const account = await db.creditAccount.findUniqueOrThrow({
      where: { organizationId: org.id },
    });
    assert.equal(account.available, 17);
    assert.equal(account.reserved, 0);
    const ledger = await db.creditEntry.findMany({
      where: { organizationId: org.id },
      orderBy: { sequence: "asc" },
    });
    assert.equal(
      ledger.reduce((s, e) => s + e.availableDelta, 0),
      account.available,
    );
    assert.equal(
      ledger.reduce((s, e) => s + e.reservedDelta, 0),
      account.reserved,
    );
    assert.equal(ledger.length, account.revision);
    assert.ok(
      (await call(owner, root + "/credits/entries")).body.items.every(
        (e: any) => !e.requestHash && !e.operationKey,
      ),
    );
    const poor = await db.organization.create({
      data: { name: "Insufficient credit QA" },
    });
    await db.membership.create({
      data: { organizationId: poor.id, userId: owner.id, role: "OWNER" },
    });
    await owner.call(`/workspaces/${poor.id}/brand`, "PUT", {
      profile: { name: "Atomic reservation brand" },
      creativeDna: {},
      revision: 0,
    });
    await call(admin, `/platform/credits/${poor.id}/adjust`, "POST", {
      requestKey: randomUUID(),
      amount: 3,
      reason: "Exactly one job worth of test credits",
    });
    await queue.pause();
    const raced = await Promise.all(
      [1, 2].map((n) =>
        call(owner, `/workspaces/${poor.id}/ai/jobs`, "POST", {
          ...request,
          requestKey: randomUUID(),
          prompt: `Concurrent reservation candidate number ${n}`,
        }),
      ),
    );
    assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
    const denied = raced.find((r) => r.status === 409)!;
    assert.match(denied.body.error.message, /Insufficient credits/);
    await call(
      owner,
      `/workspaces/${poor.id}/ai/jobs/${raced.find((r) => r.status === 201)!.body.id}/cancel`,
      "POST",
    );
    await queue.resume();
  },
);
