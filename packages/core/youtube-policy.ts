import { z } from "zod";
import { digest } from "./security";
import { youtubeMetadataPolicy } from "./youtube-rules";

// Reviewed against the exact official-source manifest below on 2026-10-17.
// Advance the version when the maintained rules or source set changes.
export const youtubePolicyVersion = `youtube-upload-policy-2026-10-17.${youtubeMetadataPolicy.fingerprint}`;
export const youtubePolicySources = [
  { id: "videos-insert", url: "https://developers.google.com/youtube/data/reference/rest/v3/videos/insert" },
  { id: "video-resource", url: "https://developers.google.com/youtube/data/reference/rest/v3/videos" },
  { id: "api-terms", url: "https://developers.google.com/youtube/terms/api-services-terms-of-service" },
  { id: "developer-policies", url: "https://developers.google.com/youtube/terms/developer-policies" },
  { id: "required-minimum-functionality", url: "https://developers.google.com/youtube/terms/required-minimum-functionality" },
] as const;
export const youtubePolicySourceFingerprint = digest(JSON.stringify({
  policyVersion: youtubePolicyVersion, sources: youtubePolicySources,
}));
export const youtubePolicyReviewLifetimeMs = 24 * 60 * 60 * 1000;
export const youtubePolicyMaintenanceLifetimeMs = 7 * 24 * 60 * 60 * 1000;

// A deployment operator must explicitly record a recent review of the API
// reference, required upload functionality, Terms and Developer Policies.
// This is an operational stop switch, not a claim of platform certification.
export function youtubePolicyMaintenanceCurrent(
  config: { YOUTUBE_POLICY_REVIEWED_VERSION?: string; YOUTUBE_POLICY_REVIEWED_AT?: string;
    YOUTUBE_POLICY_SOURCE_FINGERPRINT?: string },
  now = new Date(),
) {
  const at = config.YOUTUBE_POLICY_REVIEWED_AT;
  if (config.YOUTUBE_POLICY_REVIEWED_VERSION !== youtubePolicyVersion ||
      config.YOUTUBE_POLICY_SOURCE_FINGERPRINT !== youtubePolicySourceFingerprint ||
      !at || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u.test(at)) return false;
  const reviewed = Date.parse(at), current = now.getTime();
  return Number.isFinite(reviewed) && Number.isFinite(current) &&
    new Date(reviewed).toISOString() === (at.length === 20 ? at.replace("Z", ".000Z") : at) &&
    reviewed <= current && current - reviewed < youtubePolicyMaintenanceLifetimeMs;
}
export const youtubeReviewInput = z.object({
  workspacePolicyRevision: z.number().int().min(0).max(2147483647).default(0),
  connectionId: z.string().uuid(),
  privacyStatus: z.enum(["private", "unlisted", "public"]),
  selfDeclaredMadeForKids: z.boolean(),
  containsSyntheticMedia: z.boolean(),
  metadataReviewed: z.literal(true),
  audienceReviewed: z.literal(true),
  syntheticMediaReviewed: z.literal(true),
  rightsAndPlatformRulesReviewed: z.literal(true),
}).strict();

export function youtubeBaseMetadata(snapshot: unknown, policy = youtubeMetadataPolicy) {
  return policy.baseMetadata(snapshot);
}

export function youtubeUploadMetadata(snapshot: unknown, review: z.infer<typeof youtubeReviewInput>, policy = youtubeMetadataPolicy) {
  policy.checkDeclarations(review);
  // Privacy is never omitted: Google's documented default can be public.
  // Scheduling/publishAt, tags, category and other mutable metadata are not
  // accepted by this bounded contract. No provider call occurs here.
  return {
    snippet: youtubeBaseMetadata(snapshot, policy),
    status: {
      privacyStatus: review.privacyStatus,
      selfDeclaredMadeForKids: review.selfDeclaredMadeForKids,
      containsSyntheticMedia: review.containsSyntheticMedia,
    },
  };
}

export function youtubePolicyFingerprint(input: {
  intentId: string;
  connectionId: string;
  contentRevision: number;
  renderId: string | null;
  metadata: unknown;
  policyVersion?: string;
}) {
  // PostgreSQL JSONB normalizes object key order; hash canonical JSON so the
  // stored metadata has the same fingerprint after an actual DB round trip.
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return digest(JSON.stringify(canonical({
    intentId: input.intentId,
    connectionId: input.connectionId,
    contentRevision: input.contentRevision,
    renderId: input.renderId,
    metadata: input.metadata,
    policyVersion: input.policyVersion ?? youtubePolicyVersion,
  })));
}
