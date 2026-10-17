import { workspaceYoutubeReviewCurrent } from "./workspace-youtube-policy";
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { digest } from "../../../packages/core/security";
import { ObjectStore } from "../../../packages/core/object-store";
import { youtubePolicyFingerprint, youtubePolicyMaintenanceCurrent } from "../../../packages/core/youtube-policy";
import { activeConnection, currentApproval } from "./publication-attempts";
import {
  claimEvidenceChangedCode,
  PublicationClaimReviewChangedException,
} from "./claim-reviews";
import { dispatchReviewedYoutubeVideo } from "./youtube-dispatch";
import { evaluateScheduleGuidance } from "./posting-guidance";

const maxFutureMs = 24 * 60 * 60 * 1000;
const minFutureMs = 60 * 1000;
const claimTimeoutMs = 5 * 60 * 1000;
type Tx = Prisma.TransactionClient;

export function scheduledDispatchEnabled() {
  return process.env.YOUTUBE_SCHEDULED_DISPATCH_ENABLED === "true" &&
    process.env.YOUTUBE_LIVE_DISPATCH_ENABLED === "true" &&
    youtubePolicyMaintenanceCurrent(process.env);
}

export function scheduleView(row: {
  id: string; intentId: string; connectionId: string; dueAt: Date;
  status: string; outcomeCode: string | null; attemptId: string | null;
  createdAt: Date; completedAt: Date | null;
}) {
  return { id: row.id, intentId: row.intentId, connectionId: row.connectionId,
    dueAt: row.dueAt, status: row.status, outcomeCode: row.outcomeCode,
    attemptId: row.attemptId, createdAt: row.createdAt,
    completedAt: row.completedAt };
}

async function currentSchedulerActor(tx: Tx, organizationId: string, actorId: string) {
  const member = await tx.membership.findUnique({ where: {
    userId_organizationId: { userId: actorId, organizationId },
  } });
  if (!member || !["OWNER", "ADMIN"].includes(member.role))
    throw new ConflictException("A current workspace owner or admin is required.");
}

async function candidate(tx: Tx, input: { organizationId: string; actorId: string;
  intentId: string; connectionId: string; dueAt: Date }) {
  if (!Number.isFinite(input.dueAt.getTime()) ||
      input.dueAt.getTime() < Date.now() + minFutureMs ||
      input.dueAt.getTime() > Date.now() + maxFutureMs)
    throw new BadRequestException("Choose a time from one minute to 24 hours in the future.");
  await currentSchedulerActor(tx, input.organizationId, input.actorId);
  const intent = await currentApproval(
    tx,
    input.organizationId,
    input.intentId,
    input.dueAt,
  );
  const connection = await tx.socialConnection.findFirst({ where: {
    id: input.connectionId, organizationId: input.organizationId,
  } });
  if (!connection) throw new NotFoundException("Social connection not found.");
  activeConnection(connection, input.organizationId);
  if (!connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() <= input.dueAt.getTime() + minFutureMs)
    throw new ConflictException("Reconnect the channel closer to the chosen time; the current access token expires first.");
  const review = await tx.publicationPolicyReview.findUnique({ where: { intentId: intent.id } });
  if (!review || review.organizationId !== input.organizationId ||
      review.connectionId !== connection.id ||
      review.contentRevision !== intent.contentRevision ||
      !(await workspaceYoutubeReviewCurrent(tx, input.organizationId, review)) ||
      review.expiresAt <= input.dueAt ||
      review.snapshotHash !== youtubePolicyFingerprint({
        intentId: intent.id, connectionId: connection.id,
        contentRevision: intent.contentRevision, renderId: intent.renderId,
        metadata: review.metadata, policyVersion: review.policyVersion,
      }))
    throw new ConflictException("A reviewed policy snapshot must remain current through the scheduled time.");
  return evaluateScheduleGuidance(tx, { organizationId: input.organizationId,
    connectionId: connection.id, intentId: intent.id, dueAt: input.dueAt,
    metadata: review.metadata });
}

export async function previewPublicationScheduleGuidance(db: PrismaClient, input: {
  organizationId: string; actorId: string; intentId: string;
  connectionId: string; dueAt: Date;
}) {
  if (!scheduledDispatchEnabled())
    throw new ServiceUnavailableException("Scheduled YouTube dispatch is not available.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${input.organizationId} FOR UPDATE`;
    return candidate(tx, input);
  });
}

export async function createPublicationSchedule(db: PrismaClient, input: {
  organizationId: string; actorId: string; intentId: string;
  connectionId: string; requestKey: string; dueAt: Date;
  guidanceFingerprint: string; guidanceAcknowledged: boolean;
}) {
  if (!scheduledDispatchEnabled())
    throw new ServiceUnavailableException("Scheduled YouTube dispatch requires enabled deployment and current platform policy review.");
  if (!Number.isFinite(input.dueAt.getTime()))
    throw new BadRequestException("Choose a valid scheduled time.");
  const requestHash = digest(JSON.stringify({ intentId: input.intentId,
    connectionId: input.connectionId, dueAt: input.dueAt.toISOString() }));
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${input.organizationId} FOR UPDATE`;
    await currentSchedulerActor(tx, input.organizationId, input.actorId);
    const replay = await tx.publicationSchedule.findUnique({ where: {
      organizationId_requestKey: { organizationId: input.organizationId, requestKey: input.requestKey },
    } });
    if (replay) {
      const same = replay.intentId === input.intentId &&
        replay.connectionId === input.connectionId && replay.dueAt.getTime() === input.dueAt.getTime();
      if (!same) throw new ConflictException("Schedule key belongs to different input.");
      return scheduleView(replay);
    }
    const guidance = await candidate(tx, input);
    if (!input.guidanceAcknowledged ||
        input.guidanceFingerprint !== guidance.fingerprint)
      throw new ConflictException("Posting guidance changed. Review and acknowledge the current warnings before scheduling.");
    if (await tx.publicationAttempt.findUnique({ where: { intentId: input.intentId } }) ||
        await tx.publicationSchedule.findUnique({ where: { intentId: input.intentId } }))
      throw new ConflictException("This preparation already has an attempt or schedule.");
    const created = await tx.publicationSchedule.create({ data: {
      organizationId: input.organizationId, actorId: input.actorId,
      intentId: input.intentId, connectionId: input.connectionId,
      requestKey: input.requestKey, dueAt: input.dueAt,
      guidanceFingerprint: guidance.fingerprint,
    } });
    await tx.auditLog.create({ data: { organizationId: input.organizationId,
      actorId: input.actorId, action: "publication.scheduled", entityId: created.id,
      detail: { intentId: input.intentId, connectionId: input.connectionId,
        dueAt: input.dueAt.toISOString(), requestHash,
        guidanceWarningCodes: guidance.warnings.map((warning) => warning.code) } } });
    return scheduleView(created);
  });
}

export async function cancelPublicationSchedule(db: PrismaClient, input: {
  organizationId: string; actorId: string; intentId: string;
}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${input.organizationId} FOR UPDATE`;
    const row = await tx.publicationSchedule.findFirst({ where: {
      organizationId: input.organizationId, intentId: input.intentId,
    } });
    if (!row) throw new NotFoundException("Schedule not found.");
    const member = await tx.membership.findUnique({ where: {
      userId_organizationId: { userId: input.actorId, organizationId: input.organizationId },
    } });
    if (!member || !["OWNER", "ADMIN"].includes(member.role))
      throw new ConflictException("A current workspace owner or admin is required.");
    const changed = await tx.publicationSchedule.updateMany({ where: {
      id: row.id, organizationId: input.organizationId, status: "SCHEDULED",
    }, data: { status: "CANCELED", completedAt: new Date(), outcomeCode: "USER_CANCELED" } });
    if (!changed.count) throw new ConflictException("The schedule was already claimed or closed.");
    await tx.auditLog.create({ data: { organizationId: input.organizationId,
      actorId: input.actorId, action: "publication.schedule_canceled", entityId: row.id } });
    return scheduleView(await tx.publicationSchedule.findUniqueOrThrow({ where: { id: row.id } }));
  });
}

// A claim is durable before any provider request. Crashed claims become review-only;
// no automatic retry can send the same video a second time.
export async function runDuePublicationSchedules(db: PrismaClient, store: ObjectStore,
  providerRequest: typeof fetch = fetch, now = new Date()) {
  const stale = await db.publicationSchedule.findMany({ where: {
    status: "CLAIMED", claimedAt: { lt: new Date(now.getTime() - claimTimeoutMs) },
  }, take: 20, orderBy: { claimedAt: "asc" } });
  for (const item of stale) await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${item.organizationId} FOR UPDATE`;
    const changed = await tx.publicationSchedule.updateMany({ where: { id: item.id, status: "CLAIMED",
      claimedAt: { lt: new Date(now.getTime() - claimTimeoutMs) } },
      data: { status: "NEEDS_REVIEW", completedAt: now, outcomeCode: "CLAIM_INTERRUPTED" } });
    if (changed.count) await tx.auditLog.create({ data: { organizationId: item.organizationId,
      actorId: item.actorId, action: "publication.schedule_needs_review",
      entityId: item.id, detail: { reason: "CLAIM_INTERRUPTED" } } });
  });
  if (!scheduledDispatchEnabled() || !store.configured) return 0;
  const due = await db.publicationSchedule.findMany({ where: {
    status: "SCHEDULED", dueAt: { lte: now },
  }, orderBy: { dueAt: "asc" }, take: 10 });
  let claimedCount = 0;
  for (const item of due) {
    const claimed = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${item.organizationId} FOR UPDATE`;
      const row = await tx.publicationSchedule.findFirst({ where: {
        id: item.id, organizationId: item.organizationId, status: "SCHEDULED",
        dueAt: { lte: now },
      } });
      if (!row) return false;
      let blocked: string | null = null;
      try {
        const member = await tx.membership.findUnique({ where: {
          userId_organizationId: { userId: row.actorId, organizationId: row.organizationId },
        } });
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) blocked = "APPROVER_CHANGED";
        const intent = await currentApproval(
          tx,
          row.organizationId,
          row.intentId,
          now,
        );
        const connection = await tx.socialConnection.findFirst({ where: {
          id: row.connectionId, organizationId: row.organizationId,
        } });
        if (!connection) blocked = "CONNECTION_CHANGED";
        else activeConnection(connection, row.organizationId);
        const review = await tx.publicationPolicyReview.findUnique({ where: { intentId: row.intentId } });
        if (!review || review.connectionId !== row.connectionId ||
            review.organizationId !== row.organizationId ||
            !(await workspaceYoutubeReviewCurrent(tx, row.organizationId, review)) || review.expiresAt <= now ||
            review.contentRevision !== intent.contentRevision ||
            review.snapshotHash !== youtubePolicyFingerprint({ intentId: intent.id,
              connectionId: row.connectionId, contentRevision: intent.contentRevision,
              renderId: intent.renderId, metadata: review.metadata, policyVersion: review.policyVersion })) blocked = "POLICY_REVIEW_CHANGED";
        if (!blocked && review) {
          const guidance = await evaluateScheduleGuidance(tx, {
            organizationId: row.organizationId, connectionId: row.connectionId,
            intentId: row.intentId, dueAt: row.dueAt, metadata: review.metadata,
          });
          if (!row.guidanceFingerprint || row.guidanceFingerprint !== guidance.fingerprint)
            blocked = "POSTING_GUIDANCE_CHANGED";
        }
      } catch (error) {
        blocked = blocked ||
          (error instanceof PublicationClaimReviewChangedException
            ? claimEvidenceChangedCode
            : "PRECHECK_FAILED");
      }
      await tx.publicationSchedule.updateMany({ where: { id: row.id, status: "SCHEDULED" },
        data: blocked ? { status: "NEEDS_REVIEW", completedAt: now, outcomeCode: blocked }
          : { status: "CLAIMED", claimedAt: now } });
      await tx.auditLog.create({ data: { organizationId: row.organizationId,
        actorId: row.actorId, action: blocked ? "publication.schedule_needs_review" : "publication.schedule_claimed",
        entityId: row.id, detail: blocked ? { reason: blocked } : {} } });
      return !blocked;
    });
    if (!claimed) continue;
    claimedCount++;
    let result: { status: string; id: string } | null = null;
    const heartbeat = setInterval(() => {
      void db.publicationSchedule.updateMany({ where: { id: item.id, status: "CLAIMED" },
        data: { claimedAt: new Date() } }).catch(() => {});
    }, 15000);
    try {
      if (!scheduledDispatchEnabled()) throw new Error("POLICY_MAINTENANCE_CHANGED");
      result = await dispatchReviewedYoutubeVideo(db, store, {
        organizationId: item.organizationId, actorId: item.actorId,
        intentId: item.intentId, connectionId: item.connectionId,
        requestKey: item.requestKey,
      }, providerRequest);
    } catch { /* Any uncertain send or process failure requires human review. */ }
    finally { clearInterval(heartbeat); }
    const status = result?.status === "CONFIRMED" ? "CONFIRMED" :
      result?.status === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW";
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${item.organizationId} FOR UPDATE`;
      const changed = await tx.publicationSchedule.updateMany({ where: { id: item.id, status: "CLAIMED" },
        data: { status, attemptId: result?.id ?? null, completedAt: new Date(),
          outcomeCode: result?.status ?? "DISPATCH_UNCERTAIN" } });
      if (changed.count) await tx.auditLog.create({ data: { organizationId: item.organizationId,
        actorId: item.actorId, action: `publication.schedule_${status.toLowerCase()}`,
        entityId: item.id, detail: { attemptId: result?.id ?? null } } });
    });
  }
  return claimedCount;
}
