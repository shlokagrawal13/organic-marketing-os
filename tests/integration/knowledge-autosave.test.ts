import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { actor, db, base } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
import { brandInput } from "../../packages/core/brand";
const orgs: string[] = [],
  users: string[] = [];
const input = () =>
  brandInput.parse({
    profile: { name: "Synthetic knowledge" },
    creativeDna: { voice: "Original voice" },
    revision: 0,
  });
beforeEach(resetFixtureRateBudget);
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function setup() {
  const org = await db.organization.create({
    data: { name: "Knowledge HTTP fixture" },
  });
  orgs.push(org.id);
  const owner = await actor(org.id);
  users.push(owner.id);
  return { org, owner, path: `/workspaces/${org.id}/brand` };
}
test("knowledge autosave enforces first-save consent tenant roles revoked membership and strict payloads", async () => {
  const w = await setup();
  assert.equal(
    (
      await fetch(base + w.path, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "MarketingOS",
        },
        body: JSON.stringify({ ...input(), autosave: true }),
      })
    ).status,
    401,
  );
  assert.equal(
    (await w.owner.call(w.path, "PUT", { ...input(), autosave: true })).status,
    409,
  );
  assert.equal(
    await db.brandBrain.count({ where: { organizationId: w.org.id } }),
    0,
  );
  assert.equal((await w.owner.call(w.path, "PUT", input())).status, 200);
  for (const role of [
    "OWNER",
    "ADMIN",
    "EDITOR",
    "CREATOR",
    "ANALYST",
    "CLIENT",
  ] as const) {
    const u = await actor(w.org.id, role);
    users.push(u.id);
    const revision = (
      await db.brandBrain.findUniqueOrThrow({
        where: { organizationId: w.org.id },
      })
    ).revision;
    assert.equal(
      (await u.call(w.path, "PUT", { ...input(), revision, autosave: true }))
        .status,
      ["OWNER", "ADMIN", "EDITOR"].includes(role) ? 200 : 403,
    );
  }
  const other = await setup();
  assert.equal(
    (
      await other.owner.call(w.path, "PUT", {
        ...input(),
        revision: 4,
        autosave: true,
      })
    ).status,
    404,
  );
  for (const extra of [
    { autosave: false },
    { autosave: "true" },
    { organizationId: other.org.id },
  ])
    assert.equal(
      (await w.owner.call(w.path, "PUT", { ...input(), revision: 4, ...extra }))
        .status,
      400,
    );
  await db.membership.delete({
    where: {
      userId_organizationId: { userId: w.owner.id, organizationId: w.org.id },
    },
  });
  assert.equal(
    (
      await w.owner.call(w.path, "PUT", {
        ...input(),
        revision: 4,
        autosave: true,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await db.brandBrain.findUniqueOrThrow({
        where: { organizationId: w.org.id },
      })
    ).revision,
    4,
  );
});
test("knowledge revisions atomically preserve profile DNA history audit and explicit restore", async () => {
  const w = await setup();
  await w.owner.call(w.path, "PUT", input());
  const results = await Promise.all(
    ["First voice", "Second voice"].map((voice) =>
      w.owner.call(w.path, "PUT", {
        ...input(),
        profile: { ...input().profile, industry: voice },
        creativeDna: { ...input().creativeDna, voice },
        revision: 1,
        autosave: true,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const row = await db.brandBrain.findUniqueOrThrow({
    where: { organizationId: w.org.id },
  });
  assert.equal(row.revision, 2);
  assert.equal((row.profile as any).industry, (row.creativeDna as any).voice);
  assert.equal(
    await db.brandVersion.count({ where: { organizationId: w.org.id } }),
    2,
  );
  assert.equal(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "brand.saved" },
    }),
    2,
  );
  assert.equal(
    (
      await w.owner.call(w.path, "PUT", {
        ...input(),
        revision: 1,
        autosave: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (await w.owner.call(w.path + "/restore/1", "POST", { revision: 1 })).status,
    409,
  );
  const restored = await w.owner.call(w.path + "/restore/1", "POST", {
    revision: 2,
  });
  assert.equal(restored.status, 201);
  assert.equal(restored.body.brain.revision, 3);
  assert.equal(restored.body.brain.creativeDna.voice, "Original voice");
  assert.equal(
    await db.brandVersion.count({ where: { organizationId: w.org.id } }),
    3,
  );
});
test("concurrent first brand creation yields one version and one controlled conflict without server errors", async () => {
  const w = await setup();
  const results = await Promise.all(
    [1, 2].map(() => w.owner.call(w.path, "PUT", input())),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.brandVersion.count({ where: { organizationId: w.org.id } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "brand.saved" },
    }),
    1,
  );
});
