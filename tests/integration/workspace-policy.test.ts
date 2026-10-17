import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { db, actor, base, draft, scene } from "../support/http";
import rules from "../../packages/core/youtube-rules.json";
import { youtubePolicySourceFingerprint, youtubePolicyVersion } from "../../packages/core/youtube-policy";
import { encryptSocialToken } from "../../packages/core/social-tokens";
import { ObjectStore } from "../../packages/core/object-store";
import { reservePublicationAttempt, enterPublicationSubmission } from "../../apps/api/src/publication-attempts";
import { dispatchReviewedYoutubeVideo } from "../../apps/api/src/youtube-dispatch";
import { createPublicationSchedule, previewPublicationScheduleGuidance, runDuePublicationSchedules } from "../../apps/api/src/publication-scheduler";
import { evaluateManualGuidance } from "../../apps/api/src/posting-guidance";

const orgs: string[] = [], users: string[] = [];
const prior = Object.fromEntries(["SOCIAL_TOKEN_ENCRYPTION_KEY", "YOUTUBE_LIVE_DISPATCH_ENABLED",
  "YOUTUBE_SCHEDULED_DISPATCH_ENABLED", "YOUTUBE_POLICY_REVIEWED_VERSION",
  "YOUTUBE_POLICY_SOURCE_FINGERPRINT", "YOUTUBE_POLICY_REVIEWED_AT"].map((key) => [key, process.env[key]]));
after(async () => {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  const where = { organizationId: { in: orgs } };
  await db.publicationAttempt.deleteMany({ where });
  await db.publicationSchedule.deleteMany({ where });
  await db.publicationPolicyReview.deleteMany({ where });
  await db.socialConnection.deleteMany({ where });
  await db.renderJob.deleteMany({ where });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("workspace policy API is tenant/role/revision bound and concurrent updates do not overwrite", async () => {
  const org = await db.organization.create({ data: { name: "Policy API fixture" } });
  const other = await db.organization.create({ data: { name: "Other policy fixture" } });
  orgs.push(org.id, other.id);
  const owner = await actor(org.id), admin = await actor(org.id, "ADMIN"), outsider = await actor(other.id);
  users.push(owner.id, admin.id, outsider.id);
  const path = `/workspaces/${org.id}/youtube-policy`;
  const initial = await owner.call(path);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.revision, 0);
  assert.equal(initial.body.policyVersion, youtubePolicyVersion);
  for (const role of ["EDITOR", "CREATOR", "ANALYST", "CLIENT"] as const) {
    const member = await actor(org.id, role); users.push(member.id);
    assert.equal((await member.call(path)).status, 403);
    assert.equal((await member.call(path, "PUT", { expectedRevision: 0, rules })).status, 403);
  }
  assert.equal((await outsider.call(path)).status, 404);
  assert.equal((await outsider.call(path, "PUT", { expectedRevision: 0, rules })).status, 404);
  assert.equal((await owner.call(path, "PUT", { rules })).status, 400);
  assert.equal((await owner.call(path, "PUT", { expectedRevision: 0,
    rules: { ...rules, titleMaxCharacters: 101 } })).status, 400);
  assert.equal((await owner.call(path, "PUT", { expectedRevision: 0,
    rules: { ...rules, unknownRule: true } })).status, 400);
  const writes = await Promise.all([owner, admin].map((user) => user.call(path, "PUT", {
    expectedRevision: 0, rules: { ...rules, allowedPrivacyStatuses: ["private"] },
  })));
  assert.deepEqual(writes.map((result) => result.status).sort(), [200, 409]);
  const saved = await owner.call(path);
  assert.equal(saved.body.revision, 1);
  assert.notEqual(saved.body.policyVersion, initial.body.policyVersion);
  assert.equal(await db.auditLog.count({ where: { organizationId: org.id, action: "policy.youtube_updated" } }), 1);
  assert.equal((await outsider.call(`/workspaces/${other.id}/youtube-policy`)).body.revision, 0);
  // Returning to the original values still advances identity; an old review
  // cannot become eligible again through an A -> B -> A policy change.
  const reset = await admin.call(path, "PUT", { expectedRevision: 1, rules });
  assert.equal(reset.status, 200); assert.equal(reset.body.revision, 2);
  assert.notEqual(reset.body.policyVersion, initial.body.policyVersion);
  assert.notEqual(reset.body.policyVersion, saved.body.policyVersion);
  assert.equal((await owner.call(path, "PUT", { expectedRevision: 1, rules })).status, 409);
  // A malformed stored rule fails publishing closed but remains repairable by
  // an authorized operator; this simulates deployment policy incompatibility.
  await db.workspaceYoutubePolicy.update({ where: { organizationId: org.id }, data: { rules: {} } });
  const invalid = await owner.call(path);
  assert.equal(invalid.status, 200); assert.equal(invalid.body.needsReview, true);
  assert.equal(invalid.body.revision, 2);
  const fixed = await admin.call(path, "PUT", { expectedRevision: 2, rules });
  assert.equal(fixed.status, 200); assert.equal(fixed.body.needsReview, false);
  const exported = await fetch(base + `/workspaces/${org.id}/operations/export`, { headers: owner.headers });
  assert.equal(exported.status, 200);
  const records = (await exported.text()).trim().split("\n").map((line) => JSON.parse(line));
  const policies = records.filter((row) => row.type === "youtubePolicy");
  assert.equal(policies.length, 1);
  assert.equal(policies[0].data.organizationId, org.id);
  assert.equal(policies[0].data.revision, 3);
});

test("workspace policy changes invalidate manual, reserved and scheduled reviews before provider requests", async () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.YOUTUBE_LIVE_DISPATCH_ENABLED = "true";
  process.env.YOUTUBE_SCHEDULED_DISPATCH_ENABLED = "true";
  process.env.YOUTUBE_POLICY_REVIEWED_VERSION = youtubePolicyVersion;
  process.env.YOUTUBE_POLICY_SOURCE_FINGERPRINT = youtubePolicySourceFingerprint;
  process.env.YOUTUBE_POLICY_REVIEWED_AT = new Date().toISOString();
  const org = await db.organization.create({ data: { name: "Workspace dispatch fixture" } });
  orgs.push(org.id);
  const owner = await actor(org.id); users.push(owner.id);
  const root = `/workspaces/${org.id}`;
  const identity = { organizationId: org.id, provider: "YOUTUBE" as const, externalAccountId: "UCfixture_workspace_policy" };
  const connection = await db.socialConnection.create({ data: { ...identity,
    accountLabel: "Policy test channel", scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    accessTokenCiphertext: encryptSocialToken("fixture-token", identity),
    tokenExpiresAt: new Date(Date.now() + 2 * 3600000),
  } });
  const bytes = Buffer.from("policy-test-only-video");
  const store = { configured: true, async get() { return { Body: Readable.from([bytes]) }; } } as unknown as ObjectStore;
  const reviewInput = { connectionId: connection.id, privacyStatus: "private", selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true, metadataReviewed: true, audienceReviewed: true,
    syntheticMediaReviewed: true, rightsAndPlatformRulesReviewed: true };
  async function prepared(title: string, review = true) {
    const c = await owner.call(root + "/content", "POST", { ...draft, title,
      platform: "YouTube", format: "Video", scenes: [scene] });
    assert.equal(c.status, 201);
    assert.equal((await owner.call(root + `/content/${c.body.id}/review`, "POST", { revision: 1 })).status, 201);
    assert.equal((await owner.call(root + `/content/${c.body.id}/approve`, "POST", { revision: 1, factsAndRightsReviewed: true })).status, 201);
    const render = await db.renderJob.create({ data: { organizationId: org.id, contentId: c.body.id,
      contentRevision: 1, actorId: owner.id, requestKey: randomUUID(), requestHash: "policy-test-only",
      snapshot: {}, options: {}, totalScenes: 1, status: "SUCCEEDED", outputKey: `${org.id}/${randomUUID()}`,
      outputBytes: bytes.length, approvedAt: new Date(), approvedBy: owner.id } });
    const intent = await owner.call(root + "/publication-intents", "POST", {
      contentId: c.body.id, revision: 1, renderId: render.id, requestKey: randomUUID() });
    assert.equal(intent.status, 201);
    if (review) assert.equal((await owner.call(root + `/publication-intents/${intent.body.id}/youtube-policy-review`, "POST", reviewInput)).status, 201);
    return { organizationId: org.id, actorId: owner.id, intentId: intent.body.id,
      connectionId: connection.id, requestKey: randomUUID(), contentRevision: 1, renderId: render.id };
  }
  const manual = await prepared("Manual fixture"), reservedInput = await prepared("Reserved fixture"), planned = await prepared("Scheduled fixture");
  const reserved = await reservePublicationAttempt(db, reservedInput);
  const scheduleInput = { ...planned, dueAt: new Date(Date.now() + 3 * 60000) };
  const guidance = await previewPublicationScheduleGuidance(db, scheduleInput);
  const schedule = await createPublicationSchedule(db, { ...scheduleInput,
    guidanceFingerprint: guidance.fingerprint, guidanceAcknowledged: true });
  const changed = await owner.call(root + "/youtube-policy", "PUT", { expectedRevision: 0,
    rules: { ...rules, titleMaxCharacters: 30, allowedPrivacyStatuses: ["private"], requireSyntheticMediaDeclaration: true } });
  assert.equal(changed.status, 200);
  let providerCalls = 0;
  const provider = (async () => { providerCalls++; throw new Error("No provider request expected"); }) as typeof fetch;
  await assert.rejects(() => dispatchReviewedYoutubeVideo(db, store, manual, provider), /current reviewed YouTube upload policy/);
  assert.equal(await db.publicationAttempt.count({ where: { intentId: manual.intentId } }), 0);
  await assert.rejects(() => enterPublicationSubmission(db, { organizationId: org.id,
    actorId: owner.id, attemptId: reserved.id, expectedVersion: reserved.version }), /current reviewed YouTube upload policy/);
  await assert.rejects(() => evaluateManualGuidance(db, { ...manual, checkedAt: new Date() }), /current reviewed YouTube upload policy/);
  await assert.rejects(() => previewPublicationScheduleGuidance(db, scheduleInput), /remain current/);
  assert.equal(await runDuePublicationSchedules(db, store, provider, new Date(scheduleInput.dueAt.getTime() + 1000)), 0);
  const blocked = await db.publicationSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
  assert.equal(blocked.status, "NEEDS_REVIEW"); assert.equal(blocked.outcomeCode, "POLICY_REVIEW_CHANGED");
  assert.equal(providerCalls, 0);
  const fresh = await prepared("Fresh fixture", false);
  const path = root + `/publication-intents/${fresh.intentId}`;
  const preview = await owner.call(path + "/youtube-policy-preview");
  assert.equal(preview.body.workspacePolicyRevision, 1);
  assert.equal(preview.body.policyVersion, changed.body.policyVersion);
  assert.equal((await owner.call(path + "/youtube-policy-review", "POST", reviewInput)).status, 409);
  const currentReviewInput = { ...reviewInput, workspacePolicyRevision: 1 };
  assert.equal((await owner.call(path + "/youtube-policy-review", "POST", { ...currentReviewInput, privacyStatus: "public" })).status, 400);
  assert.equal((await owner.call(path + "/youtube-policy-review", "POST", { ...currentReviewInput, containsSyntheticMedia: false })).status, 400);
  const freshReview = await owner.call(path + "/youtube-policy-review", "POST", currentReviewInput);
  assert.equal(freshReview.status, 201);
  assert.equal(freshReview.body.policyVersion, changed.body.policyVersion);
  const attempt = await reservePublicationAttempt(db, fresh);
  const submitted = await enterPublicationSubmission(db, { organizationId: org.id,
    actorId: owner.id, attemptId: attempt.id, expectedVersion: attempt.version });
  assert.equal(submitted.status, "SUBMITTING");
  assert.equal((submitted.policySnapshot as any).policyVersion, changed.body.policyVersion);
  assert.equal(providerCalls, 0);
  // Updating the content revision still invalidates preparation and review.
  const item = await db.publicationIntent.findUniqueOrThrow({ where: { id: fresh.intentId } });
  const edit = await owner.call(root + `/content/${item.contentId}`, "PUT", {
    ...draft, title: "Edited fixture", platform: "YouTube", format: "Video", scenes: [scene], revision: 1 });
  assert.equal(edit.status, 200);
  assert.equal((await owner.call(path + "/youtube-policy-preview")).status, 409);
});
