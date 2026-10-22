// Synthetic cross-store queue fixture; injected into an isolated runtime only.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
export async function runComposeRecovery(ctx) {
  const { mode, state, db, store, require, call, sha, sleep } = ctx;
  const provider = "http://fixture-provider:4999";
  const rows = async (r) =>
    JSON.parse(
      JSON.stringify({
        queued: await db.aIJob.findUniqueOrThrow({ where: { id: r.queued } }),
        uncertain: await db.aIJob.findUniqueOrThrow({
          where: { id: r.uncertain },
        }),
        retained: await db.mediaGeneration.findUniqueOrThrow({
          where: { id: r.retained },
        }),
        render: await db.renderJob.findUniqueOrThrow({
          where: { id: r.render },
        }),
        account: await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: state.owner.org },
        }),
        ledger: await db.creditEntry.findMany({
          where: { organizationId: state.owner.org },
          orderBy: { sequence: "asc" },
        }),
        reservations: await db.creditReservation.findMany({
          where: { id: { in: Object.values(r.reservations) } },
          orderBy: { id: "asc" },
        }),
      }),
    );
  const stats = async () => {
    const res = await fetch(provider + "/stats");
    assert.equal(res.status, 200);
    return await res.json();
  };
  if (mode === "recovery-seed") {
    const actor = await db.user.findUniqueOrThrow({
      where: { email: state.owner.email },
    });
    const r = {
      queued: randomUUID(),
      uncertain: randomUUID(),
      retained: randomUUID(),
      render: randomUUID(),
      queuedPrompt: "COMPOSE_RECOVERY_QUEUED_" + randomUUID(),
      uncertainPrompt: "COMPOSE_RECOVERY_UNCERTAIN_" + randomUUID(),
      reservations: {},
    };
    await db.brandBrain.upsert({
      where: { organizationId: state.owner.org },
      create: {
        organizationId: state.owner.org,
        profile: { name: "Synthetic recovery workspace" },
        creativeDna: {},
      },
      update: {},
    });
    // Seed a synthetic provider acceptance before the quiesced backup. This is
    // not an actual crashed worker call; separate worker-crash tests remain.
    const accepted = await fetch(provider + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          { content: "Synthetic fixture" },
          { content: JSON.stringify({ input: { prompt: r.uncertainPrompt } }) },
        ],
      }),
    });
    assert.equal(accepted.status, 200);
    await accepted.arrayBuffer();
    assert.deepEqual(await stats(), { [r.uncertainPrompt]: 1 });
    const {
      grantCredits,
      reserveCredits,
    } = require("/app/dist/packages/core/credits.js");
    await db.$transaction(async (tx) => {
      await grantCredits(
        tx,
        state.owner.org,
        100,
        randomUUID(),
        "Synthetic cross-store backup recovery grant",
        actor.id,
      );
      for (const [name, amount] of [
        ["queued", 3],
        ["uncertain", 3],
        ["retained", 2],
      ]) {
        const reservation = await reserveCredits(
          tx,
          state.owner.org,
          `fixture-recovery:${r[name]}`,
          amount,
          actor.id,
        );
        r.reservations[name] = reservation.id;
      }
      for (const kind of ["queued", "uncertain"])
        await tx.aIJob.create({
          data: {
            id: r[kind],
            organizationId: state.owner.org,
            actorId: actor.id,
            requestKey: randomUUID(),
            task: "content",
            input: { prompt: r[kind + "Prompt"] },
            creditReservationId: r.reservations[kind],
            ...(kind === "uncertain"
              ? {
                  status: "RUNNING",
                  attempts: 1,
                  startedAt: new Date(Date.now() - 120000),
                  heartbeatAt: new Date(Date.now() - 120000),
                  runToken: randomUUID(),
                }
              : { dispatchedAt: new Date() }),
          },
        });
    });
    const dir = mkdtempSync(tmpdir() + "/compose-recovery-");
    let bytes;
    try {
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360",
        "-frames:v",
        "1",
        "-threads",
        "1",
        dir + "/retained.png",
      ]);
      bytes = readFileSync(dir + "/retained.png");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    r.outputKey = `${state.owner.org}/generated/${r.retained}/retained.png`;
    r.outputSha = sha(bytes);
    await store.put(r.outputKey, bytes, "image/png");
    await db.mediaGeneration.create({
      data: {
        id: r.retained,
        organizationId: state.owner.org,
        actorId: actor.id,
        requestKey: randomUUID(),
        requestHash: "synthetic-retained-output",
        request: {
          kind: "image",
          model: "synthetic-fixture",
          prompt: "Synthetic retained image",
          rightsConfirmed: true,
          rightsNote: "Synthetic FFmpeg-generated retained output",
          sourceAssetIds: [],
          maxCostUsd: 0.1,
        },
        configuration: {
          version: 1,
          provider: "openai",
          baseUrl: "https://api.openai.com/v1",
          kind: "image",
          model: "synthetic-fixture",
          estimatedCostUsd: 0.1,
          credits: 2,
          allowedPlans: ["self_hosted"],
        },
        state: "OUTPUT_READY",
        outputKey: r.outputKey,
        providerRequestId: "synthetic-accepted-output",
        quotedCostUsd: 0.1,
        quotedCredits: 2,
        creditReservationId: r.reservations.retained,
        startedAt: new Date(),
      },
    });
    const old = await db.renderJob.findUniqueOrThrow({
      where: { id: state.renderId },
    });
    await db.renderJob.create({
      data: {
        id: r.render,
        organizationId: old.organizationId,
        contentId: old.contentId,
        contentRevision: old.contentRevision,
        actorId: actor.id,
        requestKey: randomUUID(),
        requestHash: createHash("sha256").update(r.render).digest("hex"),
        snapshot: old.snapshot,
        options: old.options,
        totalScenes: old.totalScenes,
        inputs: { create: { assetId: state.assetId } },
      },
    });
    r.before = await rows(r);
    assert.equal(r.before.account.available, 92);
    assert.equal(r.before.account.reserved, 8);
    return {
      recovery: r,
      sqlCounts: { ...state.sqlCounts, renders: await db.renderJob.count() },
    };
  }
  const r = state.recovery;
  if (mode === "recovery-references") {
    const references = [];
    for (const asset of await db.asset.findMany())
      references.push({
        entity: "Asset",
        id: asset.id,
        organizationId: asset.organizationId,
        field: "objectKey",
        key: asset.objectKey,
        bytes: asset.bytes,
        sha256: asset.sha256,
      });
    for (const segment of await db.renderSegment.findMany())
      references.push({
        entity: "RenderSegment",
        id: segment.id,
        organizationId: segment.organizationId,
        field: "objectKey",
        key: segment.objectKey,
        bytes: segment.bytes,
      });
    for (const render of await db.renderJob.findMany())
      for (const field of ["outputKey", "thumbnailKey", "captionsKey"])
        if (render[field])
          references.push({
            entity: "RenderJob",
            id: render.id,
            organizationId: render.organizationId,
            field,
            key: render[field],
            ...(field === "outputKey" ? { bytes: render.outputBytes } : {}),
          });
    for (const job of await db.mediaGeneration.findMany({
      where: { outputKey: { not: null } },
    }))
      references.push({
        entity: "MediaGeneration",
        id: job.id,
        organizationId: job.organizationId,
        field: "outputKey",
        key: job.outputKey,
        ...(job.id === r.retained ? { sha256: r.outputSha } : {}),
      });
    return references;
  }
  if (mode === "recovery-database-baseline") {
    assert.deepEqual(await rows(r), r.before);
    return { restoredRecoveryDatabaseUnchanged: true };
  }
  if (mode === "recovery-baseline") {
    assert.deepEqual(await rows(r), r.before);
    assert.equal(sha(await store.read(r.outputKey, 2000000)), r.outputSha);
    return { restoredQueuedUncertainAndPrivateOutputRowsMatch: true };
  }
  const Redis = require("ioredis"),
    { Queue } = require("bullmq"),
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  const queues = [
    "marketing-ai",
    "marketing-render",
    "marketing-media-generation",
  ].map((name) => new Queue(name, { connection }));
  try {
    if (mode === "recovery-recheck") {
      let first,
        ready = false;
      for (let i = 0; i < 100; i++) {
        const values = (
          await connection.mget(
            "worker:heartbeat",
            "render:heartbeat",
            "media-generation:heartbeat",
          )
        ).map(Number);
        if (values.every((v) => v >= state.restartAfter)) {
          if (!first) first = values;
          else if (values.every((v, index) => v > first[index])) {
            ready = true;
            break;
          }
        }
        await sleep(200);
      }
      assert.ok(
        ready,
        "All three restarted workers must complete fresh dispatcher cycles.",
      );
      assert.deepEqual(await rows(r), state.recoveryAfter);
    } else {
      assert.equal(mode, "recovery-verify");
      let complete = false;
      for (let i = 0; i < 180; i++) {
        const current = await rows(r);
        assert.notEqual(
          current.queued.status,
          "FAILED",
          current.queued.error || "Queued AI failed",
        );
        assert.notEqual(
          current.render.status,
          "FAILED",
          current.render.error || "Queued render failed",
        );
        assert.notEqual(
          current.retained.state,
          "FAILED",
          current.retained.error || "Private output ingest failed",
        );
        if (
          current.queued.status === "SUCCEEDED" &&
          current.uncertain.status === "FAILED" &&
          current.retained.state === "SUCCEEDED" &&
          current.render.status === "SUCCEEDED"
        ) {
          const completed = await Promise.all(
            queues.map(async (queue, index) =>
              (
                await queue.getJob([r.queued, r.render, r.retained][index])
              )?.getState(),
            ),
          );
          if (completed.every((value) => value === "completed")) {
            complete = true;
            break;
          }
        }
        await sleep(500);
      }
      assert.ok(
        complete,
        "Restored PostgreSQL jobs did not complete from fresh Redis.",
      );
    }
    const current = await rows(r),
      counts = await stats();
    assert.deepEqual(counts, { [r.queuedPrompt]: 1 }); // uncertain acceptance must never replay
    assert.equal(current.queued.attempts, 1);
    assert.equal(current.uncertain.attempts, 1);
    assert.match(current.uncertain.error, /interrupted.*review/i);
    assert.equal(await db.aIUsage.count({ where: { jobId: r.queued } }), 1);
    assert.equal(await db.aIUsage.count({ where: { jobId: r.uncertain } }), 0);
    assert.equal(current.account.available, 92);
    assert.equal(current.account.reserved, 3);
    assert.deepEqual(
      current.ledger.slice(0, r.before.ledger.length),
      r.before.ledger,
    );
    assert.equal(current.ledger.length, r.before.ledger.length + 2);
    assert.equal(current.ledger.filter((x) => x.kind === "CONSUME").length, 2);
    for (const name of ["queued", "retained", "uncertain"]) {
      const reservation = current.reservations.find(
        (x) => x.id === r.reservations[name],
      );
      assert.equal(
        reservation.state,
        name === "uncertain" ? "REVIEW" : "SETTLED",
      );
      assert.equal(
        reservation.consumed,
        { queued: 3, retained: 2, uncertain: 0 }[name],
      );
    }
    for (const statement of [
      "UPDATE \"CreditEntry\" SET reason='Synthetic forbidden edit' WHERE id=$1",
      'DELETE FROM "CreditEntry" WHERE id=$1',
    ])
      await assert.rejects(
        db.$executeRawUnsafe(statement, current.ledger[0].id),
        /immutable/,
      );
    assert.deepEqual((await rows(r)).ledger, current.ledger);
    for (let i = 0; i < queues.length; i++) {
      const job = await queues[i].getJob([r.queued, r.render, r.retained][i]);
      assert.ok(job);
      assert.equal(await job.getState(), "completed");
      const queued = await queues[i].getJobCounts(
        "active",
        "waiting",
        "delayed",
        "prioritized",
        "waiting-children",
      );
      assert.equal(
        Object.values(queued).reduce((a, b) => a + b, 0),
        0,
      );
      const terminal = await queues[i].getJobCounts("completed", "failed");
      assert.equal(terminal.completed, 1);
      assert.equal(terminal.failed, 0);
    }
    const asset = await db.asset.findUniqueOrThrow({
      where: { id: current.retained.assetId },
    });
    assert.equal(asset.sha256, r.outputSha);
    assert.equal(asset.objectKey, r.outputKey);
    assert.equal(current.retained.outputKey, null);
    const root = `/workspaces/${state.owner.org}`;
    for (const [path, digest] of [
      [`/assets/${asset.id}/file`, r.outputSha],
      [`/assets/${state.assetId}/file`, state.imageSha],
      [`/renders/${state.renderId}/file/video`, state.videoSha],
    ]) {
      const res = await fetch("http://api:4000/api" + root + path, {
        headers: { cookie: state.owner.cookie },
      });
      assert.equal(res.status, 200);
      assert.equal(sha(Buffer.from(await res.arrayBuffer())), digest);
    }
    assert.equal(
      (await fetch(`http://api:4000/api${root}/assets/${asset.id}/file`))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(`http://api:4000/api${root}/assets/${asset.id}/file`, {
          headers: { cookie: state.other.cookie },
        })
      ).status,
      404,
    );
    const newVideo = await fetch(
      `http://api:4000/api${root}/renders/${r.render}/file/video`,
      { headers: { cookie: state.owner.cookie } },
    );
    assert.equal(newVideo.status, 200);
    const video = Buffer.from(await newVideo.arrayBuffer());
    assert.ok(video.length > 1000);
    const dir = mkdtempSync(tmpdir() + "/compose-recovered-video-");
    try {
      writeFileSync(dir + "/out.mp4", video);
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            dir + "/out.mp4",
          ],
          { encoding: "utf8" },
        ),
      );
      const stream = probe.streams.find((x) => x.codec_type === "video");
      assert.equal(stream.width, 1280);
      assert.equal(stream.height, 720);
      assert.ok(Math.abs(Number(probe.format.duration) - 1) < 0.25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return {
      after: current,
      checks: {
        queuedAiReconstructedFromFreshRedis: true,
        queuedRenderReconstructedAndProbed: true,
        retainedPrivateOutputIngestedWithoutProvider: true,
        uncertainAiNotReplayed: true,
        syntheticQueuedProviderCalls: 1,
        syntheticUncertainProviderCallsAfterRestore: 0,
        originalLedgerEntriesUnchanged: true,
        immutableLedgerTriggerEnforced: true,
        exactlyTwoCreditSettlements: true,
        uncertainCreditsHeldForReview: true,
        generatedAssetAndOriginalMediaTenantIsolation: true,
        ...(mode === "recovery-recheck"
          ? { allThreeWorkersRestartedWithoutReplayOrDuplicateSettlement: true }
          : {}),
      },
    };
  } finally {
    for (const queue of queues) await queue.close();
    await connection.quit();
  }
}
