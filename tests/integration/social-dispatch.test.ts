import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { db, actor, draft, scene } from "../support/http";
import { encryptSocialToken } from "../../packages/core/social-tokens";
import { ObjectStore } from "../../packages/core/object-store";
import { dispatchReviewedYoutubeVideo, reconcileUnknownYoutubeUpload } from "../../apps/api/src/youtube-dispatch";
import { youtubePolicyVersion } from "../../packages/core/youtube-policy";

const orgs: string[] = [], users: string[] = [];
const priorKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
const priorDispatch = process.env.YOUTUBE_LIVE_DISPATCH_ENABLED;
const priorReviewVersion = process.env.YOUTUBE_POLICY_REVIEWED_VERSION;
const priorReviewAt = process.env.YOUTUBE_POLICY_REVIEWED_AT;
after(async () => {
  if (priorKey === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = priorKey;
  for (const [key, value] of Object.entries({
    YOUTUBE_LIVE_DISPATCH_ENABLED: priorDispatch,
    YOUTUBE_POLICY_REVIEWED_VERSION: priorReviewVersion,
    YOUTUBE_POLICY_REVIEWED_AT: priorReviewAt,
  })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await db.publicationAttempt.deleteMany({ where: { organizationId: { in: orgs } } });
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
  } } as ObjectStore;
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
  const confirmed = await dispatchReviewedYoutubeVideo(db, store, first, successful as typeof fetch);
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
  let starts = 0, sends = 0, probes = 0;
  const unknown = await dispatchReviewedYoutubeVideo(db, store, second,
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
});
