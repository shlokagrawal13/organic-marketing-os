import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { once } from "node:events";
import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ObjectStore } from "../../../packages/core/object-store";
import { youtubePolicyMaintenanceCurrent } from "../../../packages/core/youtube-policy";
import { decryptSocialToken } from "../../../packages/core/social-tokens";
import { YoutubeVideoMetadata, probeYoutubeUpload, sendYoutubeUploadBytes,
  startYoutubeUploadSession } from "../../../packages/core/youtube-resumable";
import { activeConnection, enterPublicationSubmission,
  ownedYoutubeUploadSession, persistYoutubeUploadSession,
  recordPublicationOutcome, reservePublicationAttempt } from "./publication-attempts";

const metadataSchema = z.object({
  snippet: z.object({ title: z.string().min(1), description: z.string().min(1) }).strict(),
  status: z.object({ privacyStatus: z.enum(["private", "unlisted", "public"]),
    selfDeclaredMadeForKids: z.boolean(), containsSyntheticMedia: z.boolean() }).strict(),
}).strict();

async function approver(db: PrismaClient, organizationId: string, actorId: string) {
  const member = await db.membership.findUnique({
    where: { userId_organizationId: { userId: actorId, organizationId } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role))
    throw new ForbiddenException("Only a current workspace owner or admin can dispatch a post.");
}
async function activeToken(db: PrismaClient, organizationId: string,
  connectionId: string, actorId: string) {
  await approver(db, organizationId, actorId);
  const connection = await db.socialConnection.findFirst({
    where: { id: connectionId, organizationId },
  });
  if (!connection) throw new ConflictException("Authorized YouTube connection is unavailable.");
  activeConnection(connection, organizationId);
  if (!/^UC[A-Za-z0-9_-]{10,}$/u.test(connection.externalAccountId))
    throw new ConflictException("The connected YouTube channel ID is invalid.");
  const token = decryptSocialToken(connection.accessTokenCiphertext, {
    organizationId, provider: "YOUTUBE", externalAccountId: connection.externalAccountId,
  });
  return { connection, token };
}

// Stage the exact private approved object without buffering a large video.
async function stageRender(store: ObjectStore, key: string,
  expectedBytes: number, path: string) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0)
    throw new ConflictException("The approved video size is unavailable.");
  const object = await store.get(key);
  if (!object.Body) throw new ConflictException("Approved private media is unavailable.");
  const hash = createHash("sha256");
  const output = createWriteStream(path, { mode: 0o600, flags: "wx" });
  let bytes = 0;
  try {
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      const part = Buffer.from(chunk);
      bytes += part.length;
      if (bytes > expectedBytes)
        throw new ConflictException("The approved video size changed.");
      hash.update(part);
      if (!output.write(part)) await once(output, "drain");
    }
    output.end();
    await once(output, "finish");
    if (bytes !== expectedBytes)
      throw new ConflictException("The approved video size changed.");
    return { sha256: hash.digest("hex"), bytes, outputKey: key };
  } finally {
    (object.Body as { destroy?: () => void }).destroy?.();
    if (!output.closed) output.destroy();
  }
}

type DispatchInput = { organizationId: string; actorId: string;
  intentId: string; connectionId: string; requestKey: string;
  manualGuidance?: { fingerprint: string; checkedAt: Date; acknowledged: boolean } };

function requireCurrentPolicy() {
  if (process.env.YOUTUBE_LIVE_DISPATCH_ENABLED !== "true" ||
      !youtubePolicyMaintenanceCurrent(process.env))
    throw new ServiceUnavailableException("YouTube dispatch requires an enabled deployment and current platform policy review.");
}

// Manual sending requires an explicit user action. The scheduler invokes this
// only after its durable claim and reviewed guidance; neither path retries.
export async function dispatchReviewedYoutubeVideo(db: PrismaClient, store: ObjectStore,
  input: DispatchInput, providerRequest: typeof fetch = fetch) {
  requireCurrentPolicy();
  await approver(db, input.organizationId, input.actorId);
  const intent = await db.publicationIntent.findFirst({
    where: { id: input.intentId, organizationId: input.organizationId },
  });
  if (!intent?.renderId) throw new NotFoundException("YouTube video preparation not found.");
  const render = await db.renderJob.findFirst({
    where: { id: intent.renderId, organizationId: input.organizationId,
      contentId: intent.contentId, contentRevision: intent.contentRevision,
      status: "SUCCEEDED", approvedAt: { not: null }, outputKey: { not: null } },
  });
  if (!render?.outputKey || !render.outputBytes)
    throw new ConflictException("The approved video output is unavailable.");
  const dir = await mkdtemp(join(tmpdir(), "mos-youtube-"));
  try {
    const media = await stageRender(store, render.outputKey,
      render.outputBytes, join(dir, "video.mp4"));
    const reserved = await reservePublicationAttempt(db, { ...input, media });
    if (reserved.status !== "RESERVED")
      throw new ConflictException("A previous upload attempt needs review before any new send.");
    const started = await enterPublicationSubmission(db, {
      organizationId: input.organizationId, attemptId: reserved.id,
      expectedVersion: reserved.version, actorId: input.actorId, media,
    });
    let version = started.version;
    async function uncertain(code: string) {
      try {
        return await recordPublicationOutcome(db, { organizationId: input.organizationId,
          attemptId: reserved.id, expectedVersion: version, actorId: input.actorId,
          outcome: { kind: "unknown", code } });
      } catch {
        // A revocation or recovery may have marked UNKNOWN already. Never retry.
        return db.publicationAttempt.findFirst({ where: { id: reserved.id,
          organizationId: input.organizationId } });
      }
    }
    try {
      requireCurrentPolicy();
      const first = await activeToken(db, input.organizationId, input.connectionId, input.actorId);
      const snapshot = started.policySnapshot as { metadata?: unknown } | null;
      const metadata = metadataSchema.parse(snapshot?.metadata) as YoutubeVideoMetadata;
      const session = await startYoutubeUploadSession({ accessToken: first.token,
        metadata, byteLength: media.bytes, request: providerRequest });
      const saved = await persistYoutubeUploadSession(db, { organizationId: input.organizationId,
        attemptId: started.id, expectedVersion: version, actorId: input.actorId,
        sessionUri: session.sessionUri });
      version = saved.version;
      const second = await activeToken(db, input.organizationId, input.connectionId, input.actorId);
      if (second.connection.accessTokenCiphertext !== first.connection.accessTokenCiphertext)
        throw new ConflictException("YouTube authorization changed during the upload.");
      const current = await db.publicationAttempt.findFirst({ where: {
        id: started.id, organizationId: input.organizationId, status: "SUBMITTING", version,
        mediaSha256: media.sha256, mediaBytes: media.bytes,
        uploadSessionCiphertext: { not: null },
      } });
      if (!current) throw new ConflictException("The upload attempt changed before sending media.");
      const body = Readable.toWeb(createReadStream(join(dir, "video.mp4"))) as ReadableStream<Uint8Array>;
      const result = await sendYoutubeUploadBytes({ accessToken: second.token,
        sessionUri: session.sessionUri, byteLength: media.bytes,
        expectedChannelId: second.connection.externalAccountId, body,
        request: providerRequest });
      if (result.kind === "incomplete") return uncertain("UPLOAD_INCOMPLETE");
      return recordPublicationOutcome(db, { organizationId: input.organizationId,
        attemptId: started.id, expectedVersion: version, actorId: input.actorId,
        outcome: { kind: "confirmed", providerPostId: result.videoId, evidence: "receipt" } });
    } catch { return uncertain("UPLOAD_OUTCOME_UNCERTAIN"); }
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// UNKNOWN only: an empty PUT to the saved session cannot send media bytes.
export async function reconcileUnknownYoutubeUpload(db: PrismaClient,
  input: { organizationId: string; actorId: string; attemptId: string },
  providerRequest: typeof fetch = fetch) {
  await approver(db, input.organizationId, input.actorId);
  const { attempt, connection, sessionUri } = await ownedYoutubeUploadSession(db, input);
  if (attempt.status !== "UNKNOWN")
    throw new ConflictException("Only an uncertain upload can be reconciled.");
  const auth = await activeToken(db, input.organizationId, connection.id, input.actorId);
  try {
    const outcome = await probeYoutubeUpload({ accessToken: auth.token, sessionUri,
      byteLength: attempt.mediaBytes!, expectedChannelId: connection.externalAccountId,
      request: providerRequest });
    if (outcome.kind === "incomplete") return { status: "UNKNOWN" as const,
      committedBytes: outcome.committedBytes };
    return recordPublicationOutcome(db, { organizationId: input.organizationId,
      attemptId: attempt.id, expectedVersion: attempt.version, actorId: input.actorId,
      outcome: { kind: "confirmed", providerPostId: outcome.videoId,
        evidence: "read_only_lookup" } });
  } catch { return { status: "UNKNOWN" as const }; }
}
