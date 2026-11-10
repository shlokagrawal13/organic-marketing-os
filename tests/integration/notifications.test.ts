import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db, actor, draft } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Inline helper that mirrors createRenderNotification from apps/api/src/notifications.ts
 * without importing NestJS-decorated source (which esbuild cannot parse via tsx).
 */
async function createRenderNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    renderId: string;
    actorId?: string | null;
    status: "SUCCEEDED" | "FAILED" | "CANCELED";
    contentTitle?: string | null;
    error?: string | null;
  },
) {
  const eventKey = `render:${params.renderId}:${params.status}`;
  const isSuccess = params.status === "SUCCEEDED";
  const isCanceled = params.status === "CANCELED";
  const title = isSuccess
    ? "Render complete"
    : isCanceled
      ? "Render canceled"
      : "Render failed";
  const contentSnippet = params.contentTitle
    ? ` for "${params.contentTitle}"`
    : "";
  const body = isSuccess
    ? `Video render${contentSnippet} is ready for review.`
    : isCanceled
      ? `Video render${contentSnippet} was canceled.`
      : params.error
        ? `Video render${contentSnippet} failed: ${params.error}`
        : `Video render${contentSnippet} failed.`;

  return client.notification.upsert({
    where: {
      organizationId_eventKey: {
        organizationId: params.organizationId,
        eventKey,
      },
    },
    create: {
      organizationId: params.organizationId,
      userId: params.actorId ?? undefined,
      type: `RENDER_${params.status}`,
      category: "RENDER",
      title,
      body,
      link: `/workspaces/${params.organizationId}/renders/${params.renderId}`,
      entityType: "RENDER_JOB",
      entityId: params.renderId,
      eventKey,
      data: {
        renderId: params.renderId,
        status: params.status,
        ...(params.error ? { error: params.error } : {}),
      },
    },
    update: {},
  });
}

const orgs: string[] = [];
const users: string[] = [];

after(async () => {
  if (orgs.length) {
    await db.notification.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.renderJob.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.contentItem.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
  }
  if (users.length) {
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
  await db.$disconnect();
});

test("tenant isolation: notifications are strictly isolated between workspaces", async () => {
  await resetFixtureRateBudget();
  const orgA = await db.organization.create({ data: { name: "Tenant A" } });
  const orgB = await db.organization.create({ data: { name: "Tenant B" } });
  orgs.push(orgA.id, orgB.id);

  const ownerA = await actor(orgA.id, "OWNER");
  const ownerB = await actor(orgB.id, "OWNER");
  const outsider = await actor(null);
  users.push(ownerA.id, ownerB.id, outsider.id);

  const notifA = await createRenderNotification(db, {
    organizationId: orgA.id,
    renderId: randomUUID(),
    actorId: ownerA.id,
    status: "SUCCEEDED",
    contentTitle: "Video Alpha",
  });

  const pathA = `/workspaces/${orgA.id}/notifications`;
  const pathB = `/workspaces/${orgB.id}/notifications`;

  // Owner A sees notification in Org A
  const listA = await ownerA.call(pathA);
  assert.equal(listA.status, 200);
  assert.equal(listA.body.total, 1);
  assert.equal(listA.body.items[0].id, notifA.id);

  // Owner B sees empty list in Org B
  const listB = await ownerB.call(pathB);
  assert.equal(listB.status, 200);
  assert.equal(listB.body.total, 0);
  assert.equal(listB.body.items.length, 0);

  // Owner B cannot access Org A notifications endpoint (404)
  assert.equal((await ownerB.call(pathA)).status, 404);
  assert.equal((await ownerB.call(`${pathA}/${notifA.id}`)).status, 404);
  assert.equal((await ownerB.call(`${pathA}/${notifA.id}/read`, "POST")).status, 404);

  // Outsider without membership cannot access Org A notifications
  assert.equal((await outsider.call(pathA)).status, 404);
  assert.equal((await outsider.call(`${pathA}/${notifA.id}`)).status, 404);
});

test("roles: CLIENT role is forbidden; authorized team roles can list notifications", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Roles Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  const admin = await actor(org.id, "ADMIN");
  const editor = await actor(org.id, "EDITOR");
  const creator = await actor(org.id, "CREATOR");
  const analyst = await actor(org.id, "ANALYST");
  const client = await actor(org.id, "CLIENT");
  users.push(owner.id, admin.id, editor.id, creator.id, analyst.id, client.id);

  const notif = await createRenderNotification(db, {
    organizationId: org.id,
    renderId: randomUUID(),
    status: "SUCCEEDED",
    contentTitle: "Shared Render",
  });

  const path = `/workspaces/${org.id}/notifications`;

  // Authorized team roles all get 200 OK
  for (const user of [owner, admin, editor, creator, analyst]) {
    const res = await user.call(path);
    assert.equal(res.status, 200, `Role ${user.id} should be allowed`);
  }

  // CLIENT role is forbidden
  const clientList = await client.call(path);
  assert.equal(clientList.status, 403);

  const clientRead = await client.call(`${path}/${notif.id}/read`, "POST");
  assert.equal(clientRead.status, 403);
});

test("user-level scoping and cross-user acknowledgement authorization", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Scoping Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  const creatorA = await actor(org.id, "CREATOR");
  const creatorB = await actor(org.id, "CREATOR");
  users.push(owner.id, creatorA.id, creatorB.id);

  const notifA = await createRenderNotification(db, {
    organizationId: org.id,
    renderId: randomUUID(),
    actorId: creatorA.id,
    status: "SUCCEEDED",
    contentTitle: "Creator A Video",
  });

  const path = `/workspaces/${org.id}/notifications`;

  // Creator A sees their notification
  const listA = await creatorA.call(path);
  assert.equal(listA.status, 200);
  assert.equal(listA.body.total, 1);
  assert.equal(listA.body.items[0].id, notifA.id);

  // Creator B does NOT see Creator A's user-scoped notification
  const listB = await creatorB.call(path);
  assert.equal(listB.status, 200);
  assert.equal(listB.body.total, 0);

  // Creator B cannot get or acknowledge Creator A's notification (403)
  assert.equal((await creatorB.call(`${path}/${notifA.id}`)).status, 403);
  assert.equal((await creatorB.call(`${path}/${notifA.id}/read`, "POST")).status, 403);

  // Creator A can read and acknowledge their notification
  const readRes = await creatorA.call(`${path}/${notifA.id}/read`, "POST");
  assert.equal(readRes.status, 201); // NestJS POST default 201
  assert.ok(readRes.body.readAt);
  assert.equal(readRes.body.readBy, creatorA.id);

  // Elevated role (Owner) can see all workspace notifications
  const ownerList = await owner.call(path);
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.body.total, 1);
});

test("bounded pagination and filtering for notifications", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Pagination Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  // Seed 12 notifications
  for (let i = 0; i < 12; i++) {
    await createRenderNotification(db, {
      organizationId: org.id,
      renderId: randomUUID(),
      actorId: owner.id,
      status: i % 2 === 0 ? "SUCCEEDED" : "FAILED",
      contentTitle: `Video ${i}`,
    });
  }

  const path = `/workspaces/${org.id}/notifications`;

  // Page 1: take 5, skip 0
  const page1 = await owner.call(`${path}?take=5&skip=0`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.items.length, 5);
  assert.equal(page1.body.total, 12);
  assert.equal(page1.body.unreadCount, 12);

  // Page 2: take 5, skip 5
  const page2 = await owner.call(`${path}?take=5&skip=5`);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.items.length, 5);
  assert.equal(page2.body.total, 12);

  // Page 3: take 5, skip 10
  const page3 = await owner.call(`${path}?take=5&skip=10`);
  assert.equal(page3.status, 200);
  assert.equal(page3.body.items.length, 2);
  assert.equal(page3.body.total, 12);

  // Beyond total: take 5, skip 15
  const page4 = await owner.call(`${path}?take=5&skip=15`);
  assert.equal(page4.status, 200);
  assert.equal(page4.body.items.length, 0);
  assert.equal(page4.body.total, 12);

  // Invalid query bounds rejected with 400
  assert.equal((await owner.call(`${path}?take=0`)).status, 400);
  assert.equal((await owner.call(`${path}?take=101`)).status, 400);
  assert.equal((await owner.call(`${path}?skip=-1`)).status, 400);
});

test("idempotent read acknowledgement, read-all, and concurrent reads", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Ack Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  const notif1 = await createRenderNotification(db, {
    organizationId: org.id,
    renderId: randomUUID(),
    actorId: owner.id,
    status: "SUCCEEDED",
  });
  const notif2 = await createRenderNotification(db, {
    organizationId: org.id,
    renderId: randomUUID(),
    actorId: owner.id,
    status: "FAILED",
  });

  const path = `/workspaces/${org.id}/notifications`;

  // Initially 2 unread
  const initial = await owner.call(path);
  assert.equal(initial.body.unreadCount, 2);

  // Acknowledge first notification
  const ack1 = await owner.call(`${path}/${notif1.id}/read`, "POST");
  assert.ok([200, 201].includes(ack1.status));
  assert.ok(ack1.body.readAt);
  const firstReadAt = ack1.body.readAt;

  // Re-acknowledging is idempotent (same readAt preserved)
  const ack1Again = await owner.call(`${path}/${notif1.id}/read`, "POST");
  assert.ok([200, 201].includes(ack1Again.status));
  assert.equal(ack1Again.body.readAt, firstReadAt);

  // PATCH endpoint also works idempotently
  const patchAck = await owner.call(`${path}/${notif1.id}/read`, "PATCH");
  assert.equal(patchAck.status, 200);
  assert.equal(patchAck.body.readAt, firstReadAt);

  // Concurrent reads on notif2 succeed cleanly
  const raced = await Promise.all([
    owner.call(`${path}/${notif2.id}/read`, "POST"),
    owner.call(`${path}/${notif2.id}/read`, "POST"),
    owner.call(`${path}/${notif2.id}/read`, "PATCH"),
  ]);
  assert.ok(raced.every((r) => [200, 201].includes(r.status)));

  // Read-all endpoint acknowledges remaining unread
  const readAll = await owner.call(`${path}/read-all`, "POST");
  assert.ok([200, 201].includes(readAll.status));

  // Now 0 unread
  const finalState = await owner.call(path);
  assert.equal(finalState.body.unreadCount, 0);
});

test("duplicate events: creating notification twice for the same eventKey is an idempotent no-op", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Dedupe Org" } });
  orgs.push(org.id);

  const renderId = randomUUID();

  // First call creates
  const first = await createRenderNotification(db, {
    organizationId: org.id,
    renderId,
    status: "SUCCEEDED",
    contentTitle: "Dedupe Content",
  });
  assert.ok(first.id);

  // Second call with same eventKey returns the exact same notification
  const second = await createRenderNotification(db, {
    organizationId: org.id,
    renderId,
    status: "SUCCEEDED",
    contentTitle: "Dedupe Content",
  });
  assert.equal(second.id, first.id);

  // Exactly one record exists in DB
  const count = await db.notification.count({
    where: { organizationId: org.id, eventKey: `render:${renderId}:SUCCEEDED` },
  });
  assert.equal(count, 1);
});

test("render cancel terminal event creates durable notification and preserves audit log", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Cancel Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  const content = await db.contentItem.create({
    data: {
      organizationId: org.id,
      title: "Video for Cancel",
      platform: "LinkedIn",
      format: "Video",
      body: "Cancel body",
      createdBy: owner.id,
      revision: 1,
      scenes: [],
    },
  });

  const render = await db.renderJob.create({
    data: {
      organizationId: org.id,
      contentId: content.id,
      contentRevision: 1,
      actorId: owner.id,
      requestKey: randomUUID(),
      requestHash: "hash123",
      snapshot: { scenes: [] },
      options: {},
      totalScenes: 0,
      status: "QUEUED",
    },
  });

  // Cancel the queued render
  const cancelRes = await owner.call(`/workspaces/${org.id}/renders/${render.id}/cancel`, "POST");
  assert.equal(cancelRes.status, 201);

  // Verify render job is CANCELED
  const updatedJob = await db.renderJob.findUniqueOrThrow({ where: { id: render.id } });
  assert.equal(updatedJob.status, "CANCELED");

  // Verify in-app notification was created
  const notifs = await db.notification.findMany({
    where: { organizationId: org.id, entityId: render.id },
  });
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].type, "RENDER_CANCELED");
  assert.equal(notifs[0].category, "RENDER");
  assert.equal(notifs[0].eventKey, `render:${render.id}:CANCELED`);

  // Verify audit log exists
  const audit = await db.auditLog.findFirst({
    where: { organizationId: org.id, action: "render.canceled", entityId: render.id },
  });
  assert.ok(audit);

  // Second cancel attempt fails with 409 Conflict
  const cancelAgain = await owner.call(`/workspaces/${org.id}/renders/${render.id}/cancel`, "POST");
  assert.equal(cancelAgain.status, 409);
});

test("GET /summary returns totalUnread and category counts with tenant isolation", async () => {
  await resetFixtureRateBudget();
  const orgA = await db.organization.create({ data: { name: "Summary Org A" } });
  const orgB = await db.organization.create({ data: { name: "Summary Org B" } });
  orgs.push(orgA.id, orgB.id);

  const ownerA = await actor(orgA.id, "OWNER");
  const ownerB = await actor(orgB.id, "OWNER");
  users.push(ownerA.id, ownerB.id);

  // Org A: 1 unread RENDER
  await db.notification.create({
    data: {
      organizationId: orgA.id,
      type: "RENDER_SUCCEEDED",
      category: "RENDER",
      title: "Render complete",
      body: "Ready",
      eventKey: `render:${randomUUID()}:SUCCEEDED`,
    },
  });

  // Org A: 1 unread BILLING
  await db.notification.create({
    data: {
      organizationId: orgA.id,
      type: "PAYMENT_FAILED",
      category: "BILLING",
      title: "Payment failed",
      body: "Card declined",
      eventKey: `billing:payment_failed:${randomUUID()}`,
    },
  });

  // Org A: 1 read BILLING (readAt populated)
  await db.notification.create({
    data: {
      organizationId: orgA.id,
      type: "CREDITS_LOW",
      category: "BILLING",
      title: "Credits low",
      body: "Balance low",
      eventKey: `billing:credits_low:${randomUUID()}`,
      readAt: new Date(),
      readBy: ownerA.id,
    },
  });

  // Org B: 1 unread RENDER
  await db.notification.create({
    data: {
      organizationId: orgB.id,
      type: "RENDER_SUCCEEDED",
      category: "RENDER",
      title: "Render complete",
      body: "Ready",
      eventKey: `render:${randomUUID()}:SUCCEEDED`,
    },
  });

  // Owner A fetches summary
  const summaryRes = await ownerA.call(`/workspaces/${orgA.id}/notifications/summary`);
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryRes.body.organizationId, orgA.id);
  assert.equal(summaryRes.body.totalUnread, 2);
  assert.equal(summaryRes.body.byCategory.RENDER, 1);
  assert.equal(summaryRes.body.byCategory.BILLING, 1);

  // Owner B cannot access Org A summary
  const crossTenantRes = await ownerB.call(`/workspaces/${orgA.id}/notifications/summary`);
  assert.equal(crossTenantRes.status, 404);
});

test("content review emits a tenant-bound notification for each content revision", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Content lifecycle notifications" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);
  const root = `/workspaces/${org.id}`;

  const created = await owner.call(root + "/content", "POST", {
    ...draft,
    title: "Lifecycle draft",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const contentId = created.body.id as string;

  const firstReview = await owner.call(
    `${root}/content/${contentId}/review`,
    "POST",
    { revision: 1 },
  );
  assert.equal(firstReview.status, 201, JSON.stringify(firstReview.body));
  const first = await db.notification.findMany({
    where: { organizationId: org.id, entityId: contentId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].userId, null);
  assert.equal(first[0].eventKey, `content:${contentId}:revision:1:ready`);
  assert.equal((first[0].data as any).contentRevision, 1);

  const edited = await owner.call(`${root}/content/${contentId}`, "PUT", {
    ...draft,
    title: "Lifecycle draft v2",
    revision: 1,
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  const secondReview = await owner.call(
    `${root}/content/${contentId}/review`,
    "POST",
    { revision: 2 },
  );
  assert.equal(secondReview.status, 201, JSON.stringify(secondReview.body));

  const revisions = await db.notification.findMany({
    where: { organizationId: org.id, entityId: contentId },
    orderBy: { eventKey: "asc" },
  });
  assert.deepEqual(
    revisions.map((row) => row.eventKey),
    [
      `content:${contentId}:revision:1:ready`,
      `content:${contentId}:revision:2:ready`,
    ].sort(),
  );
});
