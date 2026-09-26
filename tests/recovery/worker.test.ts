import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { db, actor, base, draft, scene, until } from "../support/http";
import { grantCredits, reserveCredits } from "../../packages/core/credits";
assert.equal(
  process.env.MOS_ISOLATED_TEST_HARNESS,
  "true",
  "Fault tests require the isolated harness; never target a real workspace.",
);
const children: ChildProcess[] = [];
const users: string[] = [],
  orgs: string[] = [];
function restart(kind: "worker" | "render-worker") {
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
