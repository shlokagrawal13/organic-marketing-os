import { workspaceYoutubeReviewCurrent } from "./workspace-youtube-policy";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { evaluatePostingPolicy, PostingPolicyConfig } from "../../../packages/core/posting-policy";
import { digest } from "../../../packages/core/security";
import { youtubePolicyFingerprint } from "../../../packages/core/youtube-policy";

type DbReader = PrismaClient | Prisma.TransactionClient;
const dayMs = 24 * 60 * 60 * 1000;
export const postingGuidanceVersion = "youtube-schedule-guidance-1";
export const manualGuidanceLifetimeMs = 2 * 60 * 1000;

function setting(value: string | undefined, fallback: number, maximum: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > maximum)
    throw new ServiceUnavailableException("Posting guidance configuration needs review.");
  return Number(value);
}

function policyConfig(): PostingPolicyConfig {
  return {
    metadataSimilarityPercent: setting(process.env.YOUTUBE_GUIDANCE_METADATA_SIMILARITY_PERCENT, 70, 100),
    topicOverlapPercent: setting(process.env.YOUTUBE_GUIDANCE_TOPIC_OVERLAP_PERCENT, 60, 100),
    topicRepeatCount: setting(process.env.YOUTUBE_GUIDANCE_TOPIC_REPEAT_COUNT, 2, 50),
    ctaRepeatCount: setting(process.env.YOUTUBE_GUIDANCE_CTA_REPEAT_COUNT, 3, 50),
    minTopicTokens: setting(process.env.YOUTUBE_GUIDANCE_MIN_TOPIC_TOKENS, 3, 20),
  };
}

// Advisory only: these numbers are workspace guidance, not a YouTube limit.
// The same tenant/channel query is repeated under the organization lock at save
// and due time. A changed snapshot stops a scheduled send for human review.
export async function evaluateScheduleGuidance(db: DbReader, input: {
  organizationId: string; connectionId: string; intentId: string;
  dueAt: Date; metadata: unknown; mode?: "schedule" | "manual";
}) {
  const dailyCount = setting(process.env.YOUTUBE_GUIDANCE_24H_COUNT, 2, 50);
  const gapMinutes = setting(process.env.YOUTUBE_GUIDANCE_GAP_MINUTES, 120, 1440);
  const semanticConfig = policyConfig();
  const from = new Date(input.dueAt.getTime() - dayMs);
  const to = new Date(input.dueAt.getTime() + dayMs);
  const [schedules, attempts] = await Promise.all([
    db.publicationSchedule.findMany({ where: {
      organizationId: input.organizationId, connectionId: input.connectionId,
      intentId: { not: input.intentId }, dueAt: { gte: from, lte: to },
      status: { in: ["SCHEDULED", "CLAIMED", "CONFIRMED", "NEEDS_REVIEW"] },
    }, select: { id: true, intentId: true, status: true, dueAt: true } }),
    db.publicationAttempt.findMany({ where: {
      organizationId: input.organizationId, connectionId: input.connectionId,
      intentId: { not: input.intentId }, createdAt: { gte: from, lte: to },
      status: { in: ["RESERVED", "SUBMITTING", "UNKNOWN", "CONFIRMED"] },
    }, select: { id: true, intentId: true, status: true,
      createdAt: true, startedAt: true, completedAt: true } }),
  ]);
  // A scheduled send may also have an attempt; count it once by intent.
  const events = new Map<string, { id: string; intentId: string; status: string; at: Date }>();
  for (const row of schedules) events.set(row.intentId, {
    id: row.id, intentId: row.intentId, status: row.status, at: row.dueAt,
  });
  for (const row of attempts) events.set(row.intentId, {
    id: row.id, intentId: row.intentId, status: row.status,
    at: row.completedAt ?? row.startedAt ?? row.createdAt,
  });
  const ordered = [...events.values()].sort((a, b) => a.intentId.localeCompare(b.intentId));
  const reviews = ordered.length ? await db.publicationPolicyReview.findMany({ where: {
    organizationId: input.organizationId, connectionId: input.connectionId,
    intentId: { in: ordered.map((event) => event.intentId) },
  }, select: { intentId: true, metadata: true } }) : [];
  const metadataByIntent = new Map(reviews.map((review) => [review.intentId, review.metadata]));
  const nearby = ordered.filter((event) =>
    Math.abs(event.at.getTime() - input.dueAt.getTime()) < gapMinutes * 60000);
  const volume = ordered.filter((event) =>
    Math.abs(event.at.getTime() - input.dueAt.getTime()) < dayMs / 2);
  const semanticPolicy = evaluatePostingPolicy({
    config: semanticConfig,
    currentMetadata: input.metadata,
    priors: ordered.map((event) => ({ ...event,
      metadata: metadataByIntent.get(event.intentId) ?? {} })),
  });
  const warnings: { code: string; message: string }[] = [];
  if (nearby.length) warnings.push({ code: "CLOSE_SPACING",
    message: `Another upload may be within ${gapMinutes} minutes of this time. Review your posting cadence.` });
  if (volume.length >= dailyCount) warnings.push({ code: "HIGH_24H_VOLUME",
    message: `This would exceed your guidance of ${dailyCount} uploads in the 24-hour window centered on this time.` });
  warnings.push(...semanticPolicy.warnings);
  const fingerprint = digest(JSON.stringify({ version: input.mode === "manual" ?
    "youtube-manual-guidance-1" : postingGuidanceVersion,
    organizationId: input.organizationId, connectionId: input.connectionId,
    intentId: input.intentId, dueAt: input.dueAt.toISOString(),
    dailyCount, gapMinutes, semanticPolicy: semanticPolicy.signals,
    events: ordered.map((event) => ({ id: event.id, intentId: event.intentId,
      status: event.status, at: event.at.toISOString() })),
  }));
  return { fingerprint, warnings, guidance: { dailyCount, gapMinutes, window: "24h-centered",
    metadataSimilarityPercent: semanticConfig.metadataSimilarityPercent,
    topicOverlapPercent: semanticConfig.topicOverlapPercent,
    topicRepeatCount: semanticConfig.topicRepeatCount,
    ctaRepeatCount: semanticConfig.ctaRepeatCount },
    disclaimer: "Workspace guidance only; no posting frequency guarantees platform approval or prevents enforcement." };
}

export async function evaluateManualGuidance(db: DbReader, input: {
  organizationId: string; connectionId: string; intentId: string;
  contentRevision: number; renderId: string | null; checkedAt: Date;
}) {
  const review = await db.publicationPolicyReview.findUnique({ where: { intentId: input.intentId } });
  if (!review || review.organizationId !== input.organizationId ||
      review.connectionId !== input.connectionId ||
      review.contentRevision !== input.contentRevision ||
      !(await workspaceYoutubeReviewCurrent(db, input.organizationId, review)) ||
      review.expiresAt <= new Date() ||
      review.snapshotHash !== youtubePolicyFingerprint({
        intentId: input.intentId, connectionId: input.connectionId,
        contentRevision: input.contentRevision, renderId: input.renderId,
        metadata: review.metadata, policyVersion: review.policyVersion,
      }))
    throw new ConflictException("A current reviewed YouTube upload policy and metadata snapshot is required.");
  return { ...(await evaluateScheduleGuidance(db, {
    organizationId: input.organizationId, connectionId: input.connectionId,
    intentId: input.intentId, dueAt: input.checkedAt,
    metadata: review.metadata, mode: "manual",
  })), checkedAt: input.checkedAt.toISOString() };
}
