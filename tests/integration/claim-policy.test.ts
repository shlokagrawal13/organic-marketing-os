import "../support/isolated";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { actor, db, draft, scene } from "../support/http";
import { ObjectStore } from "../../packages/core/object-store";
import { encryptSocialToken } from "../../packages/core/social-tokens";
import {
  claimEvidenceMaximumAgeMs,
} from "../../packages/core/evidence-source";
import { youtubePolicyVersion } from "../../packages/core/youtube-policy";
import {
  enterPublicationSubmission,
  reservePublicationAttempt,
} from "../../apps/api/src/publication-attempts";
import {
  createPublicationSchedule,
  previewPublicationScheduleGuidance,
  runDuePublicationSchedules,
} from "../../apps/api/src/publication-scheduler";
import { dispatchReviewedYoutubeVideo } from "../../apps/api/src/youtube-dispatch";

const organizations: string[] = [];
const users: string[] = [];
const priorEnvironment = Object.fromEntries(
  [
    "SOCIAL_TOKEN_ENCRYPTION_KEY",
    "YOUTUBE_LIVE_DISPATCH_ENABLED",
    "YOUTUBE_SCHEDULED_DISPATCH_ENABLED",
    "YOUTUBE_POLICY_REVIEWED_VERSION",
    "YOUTUBE_POLICY_REVIEWED_AT",
  ].map((key) => [key, process.env[key]]),
);

after(async () => {
  for (const [key, value] of Object.entries(priorEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("claim evidence is rechecked at scheduling, reservation, due claim, and submission", async () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.YOUTUBE_LIVE_DISPATCH_ENABLED = "true";
  process.env.YOUTUBE_SCHEDULED_DISPATCH_ENABLED = "true";
  process.env.YOUTUBE_POLICY_REVIEWED_VERSION = youtubePolicyVersion;
  process.env.YOUTUBE_POLICY_REVIEWED_AT = new Date().toISOString();

  const organization = await db.organization.create({
    data: { name: "Dispatch evidence freshness QA" },
  });
  organizations.push(organization.id);
  const owner = await actor(organization.id);
  users.push(owner.id);
  const root = `/workspaces/${organization.id}`;
  const identity = {
    organizationId: organization.id,
    provider: "YOUTUBE" as const,
    externalAccountId: "UCclaim_freshness_fixture_123",
  };
  const connection = await db.socialConnection.create({
    data: {
      ...identity,
      accountLabel: "Claim freshness fixture",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      accessTokenCiphertext: encryptSocialToken("fixture-token", identity),
      refreshTokenCiphertext: encryptSocialToken("fixture-refresh", identity),
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  async function prepareClaimVideo(label: string, checkedAt: Date) {
    const created = await owner.call(root + "/content", "POST", {
      ...draft,
      title: label,
      hook: "Guaranteed 50% growth in 30 days",
      body: "The most effective workflow doubles qualified leads.",
      platform: "YouTube",
      format: "Video",
      scenes: [scene],
    });
    assert.equal(created.status, 201);
    const contentId = created.body.id;
    assert.equal(
      (
        await owner.call(root + `/content/${contentId}/review`, "POST", {
          revision: 1,
        })
      ).status,
      201,
    );
    const detail = await owner.call(root + `/content/${contentId}`);
    assert.ok(detail.body.claimPolicy.claims.length > 0);
    const resolutions = detail.body.claimPolicy.claims.map(
      (claim: { id: string }) => ({
        claimId: claim.id,
        disposition: "EVIDENCE",
        sourceUrl: "https://www.w3.org/TR/WCAG22/",
        sourceLabel: "Test-only standards reference",
        checkedAt: checkedAt.toISOString(),
        acknowledged: true,
      }),
    );
    assert.equal(
      (
        await owner.call(root + `/content/${contentId}/claim-review`, "POST", {
          revision: 1,
          policyVersion: detail.body.claimPolicy.policyVersion,
          claimSetFingerprint: detail.body.claimPolicy.claimSetFingerprint,
          resolutions,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await owner.call(root + `/content/${contentId}/approve`, "POST", {
          revision: 1,
          factsAndRightsReviewed: true,
        })
      ).status,
      201,
    );
    const media = Buffer.from(`private-video-${label}`);
    const outputKey = `${organization.id}/claim-freshness/${randomUUID()}.mp4`;
    const render = await db.renderJob.create({
      data: {
        organizationId: organization.id,
        contentId,
        contentRevision: 1,
        actorId: owner.id,
        requestKey: randomUUID(),
        requestHash: "claim-freshness-fixture",
        snapshot: { ...draft, format: "Video", scenes: [scene] },
        options: {},
        totalScenes: 1,
        status: "SUCCEEDED",
        outputKey,
        outputBytes: media.length,
        approvedAt: new Date(),
        approvedBy: owner.id,
      },
    });
    const prepared = await owner.call(root + "/publication-intents", "POST", {
      contentId,
      revision: 1,
      renderId: render.id,
      requestKey: randomUUID(),
    });
    assert.equal(prepared.status, 201);
    assert.equal(
      (
        await owner.call(
          root +
            `/publication-intents/${prepared.body.id}/youtube-policy-review`,
          "POST",
          {
            connectionId: connection.id,
            privacyStatus: "private",
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: true,
            metadataReviewed: true,
            audienceReviewed: true,
            syntheticMediaReviewed: true,
            rightsAndPlatformRulesReviewed: true,
          },
        )
      ).status,
      201,
    );
    const review = await db.contentClaimReview.findFirstOrThrow({
      where: { contentId },
    });
    return {
      contentId,
      intentId: prepared.body.id as string,
      review,
      resolutions,
      media: {
        sha256: createHash("sha256").update(media).digest("hex"),
        bytes: media.length,
        outputKey,
      },
      video: media,
    };
  }

  const expiredAt = new Date(Date.now() - claimEvidenceMaximumAgeMs - 1000);
  const immediate = await prepareClaimVideo(
    "Immediate claim freshness fixture",
    new Date(),
  );
  const expire = (resolutions: any[], checkedAt: Date) =>
    resolutions.map((resolution) => ({
      ...resolution,
      ...(resolution.disposition === "EVIDENCE"
        ? { checkedAt: checkedAt.toISOString() }
        : {}),
    }));
  await db.contentClaimReview.update({
    where: { id: immediate.review.id },
    data: { resolutions: expire(immediate.resolutions, expiredAt) },
  });
  let providerCalls = 0;
  const store = {
    configured: true,
    async get(key: string) {
      assert.equal(key, immediate.media.outputKey);
      return { Body: Readable.from([immediate.video]) };
    },
  } as ObjectStore;
  await assert.rejects(
    () =>
      dispatchReviewedYoutubeVideo(
        db,
        store,
        {
          organizationId: organization.id,
          intentId: immediate.intentId,
          connectionId: connection.id,
          requestKey: randomUUID(),
          actorId: owner.id,
        },
        (async () => {
          providerCalls++;
          throw new Error("provider must not be called");
        }) as typeof fetch,
      ),
    /Claim evidence is no longer current/u,
  );
  assert.equal(providerCalls, 0);
  assert.equal(
    await db.publicationAttempt.count({
      where: { intentId: immediate.intentId },
    }),
    0,
  );

  await db.contentClaimReview.update({
    where: { id: immediate.review.id },
    data: { resolutions: expire(immediate.resolutions, new Date()) },
  });
  const reserved = await reservePublicationAttempt(db, {
    organizationId: organization.id,
    intentId: immediate.intentId,
    connectionId: connection.id,
    requestKey: randomUUID(),
    actorId: owner.id,
    media: immediate.media,
  });
  await db.contentClaimReview.update({
    where: { id: immediate.review.id },
    data: { resolutions: expire(immediate.resolutions, expiredAt) },
  });
  await assert.rejects(
    () =>
      enterPublicationSubmission(db, {
        organizationId: organization.id,
        attemptId: reserved.id,
        expectedVersion: reserved.version,
        actorId: owner.id,
        media: immediate.media,
      }),
    /Claim evidence is no longer current/u,
  );
  assert.deepEqual(
    await db.publicationAttempt.findUniqueOrThrow({
      where: { id: reserved.id },
      select: { status: true, policySnapshot: true, startedAt: true },
    }),
    { status: "RESERVED", policySnapshot: null, startedAt: null },
  );
  await db.contentClaimReview.update({
    where: { id: immediate.review.id },
    data: { resolutions: expire(immediate.resolutions, new Date()) },
  });
  const started = await enterPublicationSubmission(db, {
    organizationId: organization.id,
    attemptId: reserved.id,
    expectedVersion: reserved.version,
    actorId: owner.id,
    media: immediate.media,
  });
  assert.equal(started.status, "SUBMITTING");
  assert.ok((started.policySnapshot as any).claimReview.reviewId);
  assert.equal(
    JSON.stringify((started.policySnapshot as any).claimReview).includes(
      "sourceUrl",
    ),
    false,
  );
  assert.equal(
    JSON.stringify((started.policySnapshot as any).claimReview).includes(
      "w3.org",
    ),
    false,
  );

  const dueAt = new Date(Date.now() + 2 * 60 * 1000);
  const expiresBeforeDue = new Date(
    Date.now() - claimEvidenceMaximumAgeMs + 60 * 1000,
  );
  const scheduled = await prepareClaimVideo(
    "Scheduled claim freshness fixture",
    expiresBeforeDue,
  );
  const scheduleBase = {
    organizationId: organization.id,
    actorId: owner.id,
    intentId: scheduled.intentId,
    connectionId: connection.id,
    requestKey: randomUUID(),
    dueAt,
  };
  await assert.rejects(
    () => previewPublicationScheduleGuidance(db, scheduleBase),
    /Claim evidence is no longer current/u,
  );
  await db.contentClaimReview.update({
    where: { id: scheduled.review.id },
    data: { resolutions: expire(scheduled.resolutions, new Date()) },
  });
  const guidance = await previewPublicationScheduleGuidance(db, scheduleBase);
  const schedule = await createPublicationSchedule(db, {
    ...scheduleBase,
    guidanceFingerprint: guidance.fingerprint,
    guidanceAcknowledged: true,
  });
  await db.contentClaimReview.update({
    where: { id: scheduled.review.id },
    data: { resolutions: expire(scheduled.resolutions, expiredAt) },
  });
  assert.equal(
    await runDuePublicationSchedules(
      db,
      { configured: true } as ObjectStore,
      (async () => {
        providerCalls++;
        throw new Error("provider must not be called");
      }) as typeof fetch,
      new Date(dueAt.getTime() + 1000),
    ),
    0,
  );
  assert.equal(providerCalls, 0);
  assert.deepEqual(
    await db.publicationSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
      select: { status: true, outcomeCode: true, attemptId: true },
    }),
    {
      status: "NEEDS_REVIEW",
      outcomeCode: "CLAIM_EVIDENCE_CHANGED",
      attemptId: null,
    },
  );
});

test("claim evidence is tenant and revision bound, owner overrides are audited, and publication is sanitized", async () => {
  const organization = await db.organization.create({
    data: { name: "Claim policy QA" },
  });
  const otherOrganization = await db.organization.create({
    data: { name: "Claim policy outsider QA" },
  });
  organizations.push(organization.id, otherOrganization.id);
  const owner = await actor(organization.id);
  const editor = await actor(organization.id, "EDITOR");
  const outsider = await actor(otherOrganization.id);
  users.push(owner.id, editor.id, outsider.id);
  const root = `/workspaces/${organization.id}`;
  const created = await owner.call(root + "/content", "POST", {
    ...draft,
    title: "Research-backed workflow",
    hook: "Grow qualified leads by 35% in 3 months",
    body: "Our award-winning workflow is more effective than spreadsheets.",
  });
  assert.equal(created.status, 201);
  const contentId = created.body.id;
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/review`, "POST", {
        revision: 1,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 1,
        factsAndRightsReviewed: true,
      })
    ).status,
    409,
  );

  const detail = await owner.call(root + `/content/${contentId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.claimPolicy.complete, false);
  assert.ok(detail.body.claimPolicy.claims.length >= 3);
  assert.equal(detail.body.claimReview, null);
  const base = {
    revision: 1,
    policyVersion: detail.body.claimPolicy.policyVersion,
    claimSetFingerprint: detail.body.claimPolicy.claimSetFingerprint,
  };
  const evidence = detail.body.claimPolicy.claims.map(
    (claim: { id: string }) => ({
      claimId: claim.id,
      disposition: "EVIDENCE",
      sourceUrl: "https://Example.COM:443/source#fragment",
      sourceLabel: "Test-only source record",
      checkedAt: new Date().toISOString(),
      acknowledged: true,
    }),
  );
  const withOverride = evidence.map((resolution: any, index: number) =>
    index === 0
      ? {
          claimId: resolution.claimId,
          disposition: "OWNER_OVERRIDE",
          overrideReason:
            "The owner accepts responsibility pending a stronger source record.",
          acknowledged: true,
        }
      : resolution,
  );
  const staleTime = new Date(Date.now() - 31 * 86400000).toISOString();
  for (const patch of [
    { sourceUrl: "https://localhost./source" },
    { sourceUrl: "https://a.local../source" },
    { sourceUrl: "https://127.0.0.1/source" },
    { sourceUrl: "https://u:p@example.com/source" },
    { checkedAt: staleTime },
    { checkedAt: new Date(Date.now() + 600000).toISOString() },
  ]) {
    const rejected = await owner.call(
      root + `/content/${contentId}/claim-review`,
      "POST",
      {
        ...base,
        resolutions: evidence.map((r: any) => ({ ...r, ...patch })),
      },
    );
    assert.equal(rejected.status, 400, JSON.stringify(patch));
    assert.equal(
      await db.contentClaimReview.count({ where: { contentId } }),
      0,
    );
  }
  assert.equal(
    (
      await editor.call(root + `/content/${contentId}/claim-review`, "POST", {
        ...base,
        resolutions: withOverride,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await outsider.call(
        `/workspaces/${otherOrganization.id}/content/${contentId}/claim-review`,
        "POST",
        { ...base, resolutions: evidence },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/claim-review`, "POST", {
        ...base,
        resolutions: withOverride,
      })
    ).status,
    201,
  );
  const saved = await db.contentClaimReview.findFirstOrThrow({
    where: { contentId },
  });
  assert.equal(
    (saved.resolutions as any[]).find((r) => r.disposition === "EVIDENCE")
      .sourceUrl,
    "https://example.com/source",
  );
  const expired = (saved.resolutions as any[]).map((r) =>
    r.disposition === "EVIDENCE" ? { ...r, checkedAt: staleTime } : r,
  );
  for (const data of [
    { resolutions: expired },
    { policyVersion: "bounded-claims-2026-10-14" },
  ]) {
    await db.contentClaimReview.update({ where: { id: saved.id }, data });
    assert.equal(
      (
        await owner.call(root + `/content/${contentId}/approve`, "POST", {
          revision: 1,
          factsAndRightsReviewed: true,
        })
      ).status,
      409,
    );
    await db.contentClaimReview.update({
      where: { id: saved.id },
      data: {
        resolutions: saved.resolutions as any,
        policyVersion: saved.policyVersion,
      },
    });
  }
  const audit = await db.auditLog.findFirstOrThrow({
    where: {
      organizationId: organization.id,
      action: "content.claim_reviewed",
      entityId: contentId,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(JSON.stringify(audit.detail).includes("example.com"), false);
  assert.equal(
    JSON.stringify(audit.detail).includes("pending a stronger"),
    false,
  );
  assert.equal((audit.detail as any).ownerOverrideCount, 1);
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 1,
        factsAndRightsReviewed: true,
      })
    ).status,
    201,
  );
  await db.contentClaimReview.update({
    where: { id: saved.id },
    data: { resolutions: expired },
  });
  assert.equal(
    (
      await owner.call(root + "/publication-intents", "POST", {
        contentId,
        revision: 1,
        requestKey: randomUUID(),
      })
    ).status,
    409,
  );
  await db.contentClaimReview.update({
    where: { id: saved.id },
    data: { resolutions: saved.resolutions as any },
  });
  const prepared = await owner.call(root + "/publication-intents", "POST", {
    contentId,
    revision: 1,
    requestKey: randomUUID(),
  });
  assert.equal(prepared.status, 201);
  assert.equal(
    JSON.stringify(prepared.body.snapshot.claimReview).includes("sourceUrl"),
    false,
  );
  assert.equal(
    prepared.body.snapshot.claimReview.dispositions.length,
    evidence.length,
  );

  const edited = await owner.call(root + `/content/${contentId}`, "PUT", {
    ...draft,
    title: "Research-backed workflow updated",
    hook: "Grow qualified leads by 40% in 4 months",
    body: "Our award-winning workflow is more effective than spreadsheets.",
    revision: 1,
  });
  assert.equal(edited.status, 200);
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/review`, "POST", {
        revision: 2,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 2,
        factsAndRightsReviewed: true,
      })
    ).status,
    409,
  );
  const revised = await owner.call(root + `/content/${contentId}`);
  assert.equal(revised.body.claimPolicy.complete, false);
  assert.equal(revised.body.claimReview, null);
});
