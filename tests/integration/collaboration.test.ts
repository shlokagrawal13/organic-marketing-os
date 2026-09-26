import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db, actor, draft } from "../support/http";
const users: string[] = [],
  orgs: string[] = [];
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test("invitation email, ownership protection, one-time acceptance, removal and version restore", async () => {
  const org = await db.organization.create({
    data: { name: "Collaboration QA" },
  });
  orgs.push(org.id);
  const root = `/workspaces/${org.id}`;
  const owner = await actor(org.id),
    invited = await actor(null),
    wrong = await actor(null);
  users.push(owner.id, invited.id, wrong.id);
  const email = (await db.user.findUniqueOrThrow({ where: { id: invited.id } }))
    .email;
  assert.equal(
    (await owner.call(root + "/team/invite", "POST", { email, role: "OWNER" }))
      .status,
    400,
  );
  assert.equal(
    (await owner.call(root + `/team/${owner.id}`, "DELETE")).status,
    400,
  );
  assert.equal(
    (await owner.call(root + "/team/invite", "POST", { email, role: "EDITOR" }))
      .status,
    201,
  );
  const team = await owner.call(root + "/team");
  assert.equal(JSON.stringify(team.body).includes("tokenHash"), false);
  const mail = readFileSync(".local/mailbox.ndjson", "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((m) => m.to.includes(email))
    .at(-1);
  const token = mail.body
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .match(/invite=([a-f0-9]{64})/)?.[1];
  assert.ok(token);
  assert.equal(
    (await wrong.call("/organizations/accept-invitation", "POST", { token }))
      .status,
    400,
  );
  const accepted = await Promise.all(
    [1, 2].map(() =>
      invited.call("/organizations/accept-invitation", "POST", { token }),
    ),
  );
  assert.deepEqual(accepted.map((r) => r.status).sort(), [201, 400]);
  assert.equal((await invited.call(root + "/content")).status, 200);
  const created = await invited.call(root + "/content", "POST", draft);
  assert.equal(created.status, 201);
  const id = created.body.id;
  await invited.call(`${root}/content/${id}/review`, "POST", { revision: 1 });
  await invited.call(`${root}/content/${id}/approve`, "POST", {
    revision: 1,
    factsAndRightsReviewed: true,
  });
  assert.equal(
    (
      await invited.call(`${root}/content/${id}`, "PUT", {
        ...draft,
        title: "Changed draft",
        revision: 1,
      })
    ).status,
    200,
  );
  const restored = await invited.call(
    `${root}/content/${id}/restore/1`,
    "POST",
    { revision: 2 },
  );
  assert.equal(restored.status, 201);
  assert.equal(restored.body.title, draft.title);
  assert.equal(restored.body.revision, 3);
  assert.equal(restored.body.status, "DRAFT");
  assert.equal(restored.body.approvedAt, null);
  assert.equal(
    (
      await invited.call(`${root}/content/${id}/restore/1`, "POST", {
        revision: 2,
      })
    ).status,
    409,
  );
  assert.equal(
    (await owner.call(root + `/team/${invited.id}`, "DELETE")).status,
    200,
  );
  assert.equal((await invited.call(`${root}/content/${id}`)).status, 404);
  const ownerEmail = (
    await db.user.findUniqueOrThrow({ where: { id: owner.id } })
  ).email;
  await owner.call(root + "/team/invite", "POST", {
    email: ownerEmail,
    role: "CLIENT",
  });
  const invitation = await db.invitation.findUniqueOrThrow({
    where: {
      organizationId_email: { organizationId: org.id, email: ownerEmail },
    },
  });
  const ownerMail = readFileSync(".local/mailbox.ndjson", "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((m) => m.to.includes(ownerEmail))
    .at(-1);
  const ownerToken = ownerMail.body
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .match(/invite=([a-f0-9]{64})/)?.[1];
  assert.equal(
    (
      await owner.call("/organizations/accept-invitation", "POST", {
        token: ownerToken,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await db.membership.findUniqueOrThrow({
        where: {
          userId_organizationId: { userId: owner.id, organizationId: org.id },
        },
      })
    ).role,
    "OWNER",
  );
  await owner.call(root + "/team/invite", "POST", { email, role: "CLIENT" });
  await db.invitation.updateMany({
    where: { organizationId: org.id, email },
    data: { expiresAt: new Date(0) },
  });
  const expiredMail = readFileSync(".local/mailbox.ndjson", "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((m) => m.to.includes(email))
    .at(-1);
  const expiredToken = expiredMail.body
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .match(/invite=([a-f0-9]{64})/)?.[1];
  assert.equal(
    (
      await invited.call("/organizations/accept-invitation", "POST", {
        token: expiredToken,
      })
    ).status,
    400,
  );
});
