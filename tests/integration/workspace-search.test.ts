import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { actor, db, base } from "../support/http";
const orgs: string[] = [],
  users: string[] = [];
async function setup() {
  const org = await db.organization.create({
    data: { name: "Synthetic search workspace" },
  });
  orgs.push(org.id);
  const user = await actor(org.id);
  users.push(user.id);
  const content = await db.contentItem.create({
    data: {
      organizationId: org.id,
      createdBy: user.id,
      title: "Synthetic launch content",
      body: "नमस्ते orchard",
      platform: "LinkedIn",
      format: "Text",
    },
  });
  const campaign = await db.campaign.create({
    data: {
      organizationId: org.id,
      name: "Synthetic launch campaign",
      goal: "Orchard awareness",
      audience: "Test audience",
    },
  });
  const asset = await db.asset.create({
    data: {
      organizationId: org.id,
      createdBy: user.id,
      name: "Synthetic launch image.png",
      kind: "IMAGE",
      mimeType: "image/png",
      bytes: 3,
      sha256: randomUUID(),
      objectKey: `${org.id}/private-secret.png`,
      tags: ["orchard"],
    },
  });
  return { org, user, content, campaign, asset, path: `/workspaces/${org.id}` };
}
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test("search and result opening enforce authentication, tenant isolation and current membership for every read role", async () => {
  const a = await setup(),
    b = await setup();
  assert.equal((await fetch(base + a.path + "/search?q=launch")).status, 401);
  assert.equal((await b.user.call(a.path + "/search?q=launch")).status, 404);
  for (const role of [
    "OWNER",
    "ADMIN",
    "EDITOR",
    "CREATOR",
    "ANALYST",
    "CLIENT",
  ] as const) {
    const user = await actor(a.org.id, role);
    users.push(user.id);
    const r = await user.call(a.path + "/search?q=launch");
    assert.equal(r.status, 200);
    assert.deepEqual(
      new Set(r.body.items.map((x: any) => x.id)),
      new Set([a.content.id, a.campaign.id, a.asset.id]),
    );
    for (const [kind, own, other] of [
      ["content", a.content.id, b.content.id],
      ["campaigns", a.campaign.id, b.campaign.id],
      ["assets", a.asset.id, b.asset.id],
    ]) {
      assert.equal((await user.call(`${a.path}/${kind}/${own}`)).status, 200);
      assert.equal((await user.call(`${a.path}/${kind}/${other}`)).status, 404);
    }
    if (["ANALYST", "CLIENT"].includes(role)) {
      assert.equal(
        (
          await user.call(`${a.path}/assets/${a.asset.id}`, "PATCH", {
            name: "forbidden",
          })
        ).status,
        403,
      );
      assert.equal(
        (await user.call(`${a.path}/campaigns`, "POST", {})).status,
        403,
      );
    }
    await db.membership.delete({
      where: {
        userId_organizationId: { userId: user.id, organizationId: a.org.id },
      },
    });
    assert.equal((await user.call(a.path + "/search?q=launch")).status, 404);
  }
  const response = (await a.user.call(a.path + "/search?q=launch")).body;
  assert.equal(JSON.stringify(response).includes("private-secret"), false);
  for (const item of response.items)
    assert.deepEqual(Object.keys(item).sort(), [
      "archived",
      "id",
      "kind",
      "status",
      "summary",
      "title",
      "updatedAt",
    ]);
  const detail = (await a.user.call(`${a.path}/assets/${a.asset.id}`)).body;
  assert.equal("objectKey" in detail, false);
  assert.equal("sha256" in detail, false);
});
test("PostgreSQL search matches saved words and tags, handles Unicode, and applies explicit archive/type filters", async () => {
  const w = await setup();
  const find = (q: string) => w.user.call(w.path + "/search?" + q);
  assert.equal((await find("q=orchard")).body.items.length, 3);
  assert.equal(
    (await find("q=" + encodeURIComponent("नमस्ते"))).body.items[0].id,
    w.content.id,
  );
  assert.equal(
    (await find("q=launch&kind=campaign")).body.items[0].id,
    w.campaign.id,
  );
  assert.equal((await find("q=orch")).body.items.length, 0);
  assert.equal(
    (await find("q=" + encodeURIComponent("'; DROP TABLE ContentItem; --")))
      .body.items.length,
    0,
  );
  assert.equal((await find("q=!!!")).body.items.length, 0);
  await db.contentItem.update({
    where: { id: w.content.id },
    data: { status: "ARCHIVED" },
  });
  await db.asset.update({
    where: { id: w.asset.id },
    data: { archivedAt: new Date() },
  });
  assert.equal((await find("q=launch")).body.items.length, 1);
  assert.equal(
    (await find("q=launch&includeArchived=true")).body.items.length,
    3,
  );
  assert.equal(
    (await find("q=launch&kind=asset&includeArchived=true")).body.items[0]
      .archived,
    true,
  );
  for (const query of [
    "q=x",
    "q=launch&skip=1001",
    "q=launch&take=51",
    "q=launch&kind=users",
    "q=launch&includeArchived=yes",
    "q=launch&organizationId=forged",
  ])
    assert.equal((await find(query)).status, 400, query);
  await db.asset.delete({ where: { id: w.asset.id } });
  assert.equal(
    (await w.user.call(w.path + "/assets/" + w.asset.id)).status,
    404,
  );
});
test("search pagination is deterministic and bounded and reflects edits without a stale index", async () => {
  const w = await setup();
  await db.contentItem.createMany({
    data: Array.from({ length: 23 }, (_, i) => ({
      organizationId: w.org.id,
      createdBy: w.user.id,
      title: `Synthetic pagination ${i}`,
      body: "paginatedneedle",
      platform: "LinkedIn",
      format: "Text",
      updatedAt: new Date("2026-01-01"),
    })),
  });
  const path = w.path + "/search?q=paginatedneedle&kind=content";
  const all = (await w.user.call(path + "&take=50")).body.items;
  const seen: string[] = [];
  let skip: number | null = 0;
  while (skip !== null) {
    const r = await w.user.call(path + `&take=7&skip=${skip}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.items.length <= 7);
    seen.push(...r.body.items.map((x: any) => x.id));
    skip = r.body.nextSkip;
  }
  assert.equal(seen.length, 23);
  assert.deepEqual(
    seen,
    all.map((x: any) => x.id),
  );
  assert.equal(new Set(seen).size, 23);
  await db.contentItem.update({
    where: { id: seen[0] },
    data: { title: "Renamed", body: "replacementneedle" },
  });
  assert.equal((await w.user.call(path + "&take=50")).body.items.length, 22);
  assert.equal(
    (await w.user.call(w.path + "/search?q=replacementneedle")).body.items[0]
      .id,
    seen[0],
  );
});
