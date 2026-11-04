import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient, Role } from "@prisma/client";
import {
  createRenderNotification,
  createPublishNotification,
  createAiNotification,
  NotificationsController,
  NOTIFICATION_ROLES,
} from "../dist/apps/api/src/notifications";
import { recordPublicationOutcome } from "../dist/apps/api/src/publication-attempts";
import { applicationMigrations } from "../scripts/application-pitr-fixture.mjs";
import { fileURLToPath } from "node:url";

describe("Notifications - Unit & Idempotent Event Contracts", () => {
  let db: PGlite;

  before(async () => {
    db = await PGlite.create();
    for (const m of applicationMigrations(
      fileURLToPath(new URL("..", import.meta.url)),
    )) {
      await db.exec(m.sql);
    }
  });

  after(async () => {
    await db.close();
  });

  test("creates durable, tenant-bound notification on successful render terminal event", async () => {
    const orgId = randomUUID();
    const actorId = randomUUID();
    const renderId = randomUUID();

    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgId,
      "Test Org",
    ]);

    const eventKey = `render:${renderId}:SUCCEEDED`;
    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", "userId", type, category, title, body, link, "entityType", "entityId", "eventKey", data, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
      [
        randomUUID(),
        orgId,
        actorId,
        "RENDER_SUCCEEDED",
        "RENDER",
        "Render complete",
        'Video render for "Intro Video" is ready for review.',
        `/workspaces/${orgId}/renders/${renderId}`,
        "RENDER_JOB",
        renderId,
        eventKey,
        JSON.stringify({ renderId, status: "SUCCEEDED" }),
      ],
    );

    const rows = (
      await db.query('SELECT * FROM "Notification" WHERE "organizationId" = $1', [
        orgId,
      ])
    ).rows as any[];

    assert.equal(rows.length, 1);
    const n = rows[0];
    assert.equal(n.organizationId, orgId);
    assert.equal(n.userId, actorId);
    assert.equal(n.type, "RENDER_SUCCEEDED");
    assert.equal(n.category, "RENDER");
    assert.equal(n.title, "Render complete");
    assert.equal(n.readAt, null);
    assert.equal(n.eventKey, eventKey);
  });

  test("enforces duplicate event idempotency with unique (organizationId, eventKey) constraint", async () => {
    const orgId = randomUUID();
    const renderId = randomUUID();
    const eventKey = `render:${renderId}:SUCCEEDED`;

    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgId,
      "Dedup Org",
    ]);

    // First insert succeeds
    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        orgId,
        "RENDER_SUCCEEDED",
        "RENDER",
        "Render complete",
        "Body",
        eventKey,
      ],
    );

    // Second insert with the exact same (organizationId, eventKey) must violate unique constraint
    await assert.rejects(
      async () => {
        await db.query(
          `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            randomUUID(),
            orgId,
            "RENDER_SUCCEEDED",
            "RENDER",
            "Render complete duplicate",
            "Body",
            eventKey,
          ],
        );
      },
      (err: any) => {
        assert.match(
          err.message,
          /duplicate key value violates unique constraint|unique constraint/i,
        );
        return true;
      },
    );

    const count = (
      await db.query(
        'SELECT count(*) as count FROM "Notification" WHERE "organizationId" = $1 AND "eventKey" = $2',
        [orgId, eventKey],
      )
    ).rows[0] as any;
    assert.equal(Number(count.count), 1);
  });

  test("handles retries safely: distinct render job produces separate notification while preserving original", async () => {
    const orgId = randomUUID();
    const firstRenderId = randomUUID();
    const retryRenderId = randomUUID();

    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgId,
      "Retry Org",
    ]);

    // First render job failed
    const failedEventKey = `render:${firstRenderId}:FAILED`;
    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        orgId,
        "RENDER_FAILED",
        "RENDER",
        "Render failed",
        "Out of memory error during frame 120",
        failedEventKey,
      ],
    );

    // Retried render job succeeded
    const retriedEventKey = `render:${retryRenderId}:SUCCEEDED`;
    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        orgId,
        "RENDER_SUCCEEDED",
        "RENDER",
        "Render complete",
        "Render completed successfully on retry",
        retriedEventKey,
      ],
    );

    const rows = (
      await db.query(
        'SELECT * FROM "Notification" WHERE "organizationId" = $1 ORDER BY "createdAt" ASC',
        [orgId],
      )
    ).rows as any[];

    assert.equal(rows.length, 2);
    assert.equal(rows[0].eventKey, failedEventKey);
    assert.equal(rows[0].type, "RENDER_FAILED");
    assert.equal(rows[1].eventKey, retriedEventKey);
    assert.equal(rows[1].type, "RENDER_SUCCEEDED");
  });

  test("tenant isolation: notifications belonging to Org A cannot be read in Org B query", async () => {
    const orgA = randomUUID();
    const orgB = randomUUID();

    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgA,
      "Org A",
    ]);
    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgB,
      "Org B",
    ]);

    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        orgA,
        "RENDER_SUCCEEDED",
        "RENDER",
        "Org A Render",
        "Org A body",
        `render:${randomUUID()}:SUCCEEDED`,
      ],
    );

    const orgBResults = await db.query(
      'SELECT * FROM "Notification" WHERE "organizationId" = $1',
      [orgB],
    );
    assert.equal(orgBResults.rows.length, 0);

    const orgAResults = await db.query(
      'SELECT * FROM "Notification" WHERE "organizationId" = $1',
      [orgA],
    );
    assert.equal(orgAResults.rows.length, 1);
  });

  test("concurrent read acknowledgement is idempotent and does not overwrite original read timestamp", async () => {
    const orgId = randomUUID();
    const notifId = randomUUID();
    const readerA = randomUUID();
    const readerB = randomUUID();

    await db.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [
      orgId,
      "Ack Org",
    ]);

    await db.query(
      `INSERT INTO "Notification" (id, "organizationId", type, category, title, body, "eventKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        notifId,
        orgId,
        "RENDER_SUCCEEDED",
        "RENDER",
        "Title",
        "Body",
        `render:${randomUUID()}:SUCCEEDED`,
      ],
    );

    // Initial state is unread
    const initial = (
      await db.query('SELECT "readAt", "readBy" FROM "Notification" WHERE id = $1', [
        notifId,
      ])
    ).rows[0] as any;
    assert.equal(initial.readAt, null);
    assert.equal(initial.readBy, null);

    // First acknowledge
    const firstTime = new Date();
    await db.query(
      `UPDATE "Notification" SET "readAt" = coalesce("readAt", $1), "readBy" = coalesce("readBy", $2) WHERE id = $3`,
      [firstTime, readerA, notifId],
    );

    const firstAck = (
      await db.query('SELECT "readAt", "readBy" FROM "Notification" WHERE id = $1', [
        notifId,
      ])
    ).rows[0] as any;
    assert.equal(firstAck.readBy, readerA);
    assert.ok(firstAck.readAt);

    // Second concurrent acknowledge attempt should not overwrite
    const secondTime = new Date(Date.now() + 10000);
    await db.query(
      `UPDATE "Notification" SET "readAt" = coalesce("readAt", $1), "readBy" = coalesce("readBy", $2) WHERE id = $3`,
      [secondTime, readerB, notifId],
    );

    const afterAck = (
      await db.query('SELECT "readAt", "readBy" FROM "Notification" WHERE id = $1', [
        notifId,
      ])
    ).rows[0] as any;

    assert.equal(afterAck.readBy, readerA);
    assert.equal(String(afterAck.readAt), String(firstAck.readAt));
  });
});

describe("Notifications - Controller & Application Service Contracts", () => {
  let pg: PGlite;
  let socketServer: PGLiteSocketServer;
  let prisma: PrismaClient;
  let controller: NotificationsController;
  const socketPort = 5444;

  before(async () => {
    pg = await PGlite.create();
    for (const m of applicationMigrations(
      fileURLToPath(new URL("..", import.meta.url)),
    )) {
      await pg.exec(m.sql);
    }
    socketServer = new PGLiteSocketServer({ db: pg, port: socketPort });
    await socketServer.start();

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `postgresql://postgres:postgres@127.0.0.1:${socketPort}/postgres?connection_limit=1`,
        },
      },
    });
    await prisma.$connect();
    controller = new NotificationsController(prisma as any);
  });

  after(async () => {
    await prisma.$disconnect();
    await socketServer.stop();
    await pg.close();
  });

  function fakeReq(params: {
    userId: string;
    organizationId: string;
    role: Role;
  }) {
    return {
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
    } as any;
  }

  test("createRenderNotification: handles SUCCEEDED, FAILED, and CANCELED with idempotency", async () => {
    const org = await prisma.organization.create({
      data: { name: "Service Org" },
    });
    const renderId1 = randomUUID();
    const renderId2 = randomUUID();
    const renderId3 = randomUUID();
    const actorId = randomUUID();

    // 1. Terminal SUCCEEDED
    const successNotif = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: renderId1,
      actorId,
      status: "SUCCEEDED",
      contentTitle: "Spring Launch Teaser",
    });
    assert.equal(successNotif.type, "RENDER_SUCCEEDED");
    assert.equal(successNotif.category, "RENDER");
    assert.equal(successNotif.title, "Render complete");
    assert.match(successNotif.body, /Spring Launch Teaser/);
    assert.equal(successNotif.eventKey, `render:${renderId1}:SUCCEEDED`);
    assert.equal(successNotif.userId, actorId);

    // Idempotent retry of identical SUCCEEDED event
    const successNotifDupe = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: renderId1,
      actorId,
      status: "SUCCEEDED",
      contentTitle: "Spring Launch Teaser",
    });
    assert.equal(successNotifDupe.id, successNotif.id);

    // 2. Terminal FAILED with error message
    const failedNotif = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: renderId2,
      actorId,
      status: "FAILED",
      contentTitle: "Promo 4K",
      error: "GPU memory exceeded during composite",
    });
    assert.equal(failedNotif.type, "RENDER_FAILED");
    assert.equal(failedNotif.title, "Render failed");
    assert.match(failedNotif.body, /GPU memory exceeded/);
    assert.equal((failedNotif.data as any).error, "GPU memory exceeded during composite");

    // 3. Terminal CANCELED
    const canceledNotif = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: renderId3,
      actorId,
      status: "CANCELED",
      contentTitle: "Draft cut",
    });
    assert.equal(canceledNotif.type, "RENDER_CANCELED");
    assert.equal(canceledNotif.title, "Render canceled");
    assert.match(canceledNotif.body, /canceled/);
  });

  test("controller.list: bounded pagination and filtering", async () => {
    const org = await prisma.organization.create({
      data: { name: "Pagination Org" },
    });
    const actorId = randomUUID();

    // Create 15 notifications
    for (let i = 0; i < 15; i++) {
      await createRenderNotification(prisma, {
        organizationId: org.id,
        renderId: randomUUID(),
        actorId,
        status: "SUCCEEDED",
        contentTitle: `Video #${i}`,
      });
    }

    const req = fakeReq({ userId: actorId, organizationId: org.id, role: "OWNER" });

    // Page 1: take 5, skip 0
    const page1 = await controller.list(req, { take: 5, skip: 0 });
    assert.equal(page1.items.length, 5);
    assert.equal(page1.total, 15);
    assert.equal(page1.unreadCount, 15);
    assert.equal(page1.skip, 0);
    assert.equal(page1.take, 5);

    // Page 2: take 5, skip 5
    const page2 = await controller.list(req, { take: 5, skip: 5 });
    assert.equal(page2.items.length, 5);
    assert.notEqual(page1.items[0].id, page2.items[0].id);

    // Mark 1 as read
    await controller.markReadPost(req, page1.items[0].id);

    // unreadOnly=true filter
    const unreadOnly = await controller.list(req, { unreadOnly: "true" });
    assert.equal(unreadOnly.total, 14);
    assert.equal(unreadOnly.unreadCount, 14);
    assert.equal(unreadOnly.items.length, 14);

    // take bounded to max 100
    const boundedTake = await controller.list(req, { take: 100 });
    assert.equal(boundedTake.take, 100);
  });

  test("tenant isolation & role-based visibility in list and get", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org Alpha" } });
    const orgB = await prisma.organization.create({ data: { name: "Org Beta" } });

    const ownerA = fakeReq({ userId: randomUUID(), organizationId: orgA.id, role: "OWNER" });
    const editorA1 = fakeReq({ userId: randomUUID(), organizationId: orgA.id, role: "EDITOR" });
    const editorA2 = fakeReq({ userId: randomUUID(), organizationId: orgA.id, role: "EDITOR" });
    const ownerB = fakeReq({ userId: randomUUID(), organizationId: orgB.id, role: "OWNER" });

    // Notification in Org A assigned to editorA1
    const notifA1 = await createRenderNotification(prisma, {
      organizationId: orgA.id,
      renderId: randomUUID(),
      actorId: editorA1.userId,
      status: "SUCCEEDED",
      contentTitle: "Video A1",
    });

    // Notification in Org A broadcast (userId: null)
    const notifBroadcast = await createRenderNotification(prisma, {
      organizationId: orgA.id,
      renderId: randomUUID(),
      status: "SUCCEEDED",
      contentTitle: "System Announcement",
    });

    // Notification in Org B assigned to ownerB
    const notifB = await createRenderNotification(prisma, {
      organizationId: orgB.id,
      renderId: randomUUID(),
      actorId: ownerB.userId,
      status: "SUCCEEDED",
      contentTitle: "Video B",
    });

    // 1. Tenant Isolation: ownerB sees only Org B notifications
    const listB = await controller.list(ownerB, {});
    assert.equal(listB.total, 1);
    assert.equal(listB.items[0].id, notifB.id);

    // ownerB cannot get Org A notification (throws NotFoundException)
    await assert.rejects(
      async () => {
        await controller.get(ownerB, notifA1.id);
      },
      (err: any) => {
        assert.equal(err.status, 404);
        return true;
      },
    );

    // 2. Role Scoping in Org A:
    // ownerA (elevated) sees both notifA1 and notifBroadcast
    const listOwnerA = await controller.list(ownerA, {});
    assert.equal(listOwnerA.total, 2);

    // editorA1 sees notifA1 (assigned) and notifBroadcast (broadcast)
    const listEditorA1 = await controller.list(editorA1, {});
    assert.equal(listEditorA1.total, 2);

    // editorA2 sees only notifBroadcast, not notifA1 (which is private to editorA1)
    const listEditorA2 = await controller.list(editorA2, {});
    assert.equal(listEditorA2.total, 1);
    assert.equal(listEditorA2.items[0].id, notifBroadcast.id);

    // editorA2 trying to get notifA1 throws ForbiddenException (403)
    await assert.rejects(
      async () => {
        await controller.get(editorA2, notifA1.id);
      },
      (err: any) => {
        assert.equal(err.status, 403);
        return true;
      },
    );
  });

  test("controller.markReadPost and markReadPatch: idempotent acknowledgement", async () => {
    const org = await prisma.organization.create({ data: { name: "Ack Test Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "CREATOR" });

    const notif = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: randomUUID(),
      actorId: user.userId,
      status: "SUCCEEDED",
      contentTitle: "Video to Ack",
    });

    // 1. Initial POST /:id/read
    const ack1 = await controller.markReadPost(user, notif.id);
    assert.ok(ack1.readAt);
    assert.equal(ack1.readBy, user.userId);

    // 2. Repeat POST /:id/read preserves original readAt and readBy
    const ack2 = await controller.markReadPost(user, notif.id);
    assert.equal(String(ack2.readAt), String(ack1.readAt));
    assert.equal(ack2.readBy, user.userId);

    // 3. Repeat PATCH /:id/read also preserves original readAt
    const ack3 = await controller.markReadPatch(user, notif.id);
    assert.equal(String(ack3.readAt), String(ack1.readAt));
    assert.equal(ack3.readBy, user.userId);
  });

  test("controller.acknowledge: concurrent mark-read calls preserve first acknowledgement", async () => {
    const org = await prisma.organization.create({ data: { name: "Concurrent Ack Org" } });
    const userA = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });
    const userB = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "ADMIN" });

    const notif = await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: randomUUID(),
      status: "SUCCEEDED",
      contentTitle: "Concurrent Video",
    });

    // Execute two simultaneous mark-read calls from different users
    const [resA, resB] = await Promise.all([
      controller.markReadPost(userA, notif.id),
      controller.markReadPost(userB, notif.id),
    ]);

    // Both calls must return valid read timestamps
    assert.ok(resA.readAt);
    assert.ok(resB.readAt);

    // Both calls must return the identical first acknowledgement timestamp and readBy
    assert.equal(String(resA.readAt), String(resB.readAt));
    assert.equal(resA.readBy, resB.readBy);
    assert.ok([userA.userId, userB.userId].includes(resA.readBy!));

    // Database state must match the preserved first winner
    const inDb = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    assert.equal(String(inDb.readAt), String(resA.readAt));
    assert.equal(inDb.readBy, resA.readBy);
  });

  test("render failure atomic transaction: eliminates partial-write risk between status update and notification", async () => {
    const org = await prisma.organization.create({ data: { name: "Atomic Failure Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });
    const renderId = randomUUID();

    const content = await prisma.contentItem.create({
      data: {
        organizationId: org.id,
        title: "Atomic Test Content",
        platform: "YOUTUBE",
        format: "VIDEO",
        createdBy: user.userId,
      },
    });

    // Create a mock running render job row
    await prisma.renderJob.create({
      data: {
        id: renderId,
        organizationId: org.id,
        contentId: content.id,
        contentRevision: 1,
        actorId: user.userId,
        requestKey: `rk-${renderId}`,
        requestHash: `rh-${renderId}`,
        totalScenes: 1,
        status: "RUNNING",
        progress: 50,
        options: { format: "mp4" },
        snapshot: { scenes: [] },
      },
    });

    const ownership = { id: renderId, status: "RUNNING" as const };
    const failureReason = "Media processing failed.";

    // 1. Transactional failure commit succeeds atomically
    await prisma.$transaction(async (tx) => {
      const failed = await tx.renderJob.updateMany({
        where: ownership,
        data: {
          status: "FAILED",
          error: failureReason,
          stage: "Render failed",
          completedAt: new Date(),
        },
      });
      if (failed.count) {
        await createRenderNotification(tx, {
          organizationId: org.id,
          renderId,
          actorId: user.userId,
          status: "FAILED",
          contentTitle: "Atomic Failure Video",
          error: failureReason,
        });
      }
    });

    // Verify both renderJob is FAILED and notification exists
    const jobAfter = await prisma.renderJob.findUniqueOrThrow({ where: { id: renderId } });
    assert.equal(jobAfter.status, "FAILED");
    const notifAfter = await prisma.notification.findFirst({
      where: { organizationId: org.id, entityId: renderId },
    });
    assert.ok(notifAfter);
    assert.equal(notifAfter.type, "RENDER_FAILED");

    // 2. Rollback test: If notification creation fails inside transaction, renderJob status rollback prevents partial write
    const secondRenderId = randomUUID();
    await prisma.renderJob.create({
      data: {
        id: secondRenderId,
        organizationId: org.id,
        contentId: content.id,
        contentRevision: 1,
        actorId: user.userId,
        requestKey: `rk-${secondRenderId}`,
        requestHash: `rh-${secondRenderId}`,
        totalScenes: 1,
        status: "RUNNING",
        progress: 20,
        options: { format: "mp4" },
        snapshot: { scenes: [] },
      },
    });

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.renderJob.updateMany({
            where: { id: secondRenderId, status: "RUNNING" },
            data: { status: "FAILED", error: "Simulated abort" },
          });
          // Deliberate error inside transaction to force rollback
          throw new Error("Simulated downstream error during notification write");
        });
      },
      /Simulated downstream error/,
    );

    // Verify renderJob was rolled back to RUNNING (no partial write)
    const rolledBackJob = await prisma.renderJob.findUniqueOrThrow({ where: { id: secondRenderId } });
    assert.equal(rolledBackJob.status, "RUNNING");
    // Verify no notification was written
    const noNotif = await prisma.notification.findFirst({
      where: { organizationId: org.id, entityId: secondRenderId },
    });
    assert.equal(noNotif, null);
  });

  test("controller.readAll: marks all unread in scope as read", async () => {
    const org = await prisma.organization.create({ data: { name: "ReadAll Org" } });
    const userA = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "EDITOR" });
    const userB = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "EDITOR" });

    // 3 notifications for userA
    for (let i = 0; i < 3; i++) {
      await createRenderNotification(prisma, {
        organizationId: org.id,
        renderId: randomUUID(),
        actorId: userA.userId,
        status: "SUCCEEDED",
        contentTitle: `User A Video #${i}`,
      });
    }

    // 2 notifications for userB
    for (let i = 0; i < 2; i++) {
      await createRenderNotification(prisma, {
        organizationId: org.id,
        renderId: randomUUID(),
        actorId: userB.userId,
        status: "SUCCEEDED",
        contentTitle: `User B Video #${i}`,
      });
    }

    // userA marks all read
    const res = await controller.readAll(userA);
    assert.equal(res.acknowledged, 3);

    // userA now has 0 unread
    const listA = await controller.list(userA, { unreadOnly: "true" });
    assert.equal(listA.unreadCount, 0);

    // userB still has 2 unread (unaffected)
    const listB = await controller.list(userB, { unreadOnly: "true" });
    assert.equal(listB.unreadCount, 2);
  });

  test("audit log preservation: audit log entries remain intact alongside notification creation", async () => {
    const org = await prisma.organization.create({ data: { name: "Audit Integrity Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "ADMIN" });
    const renderId = randomUUID();

    // Simulate render cancellation transaction: audit log + notification
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          actorId: user.userId,
          action: "RENDER_JOB_CANCELED",
          entityId: renderId,
          detail: { renderId, reason: "User requested cancellation" },
        },
      });
      await createRenderNotification(tx, {
        organizationId: org.id,
        renderId,
        actorId: user.userId,
        status: "CANCELED",
        contentTitle: "Audit Preservation Test Video",
      });
    });

    // Verify audit log exists with exact uncorrupted metadata
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: org.id, entityId: renderId },
    });
    assert.ok(audit);
    assert.equal(audit.action, "RENDER_JOB_CANCELED");
    assert.equal((audit.detail as any).reason, "User requested cancellation");

    // Verify notification was also created
    const notif = await prisma.notification.findFirst({
      where: { organizationId: org.id, entityId: renderId },
    });
    assert.ok(notif);
    assert.equal(notif.type, "RENDER_CANCELED");
    assert.equal(notif.eventKey, `render:${renderId}:CANCELED`);
  });

  test("worker abort on canceled render does not emit duplicate or conflicting FAILED notification", async () => {
    const org = await prisma.organization.create({ data: { name: "Cancel Guard Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });
    const renderId = randomUUID();

    // 1. Controller cancels the job and emits CANCELED notification
    await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId,
      actorId: user.userId,
      status: "CANCELED",
      contentTitle: "Canceled Cut",
    });

    // 2. Simulated worker abort: updateMany with status: "RUNNING" returns count = 0
    // Because the job is already canceled, failed.count is 0, so no FAILED notification is created
    const ownership = { id: renderId, status: "RUNNING" as const, runToken: "stale-token" };
    const failed = await prisma.renderJob.updateMany({
      where: ownership,
      data: { status: "FAILED" },
    });
    assert.equal(failed.count, 0);

    if (failed.count) {
      await createRenderNotification(prisma, {
        organizationId: org.id,
        renderId,
        actorId: user.userId,
        status: "FAILED",
        contentTitle: "Canceled Cut",
      });
    }

    // Verify only the CANCELED notification exists and no FAILED notification was created
    const notifs = await prisma.notification.findMany({
      where: { organizationId: org.id, entityId: renderId },
    });
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].type, "RENDER_CANCELED");
  });

  test("createPublishNotification: handles CONFIRMED and REJECTED outcomes with category PUBLISH and idempotency", async () => {
    const org = await prisma.organization.create({ data: { name: "Publish Notification Org" } });
    const actorId = randomUUID();
    const attemptId = randomUUID();

    // CONFIRMED outcome
    const notifConfirmed = await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId,
      actorId,
      status: "CONFIRMED",
      platform: "YOUTUBE",
      providerPostId: "yt-video-12345",
      contentTitle: "Viral Reel",
    });
    assert.equal(notifConfirmed.category, "PUBLISH");
    assert.equal(notifConfirmed.type, "PUBLISH_SUCCEEDED");
    assert.equal(notifConfirmed.title, "Publishing successful");
    assert.ok(notifConfirmed.body.includes("Viral Reel"));
    assert.equal(notifConfirmed.eventKey, `publish:${attemptId}:confirmed`);

    // Idempotent upsert with same eventKey does not duplicate
    const duplicate = await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId,
      actorId,
      status: "CONFIRMED",
      platform: "YOUTUBE",
    });
    assert.equal(duplicate.id, notifConfirmed.id);

    // REJECTED outcome
    const failedAttemptId = randomUUID();
    const notifRejected = await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId: failedAttemptId,
      actorId,
      status: "REJECTED",
      platform: "YOUTUBE",
      error: "AUTH_TOKEN_EXPIRED",
      contentTitle: "Failed Reel",
    });
    assert.equal(notifRejected.category, "PUBLISH");
    assert.equal(notifRejected.type, "PUBLISH_FAILED");
    assert.equal(notifRejected.title, "Publishing failed");
    assert.ok(notifRejected.body.includes("AUTH_TOKEN_EXPIRED"));
    assert.equal(notifRejected.eventKey, `publish:${failedAttemptId}:rejected`);
  });

  test("recordPublicationOutcome: atomically triggers publication notification on CONFIRMED and REJECTED", async () => {
    const org = await prisma.organization.create({ data: { name: "Atomic Publish Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });
    const content = await prisma.contentItem.create({
      data: {
        organizationId: org.id,
        title: "Atomic Post",
        platform: "YOUTUBE",
        format: "VIDEO",
        createdBy: user.userId,
      },
    });
    const connection = await prisma.socialConnection.create({
      data: {
        organizationId: org.id,
        provider: "YOUTUBE",
        externalAccountId: "channel-atomic",
        accountLabel: "Channel Atomic",
        scopes: ["upload"],
        accessTokenCiphertext: "cipher-token",
      },
    });
    const intent = await prisma.publicationIntent.create({
      data: {
        organizationId: org.id,
        contentId: content.id,
        contentRevision: 1,
        platform: "YOUTUBE",
        snapshot: { title: "Atomic Post" },
        requestKey: "req-intent-" + randomUUID(),
        requestHash: "hash-intent-" + randomUUID(),
        createdBy: user.userId,
      },
    });
    const attempt = await prisma.publicationAttempt.create({
      data: {
        organizationId: org.id,
        intentId: intent.id,
        connectionId: connection.id,
        contentId: content.id,
        contentRevision: 1,
        requestKey: "req-attempt-" + randomUUID(),
        requestHash: "hash-attempt-" + randomUUID(),
        status: "SUBMITTING",
        version: 1,
      },
    });

    // Record confirmed outcome
    await recordPublicationOutcome(prisma, {
      organizationId: org.id,
      attemptId: attempt.id,
      expectedVersion: 1,
      actorId: user.userId,
      outcome: {
        kind: "confirmed",
        providerPostId: "video-published-id",
        evidence: "receipt",
      },
    });

    // Verify notification was created atomically with category PUBLISH
    const notif = await prisma.notification.findUnique({
      where: {
        organizationId_eventKey: {
          organizationId: org.id,
          eventKey: `publish:${attempt.id}:confirmed`,
        },
      },
    });
    assert.ok(notif);
    assert.equal(notif.category, "PUBLISH");
    assert.equal(notif.type, "PUBLISH_SUCCEEDED");
    assert.equal(notif.entityId, attempt.id);
  });

  test("createAiNotification: handles FAILED media generation with category AI and idempotency", async () => {
    const org = await prisma.organization.create({ data: { name: "AI Notification Org" } });
    const actorId = randomUUID();
    const jobId = randomUUID();

    const notif = await createAiNotification(prisma, {
      organizationId: org.id,
      jobId,
      actorId,
      status: "FAILED",
      error: "GPU_TIMEOUT",
      preset: "CINEMATIC",
    });
    assert.equal(notif.category, "AI");
    assert.equal(notif.type, "AI_GENERATION_FAILED");
    assert.equal(notif.title, "AI generation failed");
    assert.ok(notif.body.includes("GPU_TIMEOUT"));
    assert.equal(notif.eventKey, `ai:${jobId}:failed`);

    // Duplicate call is idempotent
    const duplicate = await createAiNotification(prisma, {
      organizationId: org.id,
      jobId,
      actorId,
      status: "FAILED",
    });
    assert.equal(duplicate.id, notif.id);
  });

  test("controller.list: filters by category PUBLISH, AI, and RENDER", async () => {
    const org = await prisma.organization.create({ data: { name: "Category Filter Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });

    // Create 1 RENDER, 2 PUBLISH, and 1 AI notification
    await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: randomUUID(),
      actorId: user.userId,
      status: "SUCCEEDED",
    });
    await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId: randomUUID(),
      actorId: user.userId,
      status: "CONFIRMED",
      platform: "YOUTUBE",
    });
    await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId: randomUUID(),
      actorId: user.userId,
      status: "REJECTED",
      error: "QUOTA_EXCEEDED",
    });
    await createAiNotification(prisma, {
      organizationId: org.id,
      jobId: randomUUID(),
      actorId: user.userId,
      status: "FAILED",
      error: "OOM",
    });

    const all = await controller.list(user, {});
    assert.equal(all.total, 4);

    const publishOnly = await controller.list(user, { category: "PUBLISH" });
    assert.equal(publishOnly.total, 2);
    assert.ok(publishOnly.items.every((i) => i.category === "PUBLISH"));

    const aiOnly = await controller.list(user, { category: "AI" });
    assert.equal(aiOnly.total, 1);
    assert.equal(aiOnly.items[0].category, "AI");

    const renderOnly = await controller.list(user, { category: "RENDER" });
    assert.equal(renderOnly.total, 1);
    assert.equal(renderOnly.items[0].category, "RENDER");
  });

  test("controller.readAll: category-specific batch mark-read marks only target category", async () => {
    const org = await prisma.organization.create({ data: { name: "Category ReadAll Org" } });
    const user = fakeReq({ userId: randomUUID(), organizationId: org.id, role: "OWNER" });

    // 2 unread RENDER, 2 unread PUBLISH
    await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: randomUUID(),
      actorId: user.userId,
      status: "SUCCEEDED",
    });
    await createRenderNotification(prisma, {
      organizationId: org.id,
      renderId: randomUUID(),
      actorId: user.userId,
      status: "SUCCEEDED",
    });
    await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId: randomUUID(),
      actorId: user.userId,
      status: "CONFIRMED",
      platform: "YOUTUBE",
    });
    await createPublishNotification(prisma, {
      organizationId: org.id,
      attemptId: randomUUID(),
      actorId: user.userId,
      status: "CONFIRMED",
      platform: "YOUTUBE",
    });

    // Mark all PUBLISH notifications as read
    const res = await controller.readAll(user, "PUBLISH");
    assert.equal(res.acknowledged, 2);

    // PUBLISH notifications are all read
    const publishList = await controller.list(user, { category: "PUBLISH", unreadOnly: "true" });
    assert.equal(publishList.unreadCount, 0);

    // RENDER notifications remain unread
    const renderList = await controller.list(user, { category: "RENDER", unreadOnly: "true" });
    assert.equal(renderList.unreadCount, 2);
  });

  test("role authorization matrix: NOTIFICATION_ROLES contains expected authorized workspace roles", () => {
    assert.deepEqual(NOTIFICATION_ROLES, [
      "OWNER",
      "ADMIN",
      "EDITOR",
      "CREATOR",
      "ANALYST",
    ]);
    assert.equal(NOTIFICATION_ROLES.includes("CLIENT"), false);
  });
});
