import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { db, actor, draft, scene } from "../support/http";
import { encryptSocialToken } from "../../packages/core/social-tokens";
import { ObjectStore } from "../../packages/core/object-store";
import { dispatchReviewedYoutubeVideo, reconcileUnknownYoutubeUpload } from "../../apps/api/src/youtube-dispatch";
import { cancelPublicationSchedule, createPublicationSchedule,
  previewPublicationScheduleGuidance, runDuePublicationSchedules } from "../../apps/api/src/publication-scheduler";
import { youtubePolicyVersion } from "../../packages/core/youtube-policy";
import { evaluateManualGuidance } from "../../apps/api/src/posting-guidance";

const orgs: string[] = [], users: string[] = [];
const priorKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
const priorDispatch = process.env.YOUTUBE_LIVE_DISPATCH_ENABLED;
const priorScheduledDispatch = process.env.YOUTUBE_SCHEDULED_DISPATCH_ENABLED;
const priorReviewVersion = process.env.YOUTUBE_POLICY_REVIEWED_VERSION;
const priorReviewAt = process.env.YOUTUBE_POLICY_REVIEWED_AT;
const priorGuidanceCount = process.env.YOUTUBE_GUIDANCE_24H_COUNT;
const priorMetadataSimilarity = process.env.YOUTUBE_GUIDANCE_METADATA_SIMILARITY_PERCENT;
const priorTopicOverlap = process.env.YOUTUBE_GUIDANCE_TOPIC_OVERLAP_PERCENT;
const priorTopicRepeat = process.env.YOUTUBE_GUIDANCE_TOPIC_REPEAT_COUNT;
const priorCtaRepeat = process.env.YOUTUBE_GUIDANCE_CTA_REPEAT_COUNT;
const priorMinTopicTokens = process.env.YOUTUBE_GUIDANCE_MIN_TOPIC_TOKENS;
after(async () => {
  if (priorKey === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = priorKey;
  for (const [key, value] of Object.entries({
    YOUTUBE_LIVE_DISPATCH_ENABLED: priorDispatch,
    YOUTUBE_SCHEDULED_DISPATCH_ENABLED: priorScheduledDispatch,
    YOUTUBE_POLICY_REVIEWED_VERSION: priorReviewVersion,
    YOUTUBE_POLICY_REVIEWED_AT: priorReviewAt,
    YOUTUBE_GUIDANCE_24H_COUNT: priorGuidanceCount,
    YOUTUBE_GUIDANCE_METADATA_SIMILARITY_PERCENT: priorMetadataSimilarity,
    YOUTUBE_GUIDANCE_TOPIC_OVERLAP_PERCENT: priorTopicOverlap,
    YOUTUBE_GUIDANCE_TOPIC_REPEAT_COUNT: priorTopicRepeat,
    YOUTUBE_GUIDANCE_CTA_REPEAT_COUNT: priorCtaRepeat,
    YOUTUBE_GUIDANCE_MIN_TOPIC_TOKENS: priorMinTopicTokens,
  })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await db.publicationAttempt.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.publicationSchedule.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.publicationPolicyReview.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.socialConnection.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.renderJob.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("guarded HTTP gate and single-send internal dispatch remain tenant-bound", async () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const org = await db.organization.create({ data: { name: "Dispatch QA" } });
  const other = await db.organization.create({ data: { name: "Other dispatch QA" } });
  orgs.push(org.id, other.id);
  const owner = await actor(org.id), editor = await actor(org.id, "EDITOR"),
    outsider = await actor(other.id);
  users.push(owner.id, editor.id, outsider.id);
  const root = `/workspaces/${org.id}`;
  const channelId = "UCfixture_channel_1234567890";
  const identity = { organizationId: org.id, provider: "YOUTUBE" as const,
    externalAccountId: channelId };
  const connection = await db.socialConnection.create({ data: {
    ...identity, accountLabel: "Fixture channel",
    scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    accessTokenCiphertext: encryptSocialToken("fixture-token", identity),
    refreshTokenCiphertext: encryptSocialToken("fixture-refresh", identity),
    tokenExpiresAt: new Date(Date.now() + 3600000),
  } });
  const bytes = Buffer.from("synthetic-private-video-bytes");
  const rendered = new Map<string, Buffer>();
  const store = { async get(key: string) {
    assert.match(key, /private-video/u);
    const body = rendered.get(key);
    assert.ok(body);
    return { Body: Readable.from([body]) };
  }, configured: true } as ObjectStore;
  async function prepared(label: string, video = bytes) {
    const c = await owner.call(root + "/content", "POST", {
      ...draft, title: label, platform: "YouTube", format: "Video", scenes: [scene],
    });
    assert.equal(c.status, 201);
    assert.equal((await owner.call(root + `/content/${c.body.id}/review`, "POST", { revision: 1 })).status, 201);
    assert.equal((await owner.call(root + `/content/${c.body.id}/approve`, "POST", {
      revision: 1, factsAndRightsReviewed: true,
    })).status, 201);
    const outputKey = `${org.id}/private-video/${randomUUID()}`;
    rendered.set(outputKey, video);
    const render = await db.renderJob.create({ data: {
      organizationId: org.id, contentId: c.body.id, contentRevision: 1,
      actorId: owner.id, requestKey: randomUUID(), requestHash: "synthetic-only",
      snapshot: { ...draft, format: "Video", scenes: [scene] }, options: {},
      totalScenes: 1, status: "SUCCEEDED",
      outputKey, outputBytes: video.length,
      approvedAt: new Date(), approvedBy: owner.id,
    } });
    const p = await owner.call(root + "/publication-intents", "POST", {
      contentId: c.body.id, revision: 1, renderId: render.id, requestKey: randomUUID(),
    });
    assert.equal(p.status, 201);
    const review = await owner.call(root + `/publication-intents/${p.body.id}/youtube-policy-review`, "POST", {
      connectionId: connection.id, privacyStatus: "private",
      selfDeclaredMadeForKids: false, containsSyntheticMedia: true,
      metadataReviewed: true, audienceReviewed: true, syntheticMediaReviewed: true,
      rightsAndPlatformRulesReviewed: true,
    });
    assert.equal(review.status, 201);
    return { organizationId: org.id, actorId: owner.id, intentId: p.body.id,
      connectionId: connection.id, requestKey: randomUUID() };
  }
  const first = await prepared("One upload fixture");
  const path = root + `/publication-intents/${first.intentId}`;
  assert.deepEqual((await owner.call(path + "/youtube-attempt")).body,
    { attempt: null, canPublish: false, canReconcile: false });
  assert.deepEqual((await editor.call(path + "/youtube-attempt")).body,
    { attempt: null, canPublish: false, canReconcile: false });
  assert.equal((await outsider.call(`/workspaces/${other.id}/publication-intents/${first.intentId}/youtube-attempt`)).status, 404);
  assert.equal((await owner.call(path + "/youtube-dispatch", "POST", {
    connectionId: connection.id, requestKey: first.requestKey, confirmation: "send",
  })).status, 400);
  assert.equal((await editor.call(path + "/youtube-dispatch", "POST", {
    connectionId: connection.id, requestKey: first.requestKey,
    confirmation: "PUBLISH_TO_YOUTUBE",
  })).status, 403);
  assert.equal((await owner.call(path + "/youtube-dispatch", "POST", {
    connectionId: connection.id, requestKey: first.requestKey,
    confirmation: "PUBLISH_TO_YOUTUBE",
  })).status, 400);
  const manualQuery = `/youtube-manual-posting-guidance?connectionId=${connection.id}`;
  assert.equal((await owner.call(path + manualQuery)).status, 503);
  assert.equal((await editor.call(path + manualQuery)).status, 403);
  assert.equal((await outsider.call(`/workspaces/${other.id}/publication-intents/${first.intentId}${manualQuery}`)).status, 404);
  assert.equal((await owner.call(path + "/youtube-dispatch", "POST", {
    connectionId: connection.id, requestKey: first.requestKey,
    guidanceFingerprint: "0".repeat(64), guidanceCheckedAt: new Date().toISOString(),
    guidanceAcknowledged: true, confirmation: "PUBLISH_TO_YOUTUBE",
  })).status, 503);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 0);

  process.env.YOUTUBE_LIVE_DISPATCH_ENABLED = "true";
  assert.equal((await owner.call(path + "/youtube-attempt")).body.canPublish, false);
  let blockedCalls = 0;
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, first,
    (async () => { blockedCalls++; throw new Error("should not call provider"); }) as typeof fetch),
    /current platform policy review/u);
  assert.equal(blockedCalls, 0);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 0);
  process.env.YOUTUBE_POLICY_REVIEWED_VERSION = youtubePolicyVersion;
  process.env.YOUTUBE_POLICY_REVIEWED_AT = new Date().toISOString();
  // The harness's API server stays default-off; only this test process uses
  // synthetic provider requests through the internal dispatcher.
  async function manualGuidance(input: typeof first, checkedAt = new Date()) {
    const intent = await db.publicationIntent.findUniqueOrThrow({ where: { id: input.intentId } });
    return db.$transaction((tx) => evaluateManualGuidance(tx, {
      organizationId: input.organizationId, connectionId: input.connectionId,
      intentId: input.intentId, contentRevision: intent.contentRevision,
      renderId: intent.renderId, checkedAt,
    }));
  }
  const firstGuidance = await manualGuidance(first);
  assert.deepEqual(firstGuidance.warnings, []);
  const firstWithGuidance = { ...first, manualGuidance: {
    fingerprint: firstGuidance.fingerprint,
    checkedAt: new Date(firstGuidance.checkedAt), acknowledged: true,
  } };

  const uri = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=secret-fixture";
  const receipt = () => Response.json({ id: "abcDEF01234", snippet: { channelId } }, { status: 201 });
  let calls = 0;
  const successful = async (_url: URL | RequestInfo, init?: RequestInit) => {
    calls++;
    if (init?.method === "POST") return new Response(null, {
      status: 200, headers: { location: uri },
    });
    assert.equal((init?.headers as Record<string,string>)["Content-Range"],
      `bytes 0-${bytes.length - 1}/${bytes.length}`);
    assert.equal(Buffer.from(await new Response(init?.body).arrayBuffer()).toString(), bytes.toString());
    return receipt();
  };
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store,
    { ...first, actorId: editor.id }, successful as typeof fetch), /owner or admin/u);
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, {
    ...firstWithGuidance, manualGuidance: { ...firstWithGuidance.manualGuidance,
      fingerprint: "0".repeat(64) },
  }, successful as typeof fetch), /guidance changed/u);
  assert.equal(calls, 0);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 0);
  const confirmed = await dispatchReviewedYoutubeVideo(db, store, firstWithGuidance, successful as typeof fetch);
  assert.equal(confirmed?.status, "CONFIRMED");
  assert.equal(confirmed?.mediaSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(confirmed?.mediaBytes, bytes.length);
  assert.equal(confirmed?.uploadSessionCiphertext?.includes("secret-fixture"), false);
  assert.equal(calls, 2);
  const safe = await owner.call(path + "/youtube-attempt");
  assert.equal(safe.body.attempt.status, "CONFIRMED");
  assert.equal(safe.body.attempt.providerPostId, "abcDEF01234");
  assert.equal(JSON.stringify(safe.body).includes("Ciphertext"), false);
  assert.equal(JSON.stringify(safe.body).includes("secret-fixture"), false);
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, first,
    successful as typeof fetch), /previous upload attempt/u);
  assert.equal(calls, 2);

  const sameConfirmed = await prepared("Another preparation with identical confirmed bytes");
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, sameConfirmed,
    successful as typeof fetch), /exact video may already exist/u);
  assert.equal(calls, 2);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 1);

  const uncertainBytes = Buffer.from("another-private-video-for-uncertain-send");
  const second = await prepared("Ambiguous response fixture", uncertainBytes);
  const secondGuidance = await manualGuidance(second);
  assert.ok(secondGuidance.warnings.some((warning) => warning.code === "CLOSE_SPACING"));
  const manualNeighbor = await prepared("Neighbor schedule fixture", Buffer.from("neighbor-unique-video"));
  const neighborSchedule = await db.publicationSchedule.create({ data: {
    organizationId: org.id, actorId: owner.id, intentId: manualNeighbor.intentId,
    connectionId: connection.id, requestKey: randomUUID(),
    dueAt: new Date(Date.now() + 30 * 60000),
  } });
  const competingSchedule = await db.publicationSchedule.create({ data: {
    organizationId: org.id, actorId: owner.id, intentId: second.intentId,
    connectionId: connection.id, requestKey: randomUUID(),
    dueAt: new Date(Date.now() + 45 * 60000),
  } });
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, {
    ...second, manualGuidance: { fingerprint: secondGuidance.fingerprint,
      checkedAt: new Date(secondGuidance.checkedAt), acknowledged: true },
  }, successful as typeof fetch), /existing schedule/u);
  await db.publicationSchedule.delete({ where: { id: competingSchedule.id } });
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, {
    ...second, manualGuidance: { fingerprint: secondGuidance.fingerprint,
      checkedAt: new Date(secondGuidance.checkedAt), acknowledged: true },
  }, successful as typeof fetch), /guidance changed/u);
  assert.equal(calls, 2);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 1);
  await db.publicationSchedule.delete({ where: { id: neighborSchedule.id } });
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, {
    ...second, manualGuidance: { fingerprint: secondGuidance.fingerprint,
      checkedAt: new Date(Date.now() - 3 * 60000), acknowledged: true },
  }, successful as typeof fetch), /guidance expired/u);
  let starts = 0, sends = 0, probes = 0;
  const unknown = await dispatchReviewedYoutubeVideo(db, store, {
    ...second, manualGuidance: { fingerprint: secondGuidance.fingerprint,
      checkedAt: new Date(secondGuidance.checkedAt), acknowledged: true },
  },
    (async (_url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === "POST") { starts++; return new Response(null, {
        status: 200, headers: { location: uri },
      }); }
      sends++; throw new Error("Provider response lost after bytes");
    }) as typeof fetch);
  assert.equal(unknown?.status, "UNKNOWN");
  assert.deepEqual([starts, sends], [1, 1]);
  assert.equal(unknown?.mediaSha256, createHash("sha256").update(uncertainBytes).digest("hex"));
  const sameUnknown = await prepared("Another preparation with identical uncertain bytes", uncertainBytes);
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, sameUnknown,
    (async () => { starts++; throw new Error("duplicate must not call provider"); }) as typeof fetch),
    /exact video may already exist/u);
  assert.deepEqual([starts, sends], [1, 1]);
  assert.equal(await db.publicationAttempt.count({ where: { organizationId: org.id } }), 2);
  assert.equal((await owner.call(root + `/publication-intents/${second.intentId}/youtube-attempt`)).body.attempt.canCheckStatus, true);
  assert.equal((await owner.call(root + `/publication-intents/${second.intentId}/youtube-attempt/${unknown!.id}/check-status`, "POST")).status, 503);
  const incomplete = await reconcileUnknownYoutubeUpload(db, {
    organizationId: org.id, actorId: owner.id, attemptId: unknown!.id,
  }, (async (_url: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(init?.body, undefined);
    assert.equal((init?.headers as Record<string,string>)["Content-Range"], `bytes */${uncertainBytes.length}`);
    probes++;
    return new Response(null, { status: 308, headers: { Range: "bytes=0-10" } });
  }) as typeof fetch);
  assert.deepEqual(incomplete, { status: "UNKNOWN", committedBytes: 11 });
  const completed = await reconcileUnknownYoutubeUpload(db, {
    organizationId: org.id, actorId: owner.id, attemptId: unknown!.id,
  }, (async () => { probes++; return receipt(); }) as typeof fetch);
  assert.equal(completed.status, "CONFIRMED");
  assert.equal(completed.outcomeCode, "read_only_lookup");
  assert.deepEqual([starts, sends, probes], [1, 1, 2]);

  const scheduledBytes = Buffer.from("third-unique-video-for-scheduled-send");
  const planned = await prepared("Scheduled video fixture", scheduledBytes);
  const plannedPath = root + `/publication-intents/${planned.intentId}`;
  const scheduledAt = new Date(Date.now() + 120000);
  const scheduleBody = { connectionId: connection.id, requestKey: randomUUID(),
    scheduledAt: scheduledAt.toISOString(), confirmation: "SCHEDULE_YOUTUBE_UPLOAD",
    guidanceFingerprint: "0".repeat(64), guidanceAcknowledged: true };
  assert.equal((await owner.call(plannedPath + "/youtube-schedule", "POST", scheduleBody)).status, 503);
  assert.equal((await editor.call(plannedPath + "/youtube-schedule", "POST", scheduleBody)).status, 403);
  assert.equal((await outsider.call(`/workspaces/${other.id}/publication-intents/${planned.intentId}/youtube-schedule`)).status, 404);
  assert.equal((await owner.call(plannedPath + `/youtube-posting-guidance?connectionId=${connection.id}&scheduledAt=${encodeURIComponent(scheduledAt.toISOString())}`)).status, 503);
  assert.equal((await editor.call(plannedPath + `/youtube-posting-guidance?connectionId=${connection.id}&scheduledAt=${encodeURIComponent(scheduledAt.toISOString())}`)).status, 403);
  assert.deepEqual((await owner.call(plannedPath + "/youtube-schedule")).body.schedule, null);
  process.env.YOUTUBE_SCHEDULED_DISPATCH_ENABLED = "true";
  const scheduleBase = { organizationId: org.id, actorId: owner.id,
    intentId: planned.intentId, connectionId: connection.id,
    requestKey: scheduleBody.requestKey, dueAt: scheduledAt };
  async function acknowledged<T extends typeof scheduleBase>(input: T) {
    const guidance = await previewPublicationScheduleGuidance(db, input);
    return { ...input, guidanceFingerprint: guidance.fingerprint,
      guidanceAcknowledged: true };
  }
  const scheduleInput = await acknowledged(scheduleBase);
  const preview = await previewPublicationScheduleGuidance(db, scheduleBase);
  assert.ok(preview.warnings.some((warning) => warning.code === "HIGH_24H_VOLUME"));
  assert.equal(preview.guidance.metadataSimilarityPercent, 70);
  assert.ok(!JSON.stringify(preview).includes("fixture-token"));
  process.env.YOUTUBE_GUIDANCE_24H_COUNT = "invalid";
  await assert.rejects(() => previewPublicationScheduleGuidance(db, scheduleBase),
    /configuration needs review/u);
  delete process.env.YOUTUBE_GUIDANCE_24H_COUNT;
  process.env.YOUTUBE_GUIDANCE_METADATA_SIMILARITY_PERCENT = "101";
  await assert.rejects(() => previewPublicationScheduleGuidance(db, scheduleBase),
    /configuration needs review/u);
  delete process.env.YOUTUBE_GUIDANCE_METADATA_SIMILARITY_PERCENT;
  await assert.rejects(() => createPublicationSchedule(db, {
    ...scheduleInput, guidanceFingerprint: "0".repeat(64),
  }), /guidance changed/u);
  await assert.rejects(() => createPublicationSchedule(db, {
    ...scheduleInput, guidanceAcknowledged: false,
  }), /guidance changed/u);
  await assert.rejects(() => previewPublicationScheduleGuidance(db, {
    ...scheduleBase, actorId: editor.id,
  }), /owner or admin/u);
  await assert.rejects(() => previewPublicationScheduleGuidance(db, {
    ...scheduleBase, organizationId: other.id,
  }), /owner or admin/u);
  await assert.rejects(() => createPublicationSchedule(db, {
    ...scheduleInput, dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  }), /access token expires first/u);
  const plannedSchedule = await createPublicationSchedule(db, scheduleInput);
  assert.equal(plannedSchedule.status, "SCHEDULED");
  assert.equal((await createPublicationSchedule(db, scheduleInput)).id, plannedSchedule.id);
  assert.equal(await runDuePublicationSchedules(db, store,
    (async () => { throw new Error("not due"); }) as typeof fetch), 0);
  await assert.rejects(() => createPublicationSchedule(db, {
    ...scheduleInput, dueAt: new Date(scheduledAt.getTime() + 60000),
  }), /Schedule key belongs/u);
  assert.equal(await db.publicationAttempt.count({ where: { intentId: planned.intentId } }), 0);
  // Advance only the disposable worker clock; the reviewed due-time fingerprint
  // must remain unchanged through the worker claim.
  let scheduledCalls = 0;
  const scheduledProvider = async (_url: URL | RequestInfo, init?: RequestInit) => {
    scheduledCalls++;
    if (init?.method === "POST") return new Response(null, { status: 200,
      headers: { location: uri } });
    assert.equal(Buffer.from(await new Response(init?.body).arrayBuffer()).toString(),
      scheduledBytes.toString());
    return receipt();
  };
  const concurrentClaims = await Promise.all([
    runDuePublicationSchedules(db, store, scheduledProvider as typeof fetch,
      new Date(scheduledAt.getTime() + 1000)),
    runDuePublicationSchedules(db, store, scheduledProvider as typeof fetch,
      new Date(scheduledAt.getTime() + 1000)),
  ]);
  assert.equal(concurrentClaims.reduce((sum, count) => sum + count, 0), 1);
  assert.equal(scheduledCalls, 2);

  const changed = await prepared("Repeat campaign title fixture", Buffer.from("guidance-changed-bytes"));
  const changedBase = { ...scheduleBase, intentId: changed.intentId,
    requestKey: randomUUID(), dueAt: new Date(Date.now() + 3 * 60000) };
  const oldGuidance = await acknowledged(changedBase);
  const neighbor = await prepared("Repeat campaign title fixture", Buffer.from("neighbor-video-bytes"));
  const neighborInput = await acknowledged({ ...scheduleBase, intentId: neighbor.intentId,
    requestKey: randomUUID(), dueAt: new Date(Date.now() + 4 * 60000) });
  const neighborRow = await createPublicationSchedule(db, neighborInput);
  assert.equal(neighborRow.status, "SCHEDULED");
  await assert.rejects(() => createPublicationSchedule(db, oldGuidance), /guidance changed/u);
  const changedGuidance = await previewPublicationScheduleGuidance(db, changedBase);
  assert.ok(changedGuidance.warnings.some((warning) => warning.code === "SIMILAR_METADATA"));
  assert.ok(changedGuidance.warnings.some((warning) => warning.code === "CLOSE_SPACING"));
  const changedRow = await createPublicationSchedule(db, {
    ...changedBase, guidanceFingerprint: changedGuidance.fingerprint,
    guidanceAcknowledged: true,
  });
  // A further pending schedule changes the reviewed cadence. The due worker
  // must stop before any provider request, with no automatic retry.
  const later = await prepared("Another neighbor", Buffer.from("another-neighbor-bytes"));
  await createPublicationSchedule(db, await acknowledged({ ...scheduleBase,
    intentId: later.intentId, requestKey: randomUUID(),
    dueAt: new Date(Date.now() + 5 * 60000) }));
  assert.equal(await runDuePublicationSchedules(db, store,
    scheduledProvider as typeof fetch, new Date(changedRow.dueAt.getTime() + 1000)), 0);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({ where: { id: changedRow.id } })).status,
    "NEEDS_REVIEW");
  assert.equal(scheduledCalls, 2);

  const legacy = await prepared("Pre-guidance schedule fixture", Buffer.from("pre-guidance-bytes"));
  const legacyRow = await createPublicationSchedule(db, await acknowledged({ ...scheduleBase,
    intentId: legacy.intentId, requestKey: randomUUID(),
    dueAt: new Date(Date.now() + 2 * 60000) }));
  await db.publicationSchedule.update({ where: { id: legacyRow.id },
    data: { guidanceFingerprint: null } });
  assert.equal(await runDuePublicationSchedules(db, store,
    scheduledProvider as typeof fetch, new Date(legacyRow.dueAt.getTime() + 1000)), 0);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({ where: { id: legacyRow.id } })).status,
    "NEEDS_REVIEW");
  assert.equal(scheduledCalls, 2);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({
    where: { id: plannedSchedule.id } })).status, "CONFIRMED");
  assert.equal(await runDuePublicationSchedules(db, store,
    scheduledProvider as typeof fetch), 0);
  assert.equal(scheduledCalls, 2);

  const canceled = await prepared("Canceled schedule fixture", Buffer.from("canceled-video-bytes"));
  const cancelInput = await acknowledged({ ...scheduleBase, intentId: canceled.intentId,
    requestKey: randomUUID(), dueAt: new Date(Date.now() + 120000) });
  const cancelRow = await createPublicationSchedule(db, cancelInput);
  assert.equal((await cancelPublicationSchedule(db, { organizationId: org.id,
    actorId: owner.id, intentId: canceled.intentId })).status, "CANCELED");
  await assert.rejects(() => cancelPublicationSchedule(db, { organizationId: org.id,
    actorId: owner.id, intentId: canceled.intentId }), /already claimed or closed/u);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({ where: { id: cancelRow.id } })).status, "CANCELED");

  const interrupted = await prepared("Interrupted claim fixture", Buffer.from("claim-video-bytes"));
  const interruptedInput = await acknowledged({ ...scheduleBase, intentId: interrupted.intentId,
    requestKey: randomUUID(), dueAt: new Date(Date.now() + 120000) });
  const interruptedRow = await createPublicationSchedule(db, interruptedInput);
  await db.publicationSchedule.update({ where: { id: interruptedRow.id }, data: {
    status: "CLAIMED", claimedAt: new Date(Date.now() - 10 * 60 * 1000),
  } });
  assert.equal(await runDuePublicationSchedules(db, store,
    scheduledProvider as typeof fetch), 0);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({
    where: { id: interruptedRow.id } })).status, "NEEDS_REVIEW");
  assert.equal(await db.publicationAttempt.count({ where: { intentId: interrupted.intentId } }), 0);
  assert.equal(scheduledCalls, 2);

  const demoted = await prepared("Demoted scheduler fixture", Buffer.from("demoted-video-bytes"));
  const demotedInput = await acknowledged({ ...scheduleBase, intentId: demoted.intentId,
    requestKey: randomUUID(), dueAt: new Date(Date.now() + 120000) });
  const demotedRow = await createPublicationSchedule(db, demotedInput);
  await db.membership.update({ where: { userId_organizationId: {
    userId: owner.id, organizationId: org.id,
  } }, data: { role: "EDITOR" } });
  assert.equal(await runDuePublicationSchedules(db, store,
    scheduledProvider as typeof fetch, new Date(demotedRow.dueAt.getTime() + 1000)), 0);
  assert.equal((await db.publicationSchedule.findUniqueOrThrow({
    where: { id: demotedRow.id } })).status, "NEEDS_REVIEW");
  assert.equal(await db.publicationAttempt.count({ where: { intentId: demoted.intentId } }), 0);
  assert.equal(scheduledCalls, 2);
});
