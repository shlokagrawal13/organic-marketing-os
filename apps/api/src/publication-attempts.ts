import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { digest } from "../../../packages/core/security";

type Tx = Prisma.TransactionClient;
const unresolved = ["RESERVED", "SUBMITTING", "UNKNOWN", "CONFIRMED"] as const;

async function currentApproval(tx: Tx, org: string, intentId: string) {
  await tx.$queryRaw`SELECT id FROM "PublicationIntent" WHERE id=${intentId} AND "organizationId"=${org} FOR UPDATE`;
  const intent = await tx.publicationIntent.findFirst({
    where: { id: intentId, organizationId: org },
  });
  if (!intent)
    throw new NotFoundException("Publication preparation not found.");
  if (intent.status !== "PREPARED")
    throw new ConflictException("Publication preparation is no longer active.");
  await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${intent.contentId} AND "organizationId"=${org} FOR UPDATE`;
  const content = await tx.contentItem.findFirst({
    where: { id: intent.contentId, organizationId: org },
  });
  if (
    !content ||
    content.status !== "APPROVED" ||
    !content.approvedAt ||
    content.revision !== intent.contentRevision
  )
    throw new ConflictException(
      "Approve the current content revision before submission.",
    );
  if (
    content.platform !== "YouTube" ||
    intent.platform !== "YouTube" ||
    content.format !== "Video" ||
    !intent.renderId
  )
    throw new BadRequestException(
      "Only approved YouTube video preparations are supported by this ledger.",
    );
  const render = await tx.renderJob.findFirst({
    where: {
      id: intent.renderId,
      organizationId: org,
      contentId: content.id,
      contentRevision: content.revision,
      status: "SUCCEEDED",
      approvedAt: { not: null },
      outputKey: { not: null },
    },
  });
  if (!render)
    throw new ConflictException(
      "The exact approved video render is unavailable.",
    );
  return intent;
}

function activeConnection(
  connection: {
    organizationId: string;
    provider: string;
    revokedAt: Date | null;
    tokenExpiresAt: Date | null;
    scopes: string[];
  },
  org: string,
) {
  if (
    connection.organizationId !== org ||
    connection.provider !== "YOUTUBE" ||
    connection.revokedAt ||
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt <= new Date() ||
    !connection.scopes.includes(
      "https://www.googleapis.com/auth/youtube.upload",
    )
  )
    throw new ConflictException(
      "A current authorized YouTube upload connection is required.",
    );
}

// Internal only. The future OAuth adapter must validate platform policy immediately
// before calling this and must decrypt the token only after rechecking revocation.
// No HTTP route, scheduler or provider sender invokes these functions yet.
export async function reservePublicationAttempt(
  db: PrismaClient,
  input: {
    organizationId: string;
    intentId: string;
    connectionId: string;
    requestKey: string;
    actorId: string;
  },
) {
  const { organizationId: org } = input;
  const requestHash = digest(
    JSON.stringify({
      intentId: input.intentId,
      connectionId: input.connectionId,
    }),
  );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
    const replay = await tx.publicationAttempt.findUnique({
      where: {
        organizationId_requestKey: {
          organizationId: org,
          requestKey: input.requestKey,
        },
      },
    });
    if (replay) {
      if (replay.requestHash !== requestHash)
        throw new ConflictException("Attempt key belongs to different input.");
      return replay;
    }
    const intent = await currentApproval(tx, org, input.intentId);
    const existing = await tx.publicationAttempt.findUnique({
      where: { intentId: intent.id },
    });
    if (existing)
      throw new ConflictException(
        "This preparation already has an attempt. Review its outcome first.",
      );
    const connection = await tx.socialConnection.findFirst({
      where: { id: input.connectionId, organizationId: org },
    });
    if (!connection)
      throw new NotFoundException("Social connection not found.");
    activeConnection(connection, org);
    const other = await tx.publicationAttempt.findFirst({
      where: {
        organizationId: org,
        connectionId: connection.id,
        contentId: intent.contentId,
        contentRevision: intent.contentRevision,
        status: { in: [...unresolved] },
      },
    });
    if (other)
      throw new ConflictException(
        "A post for this revision and account may already exist. Reconcile it before another attempt.",
      );
    const attempt = await tx.publicationAttempt.create({
      data: {
        organizationId: org,
        intentId: intent.id,
        connectionId: connection.id,
        contentId: intent.contentId,
        contentRevision: intent.contentRevision,
        requestKey: input.requestKey,
        requestHash,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: org,
        actorId: input.actorId,
        action: "publication.attempt_reserved",
        entityId: attempt.id,
        detail: { intentId: intent.id, connectionId: connection.id },
      },
    });
    return attempt;
  });
}

// This durable transition must be committed BEFORE any outbound request.
export async function enterPublicationSubmission(
  db: PrismaClient,
  input: {
    organizationId: string;
    attemptId: string;
    expectedVersion: number;
    actorId: string;
  },
) {
  const { organizationId: org } = input;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
    const attempt = await tx.publicationAttempt.findFirst({
      where: { id: input.attemptId, organizationId: org },
    });
    if (!attempt) throw new NotFoundException("Publication attempt not found.");
    if (
      attempt.status !== "RESERVED" ||
      attempt.version !== input.expectedVersion
    )
      throw new ConflictException(
        "Attempt already started or changed. Never submit it twice.",
      );
    await currentApproval(tx, org, attempt.intentId);
    const connection = await tx.socialConnection.findFirst({
      where: { id: attempt.connectionId, organizationId: org },
    });
    if (!connection)
      throw new ConflictException("Authorized connection is unavailable.");
    activeConnection(connection, org);
    const changed = await tx.publicationAttempt.updateMany({
      where: {
        id: attempt.id,
        organizationId: org,
        status: "RESERVED",
        version: input.expectedVersion,
      },
      data: {
        status: "SUBMITTING",
        startedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new ConflictException("Attempt claim was lost.");
    await tx.auditLog.create({
      data: {
        organizationId: org,
        actorId: input.actorId,
        action: "publication.submission_boundary",
        entityId: attempt.id,
      },
    });
    return tx.publicationAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
  });
}

type Outcome =
  | { kind: "unknown"; code: string; providerRequestId?: string }
  | { kind: "rejected"; code: string; providerRequestId?: string }
  | {
      kind: "confirmed";
      providerPostId: string;
      providerRequestId?: string;
      evidence: "receipt" | "read_only_lookup";
    };

export async function recordPublicationOutcome(
  db: PrismaClient,
  input: {
    organizationId: string;
    attemptId: string;
    expectedVersion: number;
    actorId: string;
    outcome: Outcome;
  },
) {
  const { organizationId: org, outcome } = input;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
    const attempt = await tx.publicationAttempt.findFirst({
      where: { id: input.attemptId, organizationId: org },
    });
    if (!attempt) throw new NotFoundException("Publication attempt not found.");
    if (
      attempt.version !== input.expectedVersion ||
      !(
        attempt.status === "SUBMITTING" ||
        (attempt.status === "UNKNOWN" && outcome.kind === "confirmed")
      )
    )
      throw new ConflictException(
        "Attempt outcome is stale or cannot be changed this way.",
      );
    if (
      outcome.kind === "confirmed" &&
      (!outcome.providerPostId.trim() ||
        (attempt.status === "UNKNOWN" &&
          outcome.evidence !== "read_only_lookup"))
    )
      throw new BadRequestException(
        "An uncertain post needs a verified provider lookup and post ID.",
      );
    if (outcome.kind !== "confirmed" && !outcome.code.trim())
      throw new BadRequestException("Record a bounded outcome code.");
    const next =
      outcome.kind === "confirmed"
        ? "CONFIRMED"
        : outcome.kind === "rejected"
          ? "REJECTED"
          : "UNKNOWN";
    const changed = await tx.publicationAttempt.updateMany({
      where: {
        id: attempt.id,
        organizationId: org,
        status: attempt.status,
        version: input.expectedVersion,
      },
      data: {
        status: next,
        version: { increment: 1 },
        completedAt: new Date(),
        providerRequestId:
          outcome.providerRequestId ?? attempt.providerRequestId,
        providerPostId:
          outcome.kind === "confirmed" ? outcome.providerPostId : null,
        outcomeCode:
          outcome.kind === "confirmed"
            ? outcome.evidence
            : outcome.code.slice(0, 120),
      },
    });
    if (!changed.count)
      throw new ConflictException("Attempt outcome changed concurrently.");
    await tx.auditLog.create({
      data: {
        organizationId: org,
        actorId: input.actorId,
        action: `publication.${next.toLowerCase()}`,
        entityId: attempt.id,
        detail: {
          providerPostId:
            outcome.kind === "confirmed" ? outcome.providerPostId : null,
        },
      },
    });
    return tx.publicationAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
  });
}

// A dead worker may have sent the request. Recovery only marks UNKNOWN; it never calls a provider.
export async function recoverStalePublicationAttempts(
  db: PrismaClient,
  cutoff: Date,
) {
  const stale = await db.publicationAttempt.findMany({
    where: { status: "SUBMITTING", startedAt: { lt: cutoff } },
    take: 100,
  });
  let recovered = 0;
  for (const candidate of stale) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${candidate.organizationId} FOR UPDATE`;
      const changed = await tx.publicationAttempt.updateMany({
        where: {
          id: candidate.id,
          status: "SUBMITTING",
          version: candidate.version,
          startedAt: { lt: cutoff },
        },
        data: {
          status: "UNKNOWN",
          outcomeCode: "WORKER_INTERRUPTED",
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (!changed.count) return;
      recovered++;
      await tx.auditLog.create({
        data: {
          organizationId: candidate.organizationId,
          actorId: "system",
          action: "publication.interrupted",
          entityId: candidate.id,
        },
      });
    });
  }
  return recovered;
}
