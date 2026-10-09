import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { db, actor, draft, scene } from "../support/http";
import { encryptSocialToken } from "../../packages/core/social-tokens";
import {
  reservePublicationAttempt,
  enterPublicationSubmission,
  recordPublicationOutcome,
  recoverStalePublicationAttempts,
} from "../../apps/api/src/publication-attempts";

const orgs: string[] = [],
  users: string[] = [];
after(async () => {
  await db.publicationAttempt.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.socialConnection.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.renderJob.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("local connection revocation and durable unknown attempts never resubmit", async () => {
  const org = await db.organization.create({
    data: { name: "Social attempt fixture" },
  });
  const otherOrg = await db.organization.create({
    data: { name: "Other social fixture" },
  });
  orgs.push(org.id, otherOrg.id);
  const owner = await actor(org.id),
    editor = await actor(org.id, "EDITOR"),
    creator = await actor(org.id, "CREATOR"),
    outsider = await actor(otherOrg.id);
  users.push(owner.id, editor.id, creator.id, outsider.id);
  const root = `/workspaces/${org.id}`;
  const key = randomBytes(32).toString("base64");
  const identity = {
    organizationId: org.id,
    provider: "YOUTUBE" as const,
    externalAccountId: "test-only-channel",
  };
  // Simulates the future OAuth callback's durable row; it does not authorize a real account.
  const connection = await db.socialConnection.create({
    data: {
      ...identity,
      accountLabel: "Isolated channel fixture",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      accessTokenCiphertext: encryptSocialToken(
        "isolated-fixture-token",
        identity,
        key,
      ),
      refreshTokenCiphertext: encryptSocialToken(
        "isolated-fixture-refresh",
        identity,
        key,
      ),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    },
  });
  const listed = await owner.call(root + "/social-connections");
  assert.equal(listed.status, 200);
  assert.equal(listed.body[0].externalAccountId, identity.externalAccountId);
  assert.equal(JSON.stringify(listed.body).includes("Ciphertext"), false);
  assert.equal(
    JSON.stringify(listed.body).includes("isolated-fixture-token"),
    false,
  );
  assert.equal((await outsider.call(root + "/social-connections")).status, 404);
  assert.equal(
    (
      await creator.call(
        root + `/social-connections/${connection.id}/revoke`,
        "POST",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await outsider.call(
        `/workspaces/${otherOrg.id}/social-connections/${connection.id}/revoke`,
        "POST",
      )
    ).status,
    404,
  );

  async function preparedVideo(label: string) {
    const c = await owner.call(root + "/content", "POST", {
      ...draft,
      title: label,
      platform: "YouTube",
      format: "Video",
      scenes: [scene],
    });
    assert.equal(c.status, 201);
    assert.equal(
      (
        await owner.call(root + `/content/${c.body.id}/review`, "POST", {
          revision: 1,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await owner.call(root + `/content/${c.body.id}/approve`, "POST", {
          revision: 1,
          factsAndRightsReviewed: true,
        })
      ).status,
      201,
    );
    // Ledger-only synthetic render row; no media file and no provider call are made.
    const render = await db.renderJob.create({
      data: {
        organizationId: org.id,
        contentId: c.body.id,
        contentRevision: 1,
        actorId: owner.id,
        requestKey: randomUUID(),
        requestHash: "synthetic-ledger-only",
        snapshot: { ...draft, format: "Video", scenes: [scene] },
        options: {},
        totalScenes: 1,
        status: "SUCCEEDED",
        outputKey: `${org.id}/test-only/no-media`,
        approvedAt: new Date(),
        approvedBy: owner.id,
      },
    });
    const prep = await owner.call(root + "/publication-intents", "POST", {
      contentId: c.body.id,
      revision: 1,
      renderId: render.id,
      requestKey: randomUUID(),
    });
    assert.equal(prep.status, 201);
    return prep.body;
  }

  const intent = await preparedVideo("YouTube ledger fixture one");
  const args = {
    organizationId: org.id,
    intentId: intent.id,
    connectionId: connection.id,
    requestKey: randomUUID(),
    actorId: owner.id,
  };
  const [attempt, replay] = await Promise.all([
    reservePublicationAttempt(db, args),
    reservePublicationAttempt(db, args),
  ]);
  assert.equal(attempt.id, replay.id);
  assert.equal(attempt.status, "RESERVED");
  await assert.rejects(
    () => reservePublicationAttempt(db, { ...args, requestKey: randomUUID() }),
    /already has an attempt/,
  );
  const started = await enterPublicationSubmission(db, {
    organizationId: org.id,
    attemptId: attempt.id,
    expectedVersion: 1,
    actorId: owner.id,
  });
  assert.equal(started.status, "SUBMITTING");
  await assert.rejects(
    () =>
      enterPublicationSubmission(db, {
        organizationId: org.id,
        attemptId: attempt.id,
        expectedVersion: 1,
        actorId: owner.id,
      }),
    /Never submit it twice/,
  );
  assert.equal(
    await recoverStalePublicationAttempts(db, new Date(Date.now() + 1000)),
    1,
  );
  assert.equal(
    await recoverStalePublicationAttempts(db, new Date(Date.now() + 1000)),
    0,
  );
  const unknown = await db.publicationAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
  });
  assert.equal(unknown.status, "UNKNOWN");
  const duplicateIntent = await owner.call(
    root + "/publication-intents",
    "POST",
    {
      contentId: intent.contentId,
      revision: 1,
      renderId: intent.renderId,
      requestKey: randomUUID(),
    },
  );
  assert.equal(duplicateIntent.status, 201);
  await assert.rejects(
    () =>
      reservePublicationAttempt(db, {
        ...args,
        intentId: duplicateIntent.body.id,
        requestKey: randomUUID(),
      }),
    /may already exist/,
  );
  await assert.rejects(
    () =>
      recordPublicationOutcome(db, {
        organizationId: org.id,
        attemptId: attempt.id,
        expectedVersion: unknown.version,
        actorId: owner.id,
        outcome: { kind: "rejected", code: "NO_POST" },
      }),
    /cannot be changed/,
  );
  await assert.rejects(
    () =>
      recordPublicationOutcome(db, {
        organizationId: org.id,
        attemptId: attempt.id,
        expectedVersion: unknown.version,
        actorId: owner.id,
        outcome: {
          kind: "confirmed",
          providerPostId: "fixture-video",
          evidence: "receipt",
        },
      }),
    /verified provider lookup/,
  );
  const confirmed = await recordPublicationOutcome(db, {
    organizationId: org.id,
    attemptId: attempt.id,
    expectedVersion: unknown.version,
    actorId: owner.id,
    outcome: {
      kind: "confirmed",
      providerPostId: "fixture-video",
      evidence: "read_only_lookup",
    },
  });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.providerPostId, "fixture-video");

  const pending = await preparedVideo("YouTube ledger fixture two");
  const reserved = await reservePublicationAttempt(db, {
    ...args,
    intentId: pending.id,
    requestKey: randomUUID(),
  });
  const inflight = await preparedVideo("YouTube ledger fixture three");
  const reservedInflight = await reservePublicationAttempt(db, {
    ...args,
    intentId: inflight.id,
    requestKey: randomUUID(),
  });
  const submitting = await enterPublicationSubmission(db, {
    organizationId: org.id,
    attemptId: reservedInflight.id,
    expectedVersion: reservedInflight.version,
    actorId: owner.id,
  });
  assert.equal(
    (
      await editor.call(
        root + `/social-connections/${connection.id}/revoke`,
        "POST",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        root + `/social-connections/${connection.id}/revoke`,
        "POST",
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(
        root + `/social-connections/${connection.id}/revoke`,
        "POST",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await db.publicationAttempt.findUniqueOrThrow({
        where: { id: reserved.id },
      })
    ).status,
    "BLOCKED",
  );
  assert.equal(
    (
      await db.publicationAttempt.findUniqueOrThrow({
        where: { id: submitting.id },
      })
    ).status,
    "UNKNOWN",
  );
  await assert.rejects(
    () =>
      enterPublicationSubmission(db, {
        organizationId: org.id,
        attemptId: reserved.id,
        expectedVersion: 1,
        actorId: owner.id,
      }),
    /Never submit it twice/,
  );
  const third = await preparedVideo("YouTube ledger fixture four");
  await assert.rejects(
    () =>
      reservePublicationAttempt(db, {
        ...args,
        intentId: third.id,
        requestKey: randomUUID(),
      }),
    /current authorized YouTube upload connection/,
  );
  for (const [account, scopes, expiresAt] of [
    ["missing-upload-scope", ["openid"], new Date(Date.now() + 3600000)],
    [
      "expired-upload-scope",
      ["https://www.googleapis.com/auth/youtube.upload"],
      new Date(Date.now() - 1000),
    ],
    [
      "unknown-token-expiry",
      ["https://www.googleapis.com/auth/youtube.upload"],
      null,
    ],
  ] as const) {
    const context = {
      organizationId: org.id,
      provider: "YOUTUBE" as const,
      externalAccountId: account,
    };
    const invalid = await db.socialConnection.create({
      data: {
        ...context,
        accountLabel: account,
        scopes: [...scopes],
        accessTokenCiphertext: encryptSocialToken("fixture", context, key),
        tokenExpiresAt: expiresAt,
      },
    });
    await assert.rejects(
      () =>
        reservePublicationAttempt(db, {
          ...args,
          intentId: third.id,
          connectionId: invalid.id,
          requestKey: randomUUID(),
        }),
      /current authorized YouTube upload connection/,
    );
  }
  assert.equal(
    await db.publicationAttempt.count({ where: { organizationId: org.id } }),
    3,
  );
});
