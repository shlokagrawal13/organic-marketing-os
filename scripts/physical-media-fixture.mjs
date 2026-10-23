// Actual FFmpeg/private-store operations, injected only into owned fixtures.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
export async function runPhysicalMedia({
  mode,
  state,
  db,
  store,
  s3,
  require,
  call,
  sha,
  sleep,
}) {
  const ids = state.ids,
    org = ids["pitr-a"];
  const probe = (bytes, extension, decode = false) => {
    const dir = mkdtempSync(tmpdir() + "/physical-media-");
    try {
      const path = dir + "/media." + extension;
      writeFileSync(path, bytes);
      const info = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
          { encoding: "utf8" },
        ),
      );
      if (decode)
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-i",
          path,
          "-frames:v",
          "1",
          "-f",
          "null",
          "-",
        ]);
      return info;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  if (mode === "physical-media-prepare") {
    const dir = mkdtempSync(tmpdir() + "/physical-media-seed-");
    let source, retained;
    try {
      for (const [name, color] of [
        ["source", "blue"],
        ["retained", "green"],
      ])
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `color=c=${color}:s=640x360`,
          "-frames:v",
          "1",
          "-threads",
          "1",
          `${dir}/${name}.png`,
        ]);
      source = readFileSync(dir + "/source.png");
      retained = readFileSync(dir + "/retained.png");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    assert.notEqual(sha(source), sha(retained));
    for (const b of [source, retained]) {
      const v = probe(b, "png", true).streams.find(
        (x) => x.codec_type === "video",
      );
      assert.equal(v.width, 640);
      assert.equal(v.height, 360);
    }
    const sourceKey = `${org}/physical-valid.png`,
      outputKey = `${org}/generated/${ids.media}/retained.png`;
    const objects = [
      [sourceKey, source],
      [outputKey, retained],
    ].map(([key, bytes]) => ({
      key,
      body: bytes.toString("base64"),
      bytes: bytes.length,
      sha256: sha(bytes),
      contentType: "image/png",
    }));
    const snapshot = {
      ...state.renderSnapshot,
      scenes: state.renderSnapshot.scenes.map((s) => ({
        ...s,
        visualAssetId: ids.validAsset,
        audioAssetId: null,
      })),
    };
    assert.equal(snapshot.scenes.length, 1);
    require("/app/dist/packages/core/ai.js").draftSchema.parse(snapshot);
    const request = {
      kind: "image",
      model: "synthetic-fixture",
      prompt: "Synthetic retained physical output",
      rightsConfirmed: true,
      rightsNote: "Synthetic FFmpeg fixture",
      sourceAssetIds: [],
      maxCostUsd: 0.1,
    };
    const config = {
      version: 1,
      provider: "openai",
      baseUrl: "http://fixture-provider:4999",
      kind: "image",
      model: "synthetic-fixture",
      estimatedCostUsd: 0.1,
      credits: 2,
      allowedPlans: ["self_hosted"],
    };
    const q = (v) =>
      "'" +
      String(typeof v === "object" ? JSON.stringify(v) : v).replaceAll(
        "'",
        "''",
      ) +
      "'";
    let sql = `
      INSERT INTO "Asset" (id,"organizationId",name,kind,"mimeType",bytes,sha256,"objectKey",width,height,"rightsNote","createdBy") VALUES (${q(ids.validAsset)},${q(org)},'Synthetic valid physical image','IMAGE','image/png',${source.length},${q(sha(source))},${q(sourceKey)},640,360,'Synthetic FFmpeg image','pitr-owner');
      UPDATE "CreditAccount" SET available=5,reserved=5,revision=3 WHERE "organizationId"=${q(org)} AND available=7 AND reserved=3;
      INSERT INTO "CreditEntry" (id,"organizationId","operationKey","requestHash",kind,"availableDelta","reservedDelta","availableAfter","reservedAfter",sequence,reference,reason) VALUES ('pitr-media-reserve',${q(org)},'reserve-media','fixture','RESERVE',-2,2,5,5,3,'physical-media','Synthetic media reservation');
      INSERT INTO "CreditReservation" (id,"organizationId",reference,credits) VALUES ('pitr-media-reservation',${q(org)},'physical-media',2);
      INSERT INTO "RenderJob" (id,"organizationId","contentId","contentRevision","actorId","requestKey","requestHash",snapshot,options,"totalScenes") VALUES (${q(ids.render)},${q(org)},${q(ids["pitr-draft"])},2,'pitr-owner',${q(ids.render)},${q(sha(Buffer.from(JSON.stringify(snapshot))))},${q(snapshot)},${q(state.renderOptions)},1);
      INSERT INTO "RenderInput" ("renderId","assetId") VALUES (${q(ids.render)},${q(ids.validAsset)});
      INSERT INTO "MediaGeneration" (id,"organizationId","actorId","requestKey","requestHash",request,configuration,state,"outputKey","providerRequestId","quotedCostUsd","quotedCredits","creditReservationId","startedAt","updatedAt") VALUES (${q(ids.media)},${q(org)},'pitr-owner',${q(ids.media)},${q(sha(Buffer.from(JSON.stringify(request))))},${q(request)},${q(config)},'OUTPUT_READY',${q(outputKey)},'synthetic-physical-retained',0.1,2,'pitr-media-reservation',now(),now());
    `;
    if (state.interruptedMode)
      sql += `
        UPDATE "RenderJob" SET status='RUNNING',"runToken"='physical-interrupted-render',"startedAt"=now()-interval '2 minutes',"heartbeatAt"=now()-interval '2 minutes' WHERE id=${q(ids.render)};
        UPDATE "MediaGeneration" SET "runToken"='physical-interrupted-media',"heartbeatAt"=now()-interval '2 minutes' WHERE id=${q(ids.media)};
      `;
    return {
      sql,
      objects,
      sourceKey,
      outputKey,
      sourceSha256: sha(source),
      retainedSha256: sha(retained),
      renderSnapshot: snapshot,
    };
  }
  if (mode === "physical-media-object-fault") {
    const object = state.object;
    assert.ok(
      [state.mediaFixture.sourceKey, state.mediaFixture.outputKey].includes(
        object.key,
      ),
    );
    const bytes = Buffer.from(object.body, "base64");
    assert.equal(sha(bytes), object.sha256);
    if (state.fault === "missing")
      await store.client.send(
        new s3.DeleteObjectCommand({ Bucket: store.bucket, Key: object.key }),
      );
    else {
      assert.ok(["corrupt", "restore"].includes(state.fault));
      const body = Buffer.from(bytes);
      if (state.fault === "corrupt") {
        body[body.length - 1] ^= 1;
        assert.equal(body.length, bytes.length);
        assert.notEqual(sha(body), object.sha256);
      }
      await store.client.send(
        new s3.PutObjectCommand({
          Bucket: store.bucket,
          Key: object.key,
          Body: body,
          ContentType: object.contentType,
          CacheControl: object.cacheControl,
          Metadata: object.metadata,
        }),
      );
    }
    return { key: object.key, fault: state.fault };
  }
  const current = async () =>
    JSON.parse(
      JSON.stringify({
        render: await db.renderJob.findUniqueOrThrow({
          where: { id: ids.render },
        }),
        media: await db.mediaGeneration.findUniqueOrThrow({
          where: { id: ids.media },
        }),
        assets: await db.asset.findMany({
          where: { organizationId: org },
          orderBy: { id: "asc" },
        }),
        segments: await db.renderSegment.findMany({
          where: { organizationId: org },
          orderBy: { id: "asc" },
        }),
        ledger: await db.creditEntry.findMany({
          where: { organizationId: org },
          orderBy: { sequence: "asc" },
        }),
        reservation: await db.creditReservation.findUniqueOrThrow({
          where: { id: "pitr-media-reservation" },
        }),
        ...(state.interruption
          ? {
              interruptedRender: await db.renderJob.findUniqueOrThrow({
                where: { id: state.interruption.originalRenderId },
              }),
            }
          : {}),
      }),
    );
  const Redis = require("ioredis"),
    { Queue } = require("bullmq"),
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  const queues = ["marketing-render", "marketing-media-generation"].map(
    (n) => new Queue(n, { connection }),
  );
  try {
    if (mode === "physical-media-interrupted") {
      let row;
      for (let i = 0; i < 100; i++) {
        row = await db.renderJob.findUniqueOrThrow({
          where: { id: ids.render },
        });
        if (row.status === "FAILED") break;
        await sleep(200);
      }
      assert.equal(row.status, "FAILED");
      assert.match(row.error, /worker was interrupted/i);
      assert.equal(row.stage, "Worker interrupted");
      assert.equal(row.outputKey, null);
      assert.equal(await queues[0].getJob(ids.render), undefined);
      assert.equal(
        await db.renderJob.count({ where: { organizationId: org } }),
        1,
      );
      const path = `/workspaces/${org}/renders/${ids.render}/retry`;
      const body = { requestKey: "7cdd0796-a51e-442a-aab9-999999999999" };
      assert.equal((await call(path, "POST", body)).status, 401);
      const cookies = {};
      for (const who of ["owner", "client", "viewer"]) {
        const login = await call("/auth/login", "POST", {
          email: `pitr-${who}@example.test`,
          password: state.password,
        });
        assert.equal(login.status, 201);
        cookies[who] = login.cookie;
      }
      assert.equal(
        (await call(path, "POST", body, cookies.client)).status,
        404,
      );
      assert.equal(
        (await call(path, "POST", body, cookies.viewer)).status,
        403,
      );
      const retry = await call(path, "POST", body, cookies.owner);
      assert.equal(retry.status, 201);
      assert.notEqual(retry.data.id, ids.render);
      const duplicate = await call(path, "POST", body, cookies.owner);
      assert.equal(duplicate.status, 201);
      assert.equal(duplicate.data.id, retry.data.id);
      assert.equal(
        await db.renderJob.count({ where: { organizationId: org } }),
        2,
      );
      const next = await db.renderJob.findUniqueOrThrow({
        where: { id: retry.data.id },
      });
      assert.deepEqual(next.snapshot, row.snapshot);
      assert.deepEqual(next.options, row.options);
      assert.equal(next.contentRevision, row.contentRevision);
      assert.deepEqual(
        await db.renderInput.findMany({
          where: { renderId: next.id },
          select: { assetId: true },
        }),
        [{ assetId: ids.validAsset }],
      );
      assert.equal(
        await db.auditLog.count({
          where: { action: "render.retried", entityId: next.id },
        }),
        1,
      );
      return {
        originalRenderId: ids.render,
        retryRenderId: next.id,
        failedRender: JSON.parse(JSON.stringify(row)),
        checks: {
          physicalStaleRenderFailedWithoutAutomaticReplay: true,
          physicalRenderOwnerRetryTenantRoleAndIdempotencyPassed: true,
          physicalRenderRetryPreservedFrozenInputs: true,
        },
      };
    }
    if (mode === "physical-media-diagnostic")
      return {
        now: new Date().toISOString(),
        databaseClock: await db.$queryRawUnsafe(
          "SELECT now(),current_setting('TimeZone') AS timezone",
        ),
        rows: await current(),
        workerHeartbeats: await connection.mget(
          "worker:heartbeat",
          "render:heartbeat",
          "media-generation:heartbeat",
        ),
        queues: await Promise.all(
          queues.map(async (q, i) => {
            const j = await q.getJob([ids.render, ids.media][i]);
            return j
              ? {
                  state: await j.getState(),
                  attemptsMade: j.attemptsMade,
                  failedReason: j.failedReason,
                  processedOn: j.processedOn,
                  finishedOn: j.finishedOn,
                }
              : null;
          }),
        ),
      };
    if (mode === "physical-media-workers") {
      let ready = false;
      for (let i = 0; i < 180; i++) {
        const r = await current();
        assert.notEqual(
          r.render.status,
          "FAILED",
          r.render.error ?? "Render failed",
        );
        assert.notEqual(
          r.media.state,
          "FAILED",
          r.media.error ?? "Media failed",
        );
        if (
          r.render.status === "SUCCEEDED" &&
          r.media.state === "SUCCEEDED" &&
          (
            await Promise.all(
              queues.map(async (q, i) =>
                (await q.getJob([ids.render, ids.media][i]))?.getState(),
              ),
            )
          ).every((s) => s === "completed")
        ) {
          ready = true;
          break;
        }
        await sleep(500);
      }
      assert.ok(
        ready,
        "Physical render/media jobs did not complete from fresh Redis",
      );
    } else {
      assert.equal(mode, "physical-media-restart");
      assert.deepEqual(await current(), state.mediaAfter);
    }
    const r = await current();
    if (state.interruption) {
      assert.deepEqual(r.interruptedRender, state.interruption.failedRender);
      assert.equal(
        await queues[0].getJob(state.interruption.originalRenderId),
        undefined,
      );
      assert.notEqual(r.media.runToken, "physical-interrupted-media");
      assert.equal(r.media.runToken, null);
      assert.equal(r.media.heartbeatAt, null);
      assert.equal(
        await db.renderJob.count({ where: { organizationId: org } }),
        2,
      );
      assert.equal(
        await db.auditLog.count({
          where: { action: "media_generation.completed", entityId: ids.media },
        }),
        1,
      );
    }
    assert.equal(r.media.outputKey, null);
    assert.equal(r.media.providerRequestId, "synthetic-physical-retained");
    assert.equal(r.reservation.state, "SETTLED");
    assert.equal(r.reservation.consumed, 2);
    const generated = r.assets.find((a) => a.id === r.media.assetId);
    assert.ok(generated);
    assert.equal(generated.sha256, state.mediaFixture.retainedSha256);
    assert.equal(generated.objectKey, state.mediaFixture.outputKey);
    assert.deepEqual(
      r.ledger.slice(0, state.beforeLedger.length),
      state.beforeLedger,
    );
    assert.equal(r.ledger.length, state.beforeLedger.length + 2);
    assert.equal(r.ledger.filter((e) => e.kind === "CONSUME").length, 2);
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i],
        j = await q.getJob([ids.render, ids.media][i]);
      assert.equal(await j.getState(), "completed");
      assert.equal(j.attemptsMade, 1);
      const counts = await q.getJobCounts(
        "active",
        "waiting",
        "delayed",
        "prioritized",
        "waiting-children",
        "failed",
      );
      assert.equal(
        Object.values(counts).reduce((a, b) => a + b, 0),
        0,
      );
      assert.equal((await q.getJobCounts("completed")).completed, 1);
    }
    const login = await call("/auth/login", "POST", {
      email: "pitr-owner@example.test",
      password: state.password,
    });
    assert.equal(login.status, 201);
    const other = await call("/auth/login", "POST", {
      email: "pitr-client@example.test",
      password: state.password,
    });
    assert.equal(other.status, 201);
    const root = `http://api:4000/api/workspaces/${org}`;
    const hashes = {};
    for (const [key, path, expected, ext] of [
      [
        "source",
        `/assets/${ids.validAsset}/file`,
        state.mediaFixture.sourceSha256,
        "png",
      ],
      [
        "generated",
        `/assets/${generated.id}/file`,
        state.mediaFixture.retainedSha256,
        "png",
      ],
      ["video", `/renders/${ids.render}/file/video`, null, "mp4"],
    ]) {
      const res = await fetch(root + path, {
        headers: { cookie: login.cookie },
      });
      assert.equal(res.status, 200);
      const bytes = Buffer.from(await res.arrayBuffer());
      hashes[key] = sha(bytes);
      if (expected) assert.equal(hashes[key], expected);
      assert.equal((await fetch(root + path)).status, 401);
      assert.equal(
        (await fetch(root + path, { headers: { cookie: other.cookie } }))
          .status,
        404,
      );
      const info = probe(bytes, ext, true),
        v = info.streams.find((v) => v.codec_type === "video");
      assert.ok(v);
      assert.equal(v.width, key === "video" ? 1280 : 640);
      assert.equal(v.height, key === "video" ? 720 : 360);
      if (key === "video")
        assert.ok(Math.abs(Number(info.format.duration) - 1) < 0.25);
    }
    for (const key of [
      r.render.outputKey,
      r.render.thumbnailKey,
      r.render.captionsKey,
      generated.objectKey,
    ]) {
      assert.ok(key);
      const o = await store.get(key);
      const bytes = Buffer.from(await o.Body.transformToByteArray());
      hashes[key] = sha(bytes);
      assert.equal(
        (await fetch(`${process.env.S3_ENDPOINT}/${store.bucket}/${key}`))
          .status,
        403,
      );
    }
    assert.equal(
      sha(await store.read(state.mediaFixture.sourceKey, 2000000)),
      state.mediaFixture.sourceSha256,
    );
    assert.deepEqual(r.render.snapshot, state.mediaFixture.renderSnapshot);
    if (mode === "physical-media-restart")
      assert.deepEqual(hashes, state.mediaHashes);
    return {
      after: r,
      hashes,
      checks: {
        physicalValidImagesDecoded: true,
        physicalRenderQueueCompleted: true,
        physicalRetainedMediaIngestedWithoutSubmission: true,
        physicalOutputDimensionsDurationAndDecodePassed: true,
        physicalNewOutputsPrivateAndTenantScoped: true,
        physicalMediaReservationsSettledOnce: true,
        ...(state.interruption
          ? {
              physicalStaleMediaLeaseReclaimedWithoutSubmission: true,
              physicalInterruptedRenderPreservedAfterRetry: true,
            }
          : {}),
        ...(mode === "physical-media-restart"
          ? { physicalMediaRowsQueuesAndBytesStableAfterRestart: true }
          : {}),
      },
    };
  } finally {
    await Promise.all(queues.map((q) => q.close()));
    await connection.quit();
  }
}
