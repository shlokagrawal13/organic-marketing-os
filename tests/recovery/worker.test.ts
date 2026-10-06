import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { db, actor, base, draft, scene, until } from "../support/http";
import { grantCredits, reserveCredits } from "../../packages/core/credits";
import { retainPrivateMediaOutputForReview } from "../../packages/core/media-generation-runtime";
assert.equal(
  process.env.MOS_ISOLATED_TEST_HARNESS,
  "true",
  "Fault tests require the isolated harness; never target a real workspace.",
);
const children: ChildProcess[] = [];
const users: string[] = [],
  orgs: string[] = [];
function restart(kind: "worker" | "render-worker" | "media-generation-worker") {
  const child = spawn(process.execPath, [`dist/apps/api/src/${kind}.js`], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const file = createWriteStream(`.local/recovery-${kind}.log`, { flags: "a" });
  child.stdout!.pipe(file);
  child.stderr!.pipe(file);
  children.push(child);
  return child;
}
async function kill(pid: number, signal: NodeJS.Signals) {
  const child = children.find((c) => c.pid === pid);
  if (child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    // Register before signaling: do not backdate the DB lease while the old
    // worker can still renew it, and do not rely on a fixed 300ms exit delay.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Worker did not exit")),
        5000,
      );
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      process.kill(pid, signal);
    });
    return;
  }
  process.kill(pid, signal);
  await new Promise((r) => setTimeout(r, 300));
}
after(async () => {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 400));
  for (const c of children) if (c.exitCode === null) c.kill("SIGKILL");
  await db.organization.deleteMany({
    where: { id: { in: orgs }, creditAccount: { is: null } },
  });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test(
  "AI worker reconciles lost queue entries and fails interrupted provider calls without replay",
  { timeout: 40000 },
  async () => {
    await kill(Number(process.env.TEST_AI_WORKER_PID), "SIGKILL");
    const org = await db.organization.create({ data: { name: "Recovery QA" } });
    orgs.push(org.id);
    const a = await actor(org.id);
    users.push(a.id);
    const root = `/workspaces/${org.id}`;
    await a.call(root + "/brand", "PUT", {
      profile: { name: "Recovery brand" },
      creativeDna: {},
      revision: 0,
    });
    const request = {
      task: "content",
      requestKey: randomUUID(),
      prompt: "Recover a dispatched job after queue loss",
    };
    const queued = await a.call(root + "/ai/jobs", "POST", request);
    assert.equal(queued.status, 201);
    await db.aIJob.update({
      where: { id: queued.body.id },
      data: { dispatchedAt: new Date() },
    });
    const stale = await db.aIJob.create({
      data: {
        organizationId: org.id,
        actorId: a.id,
        requestKey: randomUUID(),
        task: "content",
        input: { prompt: "Never replay this uncertain provider call" },
        status: "RUNNING",
        startedAt: new Date(Date.now() - 120000),
        heartbeatAt: new Date(Date.now() - 120000),
        runToken: randomUUID(),
      },
    });
    let running = restart("worker");
    const finished = await until(
      () => db.aIJob.findUniqueOrThrow({ where: { id: queued.body.id } }),
      (r) => ["SUCCEEDED", "FAILED"].includes(r.status),
    );
    assert.equal(finished.status, "SUCCEEDED", finished.error || "");
    assert.equal(
      (
        await until(
          () => db.aIJob.findUniqueOrThrow({ where: { id: stale.id } }),
          (r) => r.status === "FAILED",
        )
      ).status,
      "FAILED",
    );
    const sceneJob = await a.call(root + "/ai/jobs", "POST", {
      task: "scene",
      requestKey: randomUUID(),
      prompt: "Rewrite only this opening scene",
      scene,
    });
    const rewritten = await until(
      () => db.aIJob.findUniqueOrThrow({ where: { id: sceneJob.body.id } }),
      (r) => ["SUCCEEDED", "FAILED"].includes(r.status),
    );
    assert.equal(rewritten.status, "SUCCEEDED");
    assert.equal((rewritten.output as any).id, scene.id);
    const prompt =
      "HOLD: simulate a worker interruption after provider acceptance";
    const started = await a.call(root + "/ai/jobs", "POST", {
      task: "content",
      requestKey: randomUUID(),
      prompt,
    });
    assert.equal(started.status, 201);
    const reservation = await db.$transaction(async (tx) => {
      await grantCredits(
        tx,
        org.id,
        5,
        randomUUID(),
        "Synthetic interruption verification grant",
        a.id,
      );
      const held = await reserveCredits(
        tx,
        org.id,
        `ai:${started.body.id}`,
        3,
        a.id,
      );
      await tx.aIJob.update({
        where: { id: started.body.id },
        data: { creditReservationId: held.id },
      });
      return held;
    });
    await until(
      async () => await (await fetch("http://127.0.0.1:4999/stats")).json(),
      (r) => r[prompt] === 1,
    );
    await kill(running.pid!, "SIGKILL");
    // Advance the stale heartbeat after an actual process kill instead of waiting a minute.
    await db.aIJob.update({
      where: { id: started.body.id },
      data: { heartbeatAt: new Date(Date.now() - 120000) },
    });
    running = restart("worker");
    const failed = await until(
      () => db.aIJob.findUniqueOrThrow({ where: { id: started.body.id } }),
      (r) => r.status === "FAILED",
    );
    assert.match(failed.error!, /interrupted/i);
    assert.equal(failed.output, null);
    assert.equal(
      (
        await db.creditReservation.findUniqueOrThrow({
          where: { id: reservation.id },
        })
      ).state,
      "REVIEW",
    );
    assert.equal(
      (
        await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: org.id },
        })
      ).reserved,
      3,
    );
    const stats = await (await fetch("http://127.0.0.1:4999/stats")).json();
    assert.equal(stats[prompt], 1);
    assert.equal(stats["Never replay this uncertain provider call"], undefined);
    assert.equal(
      (await a.call(root + "/operations/status")).body.jobs.ai.find(
        (r: any) => r.status === "FAILED",
      )._count,
      2,
    );
  },
);

test(
  "running render cancellation, graceful worker interruption and immutable retry",
  { timeout: 45000 },
  async () => {
    const org = await db.organization.create({
      data: { name: "Render interruption QA" },
    });
    orgs.push(org.id);
    const a = await actor(org.id);
    users.push(a.id);
    const root = `/workspaces/${org.id}`;
    const content = await a.call(root + "/content", "POST", {
      ...draft,
      format: "Video",
      scenes: [
        { ...scene, duration: 30, onScreenText: "Cancellation verification" },
      ],
    });
    const queue = async () =>
      await a.call(root + "/renders", "POST", {
        contentId: content.body.id,
        revision: 1,
        requestKey: randomUUID(),
        options: { resolution: "1080" },
      });
    const cancel = await queue();
    assert.equal(cancel.status, 201);
    await until(
      () => db.renderJob.findUniqueOrThrow({ where: { id: cancel.body.id } }),
      (r) => r.status === "RUNNING" && r.stage.startsWith("Rendering scene"),
    );
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(
      (await a.call(`${root}/renders/${cancel.body.id}/cancel`, "POST")).status,
      201,
    );
    await new Promise((r) => setTimeout(r, 1400));
    const canceled = await db.renderJob.findUniqueOrThrow({
      where: { id: cancel.body.id },
    });
    assert.equal(canceled.status, "CANCELED");
    assert.equal(canceled.outputKey, null);
    assert.equal(
      (
        await fetch(`${base}${root}/renders/${cancel.body.id}/file/video`, {
          headers: a.headers,
        })
      ).status,
      404,
    );
    const stop = await queue();
    await until(
      () => db.renderJob.findUniqueOrThrow({ where: { id: stop.body.id } }),
      (r) => r.status === "RUNNING" && r.stage.startsWith("Rendering scene"),
    );
    await new Promise((r) => setTimeout(r, 300));
    await kill(Number(process.env.TEST_RENDER_WORKER_PID), "SIGTERM");
    const interrupted = await until(
      () => db.renderJob.findUniqueOrThrow({ where: { id: stop.body.id } }),
      (r) => r.status === "FAILED",
    );
    assert.equal(interrupted.outputKey, null);
    restart("render-worker");
    const key = randomUUID();
    const retried = await a.call(
      `${root}/renders/${stop.body.id}/retry`,
      "POST",
      { requestKey: key },
    );
    assert.equal(retried.status, 201);
    const replay = await a.call(
      `${root}/renders/${stop.body.id}/retry`,
      "POST",
      { requestKey: key },
    );
    assert.equal(replay.body.id, retried.body.id);
    assert.notEqual(retried.body.id, stop.body.id);
    const done = await until(
      () => db.renderJob.findUniqueOrThrow({ where: { id: retried.body.id } }),
      (r) => ["SUCCEEDED", "FAILED"].includes(r.status),
      25000,
    );
    assert.equal(done.status, "SUCCEEDED", done.error || "");
    assert.equal(
      (await db.renderJob.findUniqueOrThrow({ where: { id: stop.body.id } }))
        .status,
      "FAILED",
    );
  },
);

test(
  "media worker restart preserves accepted video IDs and private outputs, and never replays ambiguous paid submissions",
  { timeout: 300000 },
  async () => {
    await kill(Number(process.env.TEST_MEDIA_WORKER_PID), "SIGKILL");
    const org = await db.organization.create({
      data: { name: "Media recovery fixture" },
    });
    orgs.push(org.id);
    const a = await actor(org.id);
    users.push(a.id);
    const root = `/workspaces/${org.id}/media-generations`;
    const create = async (kind: string, prompt: string) =>
      a.call(root, "POST", {
        requestKey: randomUUID(),
        maxCredits: 0,
        request: {
          kind,
          model: `fixture-${kind}`,
          prompt,
          rightsConfirmed: true,
          rightsNote: "Isolated recovery fixture",
          maxCostUsd: 0.1,
        },
      });
    const prompt = "HOLD: media worker killed after acceptance";
    const queued = await create("image", prompt);
    assert.equal(queued.status, 201);
    const reservation = await db.$transaction(async (tx) => {
      await grantCredits(
        tx,
        org.id,
        5,
        randomUUID(),
        "Synthetic media recovery credit grant",
        a.id,
      );
      const held = await reserveCredits(
        tx,
        org.id,
        `media:${queued.body.id}`,
        2,
        a.id,
      );
      await tx.mediaGeneration.update({
        where: { id: queued.body.id },
        data: { creditReservationId: held.id, quotedCredits: 2 },
      });
      return held;
    });
    let running = restart("media-generation-worker");
    await until(
      async () => (await fetch("http://127.0.0.1:4998/stats")).json(),
      (r) => r[prompt] === 1,
    );
    await kill(running.pid!, "SIGKILL");
    await db.mediaGeneration.update({
      where: { id: queued.body.id },
      data: { heartbeatAt: new Date(Date.now() - 120000) },
    });
    running = restart("media-generation-worker");
    const unknown = await until(
      () =>
        db.mediaGeneration.findUniqueOrThrow({ where: { id: queued.body.id } }),
      (r) => r.state === "UNKNOWN",
    );
    assert.equal(unknown.assetId, null);
    assert.equal(unknown.actualCostUsd, null);
    assert.equal(
      (
        await db.creditReservation.findUniqueOrThrow({
          where: { id: reservation.id },
        })
      ).state,
      "REVIEW",
    );
    const videoPrompt = "HOLD_POLL_ONCE: Recovery video receipt";
    const video = await create("video", videoPrompt);
    assert.equal(video.status, 201);
    const pending = await until(
      () =>
        db.mediaGeneration.findUniqueOrThrow({ where: { id: video.body.id } }),
      (r) => r.state === "PENDING",
    );
    assert.ok(pending.providerJobId);
    const connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
    const queue = new Queue("marketing-media-generation", {
      connection: connection as any,
    });
    try {
      // PENDING alone is not a reliable kill barrier: its original queue job
      // may already be completed. Hold a real poll so the queue is always active.
      await until(
        async () => (await fetch("http://127.0.0.1:4998/poll-stats")).json(),
        (r) => r[videoPrompt] === 1,
      );
      const active = await queue.getJob(video.body.id);
      assert.ok(active);
      assert.equal(await active.getState(), "active");
      await kill(running.pid!, "SIGKILL");
      const remainingLockMs = await connection.pttl(
        queue.toKey(video.body.id) + ":lock",
      );
      assert.ok(
        remainingLockMs > 25000,
        `Expected surviving queue lock, got ${remainingLockMs}ms`,
      );
      assert.equal(await active.getState(), "active");
      console.log(
        JSON.stringify({
          event: "recovery.active_poll_interrupted",
          remainingLockMs,
          previousDeadlineMs: 25000,
        }),
      );
      // Expire only the DB claim, after actual process exit. Redis lock/active
      // state stay untouched: production BullMQ expiry/stall handling must run.
      await db.mediaGeneration.update({
        where: { id: video.body.id },
        data: { heartbeatAt: new Date(Date.now() - 120000) },
      });
      running = restart("media-generation-worker");
      // Runtime uses a 120s lock and 30s stalled checks. Allow two stalled scans
      // plus 30s for polling/private ingestion; failures are still bounded.
      const complete = await until(
        () =>
          db.mediaGeneration.findUniqueOrThrow({
            where: { id: video.body.id },
          }),
        (r) => r.state === "SUCCEEDED",
        210000,
      );
      assert.equal(complete.providerJobId, pending.providerJobId);
      assert.ok(complete.assetId);
      await until(
        () => active.getState(),
        (state) => state === "completed",
      );
    } finally {
      await queue.close();
      await connection.quit();
    }
    await kill(running.pid!, "SIGKILL");
    const ready = await create("image", "Never submit saved private output");
    assert.equal(ready.status, 201);
    const { ObjectStore } = await import("../../packages/core/object-store");
    const { readFile } = await import("node:fs/promises");
    const store = new ObjectStore(),
      key = `${org.id}/generated/${ready.body.id}/${randomUUID()}`;
    await store.put(
      key,
      await readFile(".local/media-fixtures/product.png"),
      "image/png",
    );
    await db.mediaGeneration.update({
      where: { id: ready.body.id },
      data: {
        state: "OUTPUT_READY",
        outputKey: key,
        startedAt: new Date(),
        runToken: randomUUID(),
        heartbeatAt: new Date(Date.now() - 120000),
      },
    });
    restart("media-generation-worker");
    await until(
      () =>
        db.mediaGeneration.findUniqueOrThrow({ where: { id: ready.body.id } }),
      (r) => r.state === "SUCCEEDED",
    );
    const stats = await (await fetch("http://127.0.0.1:4998/stats")).json();
    assert.equal(stats[prompt], 1);
    assert.equal(stats[videoPrompt], 1);
    assert.equal(stats["Never submit saved private output"], undefined);
  },
);

test(
  "media output reconciliation retains private bytes and marks credits for review",
  { timeout: 20000 },
  async () => {
    const org = await db.organization.create({
      data: { name: "Media output reconciliation QA" },
    });
    orgs.push(org.id);
    const a = await actor(org.id);
    users.push(a.id);
    const { ObjectStore } = await import("../../packages/core/object-store");
    const { readFile } = await import("node:fs/promises");
    const token = randomUUID();
    const store = new ObjectStore();
    const generation = await db.$transaction(async (tx) => {
      await grantCredits(
        tx,
        org.id,
        5,
        randomUUID(),
        "Synthetic media output reconciliation grant",
        a.id,
      );
      const reservation = await reserveCredits(
        tx,
        org.id,
        `media:${token}`,
        2,
        a.id,
      );
      return tx.mediaGeneration.create({
        data: {
          organizationId: org.id,
          actorId: a.id,
          requestKey: randomUUID(),
          requestHash: randomUUID(),
          request: {
            kind: "image",
            model: "fixture-image",
            prompt: "Retain provider output for reconciliation",
            rightsConfirmed: true,
            rightsNote: "Synthetic retained provider output fixture",
            maxCostUsd: 0.1,
            sourceAssetIds: [],
          },
          configuration: {
            version: 1,
            provider: "openai",
            baseUrl: "http://127.0.0.1:4998/v1",
            kind: "image",
            model: "fixture-image",
            estimatedCostUsd: 0.1,
            credits: 2,
            allowedPlans: ["free", "starter", "growth", "self_hosted"],
          },
          state: "SUBMITTING",
          startedAt: new Date(),
          runToken: token,
          heartbeatAt: new Date(),
          creditReservationId: reservation.id,
          quotedCostUsd: 0.1,
          quotedCredits: 2,
        },
      });
    });
    const key = `${org.id}/generated/${generation.id}/${token}`;
    await store.put(
      key,
      await readFile(".local/media-fixtures/product.png"),
      "image/png",
    );
    assert.equal(
      await retainPrivateMediaOutputForReview(
        db,
        generation,
        token,
        key,
        "req_reconcile_fixture",
      ),
      true,
    );
    const retained = await db.mediaGeneration.findUniqueOrThrow({
      where: { id: generation.id },
    });
    assert.equal(retained.state, "UNKNOWN");
    assert.equal(retained.outputKey, key);
    assert.equal(retained.runToken, null);
    assert.match(retained.error!, /private storage/i);
    assert.equal(
      (
        await db.creditReservation.findUniqueOrThrow({
          where: { id: retained.creditReservationId! },
        })
      ).state,
      "REVIEW",
    );
    const audit = await db.auditLog.findFirstOrThrow({
      where: {
        organizationId: org.id,
        entityId: generation.id,
        action: "media_generation.output_reconciliation_needed",
      },
    });
    assert.equal((audit.detail as any).outputRetained, true);
  },
);
