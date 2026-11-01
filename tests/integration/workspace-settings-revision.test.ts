import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db, actor } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";

const orgs: string[] = [],
  users: string[] = [];
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("workspace settings require a tenant-bound revision and reject stale concurrent writes without audit", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Revision fixture" },
  });
  const other = await db.organization.create({
    data: { name: "Other revision fixture" },
  });
  orgs.push(org.id, other.id);
  const owner = await actor(org.id),
    admin = await actor(org.id, "ADMIN");
  const reader = await actor(org.id, "EDITOR"),
    outsider = await actor(other.id);
  users.push(owner.id, admin.id, reader.id, outsider.id);
  const path = `/workspaces/${org.id}`;
  assert.equal((await owner.call(path)).body.settingsRevision, 0);
  const input = {
    name: "First valid name",
    timezone: "UTC",
    expectedRevision: 0,
  };
  assert.equal(
    (
      await owner.call(path, "PATCH", {
        name: input.name,
        timezone: input.timezone,
      })
    ).status,
    400,
  );
  assert.equal(
    (await owner.call(path, "PATCH", { ...input, expectedRevision: -1 }))
      .status,
    400,
  );
  assert.equal(
    (await owner.call(path, "PATCH", { ...input, expectedRevision: "0" }))
      .status,
    400,
  );
  assert.equal(
    (
      await owner.call(path, "PATCH", {
        ...input,
        expectedRevision: 2147483647,
      })
    ).status,
    400,
  );
  assert.equal((await reader.call(path, "PATCH", input)).status, 403);
  assert.equal((await outsider.call(path, "PATCH", input)).status, 404);
  assert.equal(
    (await db.organization.findUniqueOrThrow({ where: { id: org.id } }))
      .settingsRevision,
    0,
  );
  const raced = await Promise.all(
    [owner, admin].map((user, index) =>
      user.call(path, "PATCH", { ...input, name: `Winner ${index}` }),
    ),
  );
  assert.deepEqual(raced.map((result) => result.status).sort(), [200, 409]);
  const winner = raced.find((result) => result.status === 200)!.body;
  assert.equal(winner.settingsRevision, 1);
  assert.equal((await owner.call(path)).body.name, winner.name);
  assert.equal(
    (await admin.call(path, "PATCH", { ...input, name: "Stale override" }))
      .status,
    409,
  );
  assert.equal(
    await db.auditLog.count({
      where: { organizationId: org.id, action: "workspace.updated" },
    }),
    1,
  );
  const second = await admin.call(path, "PATCH", {
    ...input,
    expectedRevision: 1,
    name: org.name,
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.settingsRevision, 2);
  assert.equal(second.body.name, org.name);
  assert.equal(
    (await owner.call(path, "PATCH", { ...input, name: "Old value returns" }))
      .status,
    409,
  );
  assert.equal(
    (await db.organization.findUniqueOrThrow({ where: { id: other.id } }))
      .settingsRevision,
    0,
  );
  const audits = await db.auditLog.findMany({
    where: { organizationId: org.id, action: "workspace.updated" },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(audits.length, 2);
  assert.deepEqual(
    audits
      .map(
        (audit) =>
          (audit.detail as { settingsRevision: number }).settingsRevision,
      )
      .sort(),
    [1, 2],
  );
});
