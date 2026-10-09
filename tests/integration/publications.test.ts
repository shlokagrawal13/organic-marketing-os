import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, actor, draft, scene } from "../support/http";

const orgs: string[] = [],
  users: string[] = [];
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("approved publication preparation is tenant scoped, idempotent and invalidated on edit", async () => {
  const org = await db.organization.create({ data: { name: "Publishing QA" } });
  const otherOrg = await db.organization.create({
    data: { name: "Publishing outsider QA" },
  });
  orgs.push(org.id, otherOrg.id);
  const owner = await actor(org.id),
    creator = await actor(org.id, "CREATOR"),
    analyst = await actor(org.id, "ANALYST"),
    outsider = await actor(otherOrg.id);
  users.push(owner.id, creator.id, analyst.id, outsider.id);
  const root = `/workspaces/${org.id}`;
  const created = await owner.call(root + "/content", "POST", draft);
  assert.equal(created.status, 201);
  const contentId = created.body.id;
  const key = randomUUID();
  const payload = { contentId, revision: 1, requestKey: key };
  assert.equal(
    (await owner.call(root + "/publication-intents", "POST", payload)).status,
    409,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/review`, "POST", {
        revision: 1,
      })
    ).status,
    201,
  );
  assert.equal(
    (await owner.call(root + "/publication-intents", "POST", payload)).status,
    409,
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
  assert.equal(
    (await creator.call(root + "/publication-intents", "POST", payload)).status,
    403,
  );
  assert.equal(
    (await analyst.call(root + "/publication-intents", "POST", payload)).status,
    403,
  );
  assert.equal(
    (await outsider.call(root + "/publication-intents", "POST", payload))
      .status,
    404,
  );
  assert.equal(
    (
      await owner.call(root + "/publication-intents", "POST", {
        ...payload,
        renderId: randomUUID(),
      })
    ).status,
    400,
  );
  const [prepared, concurrent] = await Promise.all([
    owner.call(root + "/publication-intents", "POST", payload),
    owner.call(root + "/publication-intents", "POST", payload),
  ]);
  assert.equal(prepared.status, 201);
  assert.equal(concurrent.body.id, prepared.body.id);
  assert.equal(prepared.body.status, "PREPARED");
  assert.equal(prepared.body.platform, draft.platform);
  assert.equal(prepared.body.externallySubmitted, false);
  assert.equal(prepared.body.snapshot.body, draft.body);
  assert.equal("requestHash" in prepared.body, false);
  const retry = await owner.call(
    root + "/publication-intents",
    "POST",
    payload,
  );
  assert.equal(retry.body.id, prepared.body.id);
  assert.equal(
    (
      await owner.call(root + "/publication-intents", "POST", {
        ...payload,
        revision: 2,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await outsider.call(
        `/workspaces/${otherOrg.id}/publication-intents/${prepared.body.id}`,
      )
    ).status,
    404,
  );
  assert.deepEqual(
    await outsider.call(`/workspaces/${otherOrg.id}/publication-intents`),
    {
      status: 200,
      body: [],
    },
  );
  const edit = await owner.call(root + `/content/${contentId}`, "PUT", {
    ...draft,
    body: "A changed copy after approval.",
    revision: 1,
  });
  assert.equal(edit.status, 200);
  const invalidated = await owner.call(
    root + `/publication-intents/${prepared.body.id}`,
  );
  assert.equal(invalidated.body.status, "INVALIDATED");
  assert.equal(invalidated.body.snapshot.body, draft.body);
  assert.ok(invalidated.body.invalidatedAt);
  assert.equal(
    (await owner.call(root + "/publication-intents", "POST", payload)).body
      .status,
    "INVALIDATED",
  );
  assert.equal(
    (
      await owner.call(root + "/publication-intents", "POST", {
        ...payload,
        requestKey: randomUUID(),
      })
    ).status,
    409,
  );
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
    201,
  );
  const fresh = await owner.call(root + "/publication-intents", "POST", {
    ...payload,
    revision: 2,
    requestKey: randomUUID(),
  });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.snapshot.body, "A changed copy after approval.");
  assert.equal(
    (
      await creator.call(
        root + `/publication-intents/${fresh.body.id}/cancel`,
        "POST",
      )
    ).status,
    201,
  );
  assert.equal(
    (await owner.call(root + `/publication-intents/${fresh.body.id}`)).body
      .status,
    "CANCELED",
  );
  assert.equal(
    (
      await owner.call(
        root + `/publication-intents/${fresh.body.id}/cancel`,
        "POST",
      )
    ).status,
    409,
  );
  const archivable = await owner.call(root + "/publication-intents", "POST", {
    ...payload,
    revision: 2,
    requestKey: randomUUID(),
  });
  assert.equal(archivable.status, 201);
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/archive`, "POST", {
        revision: 2,
      })
    ).status,
    201,
  );
  assert.equal(
    (await owner.call(root + `/publication-intents/${archivable.body.id}`)).body
      .status,
    "INVALIDATED",
  );
  assert.equal(
    await db.publicationIntent.count({ where: { organizationId: org.id } }),
    3,
  );
  assert.equal(
    await db.auditLog.count({
      where: { organizationId: org.id, action: "publication.prepared" },
    }),
    3,
  );
  const video = await owner.call(root + "/content", "POST", {
    ...draft,
    format: "Video",
    scenes: [scene],
  });
  assert.equal(video.status, 201);
  assert.equal(
    (
      await owner.call(root + `/content/${video.body.id}/review`, "POST", {
        revision: 1,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${video.body.id}/approve`, "POST", {
        revision: 1,
        factsAndRightsReviewed: true,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + "/publication-intents", "POST", {
        contentId: video.body.id,
        revision: 1,
        requestKey: randomUUID(),
      })
    ).status,
    400,
  );
});
