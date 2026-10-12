import { ServiceUnavailableException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { digest } from "../../../packages/core/security";

type DbReader = PrismaClient | Prisma.TransactionClient;
const dayMs = 24 * 60 * 60 * 1000;
export const postingGuidanceVersion = "youtube-schedule-guidance-1";

function setting(value: string | undefined, fallback: number, maximum: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > maximum)
    throw new ServiceUnavailableException("Posting guidance configuration needs review.");
  return Number(value);
}

function normalized(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ") : "";
}

function titleOf(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const snippet = (metadata as { snippet?: unknown }).snippet;
  if (!snippet || typeof snippet !== "object" || Array.isArray(snippet)) return "";
  return normalized((snippet as { title?: unknown }).title);
}

function similarTitle(first: string, second: string) {
  if (!first || !second) return false;
  if (first === second) return true;
  const a = new Set(first.split(" ")), b = new Set(second.split(" "));
  if (a.size < 3 || b.size < 3) return false;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(a.size, b.size) >= 0.8;
}

// Advisory only: these numbers are workspace guidance, not a YouTube limit.
// The same tenant/channel query is repeated under the organization lock at save
// and due time. A changed snapshot stops a scheduled send for human review.
export async function evaluateScheduleGuidance(db: DbReader, input: {
  organizationId: string; connectionId: string; intentId: string;
  dueAt: Date; metadata: unknown;
}) {
  const dailyCount = setting(process.env.YOUTUBE_GUIDANCE_24H_COUNT, 2, 50);
  const gapMinutes = setting(process.env.YOUTUBE_GUIDANCE_GAP_MINUTES, 120, 1440);
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
  const titles = new Map(reviews.map((review) => [review.intentId, titleOf(review.metadata)]));
  const currentTitle = titleOf(input.metadata);
  const nearby = ordered.filter((event) =>
    Math.abs(event.at.getTime() - input.dueAt.getTime()) < gapMinutes * 60000);
  const volume = ordered.filter((event) =>
    Math.abs(event.at.getTime() - input.dueAt.getTime()) < dayMs / 2);
  const repeated = ordered.filter((event) => similarTitle(currentTitle, titles.get(event.intentId) ?? ""));
  const warnings: { code: string; message: string }[] = [];
  if (nearby.length) warnings.push({ code: "CLOSE_SPACING",
    message: `Another upload may be within ${gapMinutes} minutes of this time. Review your posting cadence.` });
  if (volume.length >= dailyCount) warnings.push({ code: "HIGH_24H_VOLUME",
    message: `This would exceed your guidance of ${dailyCount} uploads in the 24-hour window centered on this time.` });
  if (repeated.length) warnings.push({ code: "SIMILAR_TITLE",
    message: "A recent or scheduled upload has a very similar title. Check for repetitive content." });
  const fingerprint = digest(JSON.stringify({ version: postingGuidanceVersion,
    organizationId: input.organizationId, connectionId: input.connectionId,
    intentId: input.intentId, dueAt: input.dueAt.toISOString(),
    dailyCount, gapMinutes, currentTitle,
    events: ordered.map((event) => ({ id: event.id, intentId: event.intentId,
      status: event.status, at: event.at.toISOString(), title: titles.get(event.intentId) ?? "" })),
  }));
  return { fingerprint, warnings, guidance: { dailyCount, gapMinutes, window: "24h-centered" },
    disclaimer: "Workspace guidance only; no posting frequency guarantees platform approval or prevents enforcement." };
}
