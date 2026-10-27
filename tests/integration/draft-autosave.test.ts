import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, actor, draft, scene, base } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
const orgs: string[] = [],
  users: string[] = [];
beforeEach(resetFixtureRateBudget);
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function setup() {
  const org = await db.organization.create({
    data: { name: "Autosave HTTP fixture" },
  });
  orgs.push(org.id);
  const owner = await actor(org.id);
  users.push(owner.id);
  const root = `/workspaces/${org.id}/content`;
  const created = await owner.call(root, "POST", draft);
  assert.equal(created.status, 201);
  return { org, owner, root, id: created.body.id as string };
}

test("autosave retains tenant/read-only boundaries and revision-atomic scene versions under concurrent writes", async () => {
  const w = await setup(),
    path = `${w.root}/${w.id}`;
  assert.equal(
    (
      await fetch(base + path, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "MarketingOS",
        },
        body: JSON.stringify({ ...draft, revision: 1, autosave: true }),
      })
    ).status,
    401,
  );
  for (const role of [
    "OWNER",
    "ADMIN",
    "EDITOR",
    "CREATOR",
    "CLIENT",
    "ANALYST",
  ] as const) {
    const user = await actor(w.org.id, role);
    users.push(user.id);
    const revision = (
      await db.contentItem.findUniqueOrThrow({ where: { id: w.id } })
    ).revision;
    const result = await user.call(path, "PUT", {
      ...draft,
      revision,
      autosave: true,
    });
    assert.equal(
      result.status,
      ["CLIENT", "ANALYST"].includes(role) ? 403 : 200,
    );
  }
  const stranger = await actor(null);
  users.push(stranger.id);
  assert.equal(
    (
      await stranger.call(path, "PUT", {
        ...draft,
        revision: 5,
        autosave: true,
      })
    ).status,
    404,
  );
  const other = await setup();
  assert.equal(
    (
      await other.owner.call(path, "PUT", {
        ...draft,
        revision: 5,
        autosave: true,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await w.owner.call(`${w.root}/${other.id}`, "PUT", {
        ...draft,
        revision: 1,
        autosave: true,
      })
    ).status,
    409,
  );
  const revision = (
    await db.contentItem.findUniqueOrThrow({ where: { id: w.id } })
  ).revision;
  const responses = await Promise.all(
    ["First", "Second"].map((title) =>
      w.owner.call(path, "PUT", {
        ...draft,
        title,
        scenes: [{ ...scene, voiceover: title }],
        revision,
        autosave: true,
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const row = await db.contentItem.findUniqueOrThrow({ where: { id: w.id } });
  assert.equal(row.revision, revision + 1);
  assert.equal((row.scenes as any[])[0].voiceover, row.title);
  assert.equal(
    await db.contentVersion.count({ where: { contentId: w.id } }),
    row.revision,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: w.id, action: "content.edited" },
    }),
    row.revision - 1,
  );
  assert.equal(
    (await w.owner.call(path, "PUT", { ...draft, revision, autosave: true }))
      .status,
    409,
  );
});

test("automatic saves reject reviewed approved archived or invalid drafts while explicit edits retain approval invalidation", async () => {
  const w = await setup(),
    path = `${w.root}/${w.id}`;
  for (const status of ["REVIEW", "APPROVED", "ARCHIVED"] as const) {
    await db.contentItem.update({
      where: { id: w.id },
      data: { status, approvedAt: status === "APPROVED" ? new Date() : null },
    });
    assert.equal(
      (
        await w.owner.call(path, "PUT", {
          ...draft,
          revision: 1,
          autosave: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (await db.contentItem.findUniqueOrThrow({ where: { id: w.id } })).status,
      status,
    );
    assert.equal(
      await db.contentVersion.count({ where: { contentId: w.id } }),
      1,
    );
  }
  await db.contentItem.update({
    where: { id: w.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: w.owner.id,
    },
  });
  const intent = await db.publicationIntent.create({
    data: {
      organizationId: w.org.id,
      contentId: w.id,
      contentRevision: 1,
      platform: "LinkedIn",
      createdBy: w.owner.id,
      requestKey: randomUUID(),
      requestHash: "fixture",
      snapshot: draft,
    },
  });
  for (const extra of [
    { autosave: false },
    { autosave: "true" },
    { title: "" },
    { organizationId: "forged" },
  ])
    assert.equal(
      (
        await w.owner.call(path, "PUT", {
          ...draft,
          revision: 1,
          autosave: true,
          ...extra,
        })
      ).status,
      400,
    );
  const saved = await w.owner.call(path, "PUT", {
    ...draft,
    title: "Explicit reviewed edit",
    revision: 1,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, "DRAFT");
  assert.equal(saved.body.approvedAt, null);
  assert.equal(saved.body.approvedBy, null);
  assert.equal(
    (await db.publicationIntent.findUniqueOrThrow({ where: { id: intent.id } }))
      .status,
    "INVALIDATED",
  );
  assert.equal(
    (await w.owner.call(path, "PUT", { ...draft, revision: 2, autosave: true }))
      .status,
    200,
  );
  await db.membership.delete({
    where: {
      userId_organizationId: { userId: w.owner.id, organizationId: w.org.id },
    },
  });
  assert.equal(
    (await w.owner.call(path, "PUT", { ...draft, revision: 3, autosave: true }))
      .status,
    404,
  );
  assert.equal(
    (await db.contentItem.findUniqueOrThrow({ where: { id: w.id } })).revision,
    3,
  );
});
