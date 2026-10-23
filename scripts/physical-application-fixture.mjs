// Injected only into owned Compose fixtures, never runtime business data.
import assert from "node:assert/strict";
export async function runPhysicalApplication({
  mode,
  state,
  db,
  store,
  s3,
  require,
  call,
  sha,
  sleep,
  binding,
}) {
  const ids = state.ids,
    provider = "http://fixture-provider:4999";
  if (mode === "physical-app-effect") {
    const submitted = await fetch(provider + "/historical-effects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.request),
    });
    assert.equal(submitted.status, 201);
    const accepted = await submitted.json();
    const confirmed = await (
      await fetch(provider + "/historical-effects/" + state.request.operationId)
    ).json();
    assert.deepEqual(confirmed, accepted);
    assert.equal(confirmed.acceptedCalls, 1);
    assert.equal(confirmed.submissionAttempts, 1);
    assert.equal(confirmed.status, "CONFIRMED");
    return confirmed;
  }
  if (mode === "physical-app-objects") {
    await store.ready();
    const listing = await store.client.send(
      new s3.ListObjectsV2Command({ Bucket: store.bucket }),
    );
    assert.equal(listing.KeyCount, 0);
    assert.ok(!listing.IsTruncated);
    for (const o of state.objects) {
      const bytes = Buffer.from(o.body, "base64");
      assert.equal(sha(bytes), o.sha256);
      await store.client.send(
        new s3.PutObjectCommand({
          Bucket: store.bucket,
          Key: o.key,
          Body: bytes,
          ContentType: o.contentType,
          CacheControl: o.cacheControl,
          Metadata: o.metadata,
        }),
      );
    }
  }
  if (mode === "physical-app-objects" || mode === "physical-app-preflight") {
    const listing = await store.client.send(
      new s3.ListObjectsV2Command({ Bucket: store.bucket }),
    );
    assert.ok(!listing.IsTruncated);
    const objects = [];
    for (const item of listing.Contents ?? []) {
      const r = await store.get(item.Key),
        bytes = Buffer.from(await r.Body.transformToByteArray());
      objects.push({
        key: item.Key,
        body: bytes.toString("base64"),
        contentType: r.ContentType,
        sha256: sha(bytes),
      });
    }
    return { objects };
  }
  const rows = async () =>
    JSON.parse(
      JSON.stringify({
        queued: await db.aIJob.findUniqueOrThrow({ where: { id: "pitr-job" } }),
        uncertain: await db.aIJob.findUniqueOrThrow({
          where: { id: "pitr-uncertain" },
        }),
        account: await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: ids["pitr-a"] },
        }),
        ledger: await db.creditEntry.findMany({
          where: { organizationId: ids["pitr-a"] },
          orderBy: { sequence: "asc" },
        }),
        reservation: await db.creditReservation.findUniqueOrThrow({
          where: { id: "pitr-reservation" },
        }),
        usage: await db.aIUsage.findMany({ orderBy: { id: "asc" } }),
      }),
    );
  if (mode === "physical-app-http") {
    const cookies = {};
    for (const who of ["owner", "client", "viewer"]) {
      const login = await call("/auth/login", "POST", {
        email: `pitr-${who}@example.test`,
        password: state.password,
      });
      assert.equal(login.status, 201);
      assert.ok(login.cookie);
      cookies[who] = login.cookie;
    }
    const root = `/workspaces/${ids["pitr-a"]}`,
      path = root + `/assets/${ids["pitr-asset"]}/file`;
    const asset = async (cookie, range) =>
      fetch("http://api:4000/api" + path, {
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(range ? { Range: range } : {}),
        },
      });
    assert.equal((await asset()).status, 401);
    assert.equal((await asset(cookies.client)).status, 404);
    const media = await asset(cookies.owner);
    assert.equal(media.status, 200);
    assert.equal(
      sha(Buffer.from(await media.arrayBuffer())),
      state.objectSha256,
    );
    const range = await asset(cookies.owner, "bytes=0-1");
    assert.equal(range.status, 206);
    assert.equal(Buffer.from(await range.arrayBuffer()).toString(), "ol");
    assert.equal(
      (
        await fetch(
          `${process.env.S3_ENDPOINT}/${store.bucket}/${ids["pitr-a"]}/historical.png`,
        )
      ).status,
      403,
    );
    const contentPath = root + `/content/${ids["pitr-draft"]}`;
    const current = await call(contentPath, "GET", undefined, cookies.owner);
    assert.equal(current.status, 200);
    const original = await db.contentItem.findUniqueOrThrow({
      where: { id: ids["pitr-draft"] },
    });
    assert.equal(original.body, "approved target body");
    assert.equal(original.revision, 2);
    assert.equal(original.status, "APPROVED");
    const body = {
      title: original.title,
      platform: original.platform,
      format: original.format,
      hook: original.hook,
      body: "Restored independent HTTP edit",
      cta: original.cta,
      scenes: original.scenes,
      revision: 2,
    };
    assert.equal(
      (await call(contentPath, "PUT", body, cookies.client)).status,
      404,
    );
    assert.equal(
      (await call(contentPath, "PUT", body, cookies.viewer)).status,
      403,
    );
    assert.equal(
      (await call(contentPath, "PUT", body, cookies.owner)).status,
      200,
    );
    assert.equal(
      (await call(contentPath, "PUT", body, cookies.owner)).status,
      409,
    );
    const edited = await db.contentItem.findUniqueOrThrow({
      where: { id: ids["pitr-draft"] },
    });
    assert.equal(edited.revision, 3);
    assert.equal(edited.status, "DRAFT");
    assert.equal(edited.approvedBy, null);
    assert.equal(edited.approvedAt, null);
    assert.equal(
      await db.researchRecord.count({ where: { id: "pitr-late" } }),
      0,
    );
    return {
      restoredHttpAuthentication: true,
      historicalMediaServedByActualApi: true,
      anonymousAndCrossTenantMediaDenied: true,
      restoredClientRoleDeniedWrite: true,
      restoredRevisionConflictAndApprovalInvalidation: true,
      laterDatabaseChangesExcluded: true,
    };
  }
  const Redis = require("ioredis"),
    { Queue } = require("bullmq"),
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  const queue = new Queue("marketing-ai", { connection });
  try {
    if (mode === "physical-app-workers") {
      let complete = false;
      for (let i = 0; i < 180; i++) {
        const r = await rows();
        assert.notEqual(
          r.queued.status,
          "FAILED",
          r.queued.error ?? "Queued job failed",
        );
        const job = await queue.getJob("pitr-job");
        if (
          r.queued.status === "SUCCEEDED" &&
          r.uncertain.status === "FAILED" &&
          (await job?.getState()) === "completed"
        ) {
          complete = true;
          break;
        }
        await sleep(500);
      }
      assert.ok(
        complete,
        "Physical application jobs did not recover from empty Redis",
      );
    } else {
      assert.equal(mode, "physical-app-restart");
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
          else if (values.every((v, i) => v > first[i])) {
            ready = true;
            break;
          }
        }
        await sleep(200);
      }
      assert.ok(
        ready,
        "All three physical application workers must complete fresh dispatcher cycles",
      );
      assert.deepEqual(await rows(), state.after);
    }
    const r = await rows();
    assert.equal(r.queued.attempts, 1);
    assert.equal(r.uncertain.attempts, 1);
    assert.match(r.uncertain.error, /interrupted.*review/i);
    assert.deepEqual(await (await fetch(provider + "/stats")).json(), {
      [state.queuedPrompt]: 1,
    });
    const confirmed = await (
      await fetch(
        provider + "/historical-effects/" + state.accepted.operationId,
      )
    ).json();
    assert.deepEqual(confirmed, state.accepted);
    assert.deepEqual(
      r.ledger.slice(0, state.beforeLedger.length),
      state.beforeLedger,
    );
    assert.equal(
      r.ledger.length,
      state.processMode ? 6 : state.mediaMode ? 5 : 3,
    );
    if (state.mediaMode)
      assert.equal(r.ledger.filter((e) => e.kind === "CONSUME").length, 2);
    else assert.equal(r.ledger[2].kind, "CONSUME");
    assert.equal(
      r.account.available,
      state.processMode ? 3 : state.mediaMode ? 5 : 7,
    );
    assert.equal(r.account.reserved, state.processMode ? 2 : 0);
    assert.equal(r.reservation.state, "SETTLED");
    assert.equal(r.usage.length, 1);
    assert.equal(r.usage[0].jobId, "pitr-job");
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE "CreditEntry" SET reason='tamper' WHERE id='pitr-grant'`,
      ),
      /immutable/i,
    );
    await assert.rejects(
      db.$executeRawUnsafe(`DELETE FROM "CreditEntry" WHERE id='pitr-grant'`),
      /immutable/i,
    );
    assert.equal(
      await connection.exists("bull:marketing-ai:pitr-uncertain"),
      0,
    );
    assert.equal(
      sha(await store.read(`${ids["pitr-a"]}/historical.png`, 100)),
      state.objectSha256,
    );
    return {
      after: r,
      checks: {
        physicallyRecoveredQueuedJobReconstructed: true,
        postTargetEffectNotReplayed: true,
        uncertainJobFailedForReview: true,
        oneCreditSettlementAndOriginalLedgerPreserved: true,
        restoredLedgerImmutable: true,
        ...(mode === "physical-app-restart"
          ? { allThreeWorkersRestartedWithoutReplayOrDuplicateSettlement: true }
          : {}),
      },
    };
  } finally {
    await queue.close();
    await connection.quit();
  }
}
