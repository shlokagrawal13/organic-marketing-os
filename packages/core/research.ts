import { z } from "zod";
import { canonicalEvidenceSourceUrl } from "./evidence-source";
import { parseResearchInsight, researchInsightSchema } from "./research-insight";

export const researchMaximumAgeDays = 30;
export const researchMaximumAgeMs = researchMaximumAgeDays * 86400000;
export const researchCategories = [
  "INDUSTRY",
  "AUDIENCE",
  "COMPETITOR",
  "SEARCH",
  "SEASONAL",
  "COMMUNITY",
] as const;
export const researchTemporalScopes = [
  "CURRENT",
  "HISTORICAL",
  "EVERGREEN",
  "EMERGING",
  "EXPIRED",
] as const;
export const researchRevisionSchema = z.number().int().min(1).max(2147483646);

export const researchInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    category: z.enum(researchCategories),
    temporalScope: z.enum(researchTemporalScopes),
    summary: z.string().trim().min(1).max(5000),
    sourceUrl: z.string().trim().min(1).max(2048).nullable().default(null),
    sourceLabel: z.string().trim().min(1).max(200).nullable().default(null),
    observedAt: z.string().datetime({ offset: true }).nullable().default(null),
    market: z.string().trim().max(100).default(""),
    language: z.string().trim().max(80).default(""),
    authorizedSource: z.literal(true),
    insight: researchInsightSchema.nullable().default(null),
  })
  .strict();

export type ResearchInput = z.infer<typeof researchInputSchema>;

/** Validate operator-supplied evidence; this never retrieves the source URL. */
export function parseResearchInput(
  value: unknown,
  now = new Date(),
): ResearchInput {
  const data = researchInputSchema.parse(value);
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid research clock.");
  if (data.observedAt && new Date(data.observedAt).getTime() > now.getTime())
    throw new Error("The observation date cannot be in the future.");
  return {
    ...data,
    insight: parseResearchInsight(data.insight, data.category),
    sourceUrl: data.sourceUrl
      ? canonicalEvidenceSourceUrl(data.sourceUrl)
      : null,
    observedAt: data.observedAt
      ? new Date(data.observedAt).toISOString()
      : null,
  };
}

type EvidenceState = {
  sourceUrl: string | null;
  sourceLabel: string | null;
  observedAt: string | Date | null;
  temporalScope: (typeof researchTemporalScopes)[number];
  reviewStatus: "UNREVIEWED" | "ACCEPTED" | "REJECTED";
};

/** Recency is derived on every read; reviewing an old record cannot renew it. */
export function researchEvidenceState(record: EvidenceState, now = new Date()) {
  const observed =
    record.observedAt === null ? NaN : new Date(record.observedAt).getTime();
  const validDate =
    Number.isFinite(observed) &&
    Number.isFinite(now.getTime()) &&
    observed <= now.getTime();
  const expiresAt = validDate
    ? new Date(observed + researchMaximumAgeMs).toISOString()
    : null;
  let freshness: "MISSING" | "STALE" | "CURRENT";
  let freshnessReason: string;
  let validSource = false;
  try {
    validSource = Boolean(
      record.sourceUrl && canonicalEvidenceSourceUrl(record.sourceUrl),
    );
  } catch {
    /* Invalid stored references fail closed without attempting a fetch. */
  }
  if (!validSource || !record.sourceLabel?.trim() || !validDate) {
    freshness = "MISSING";
    freshnessReason =
      "A valid HTTPS citation, source label and non-future observation date are required.";
  } else if (
    record.temporalScope === "EXPIRED" ||
    now.getTime() - observed >= researchMaximumAgeMs
  ) {
    freshness = "STALE";
    freshnessReason =
      record.temporalScope === "EXPIRED"
        ? "This record is marked expired."
        : "The observation is at least 30 days old; review does not renew its age.";
  } else {
    freshness = "CURRENT";
    freshnessReason =
      "The declared observation is less than 30 days old; source reachability and accuracy are not verified.";
  }
  return {
    freshness,
    freshnessReason,
    expiresAt,
    eligibleForStrategy:
      freshness === "CURRENT" &&
      record.reviewStatus === "ACCEPTED" &&
      record.temporalScope !== "HISTORICAL" &&
      record.temporalScope !== "EXPIRED",
  };
}
