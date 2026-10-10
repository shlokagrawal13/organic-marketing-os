import { z } from "zod";
import { draftSchema } from "./ai";
import { digest } from "./security";

// Reviewed against the official videos.insert and video resource references
// last updated 2026-10-08. This version must be advanced after policy review;
// a local review expires after 24 hours even when the code version is unchanged.
export const youtubePolicyVersion = "youtube-videos-insert-2026-10-08";
export const youtubePolicyReviewLifetimeMs = 24 * 60 * 60 * 1000;
export const youtubeReviewInput = z.object({
  connectionId: z.string().uuid(),
  privacyStatus: z.enum(["private", "unlisted", "public"]),
  selfDeclaredMadeForKids: z.boolean(),
  containsSyntheticMedia: z.boolean(),
  metadataReviewed: z.literal(true),
  audienceReviewed: z.literal(true),
  syntheticMediaReviewed: z.literal(true),
  rightsAndPlatformRulesReviewed: z.literal(true),
}).strict();

export function youtubeBaseMetadata(snapshot: unknown) {
  const draft = draftSchema.strip().parse(snapshot);
  if (draft.platform !== "YouTube" || draft.format !== "Video")
    throw new Error("Only approved YouTube videos can receive an upload review.");
  const title = draft.title.trim();
  const description = [draft.hook, draft.body, draft.cta]
    .map((part) => part.trim()).filter(Boolean).join("\n\n");
  if (!title || title.length > 100 || /[<>]/u.test(title))
    throw new Error("YouTube title must be 1–100 characters without angle brackets.");
  if (!description || Buffer.byteLength(description, "utf8") > 5000 || /[<>]/u.test(description))
    throw new Error("YouTube description must be nonempty, at most 5000 UTF-8 bytes and without angle brackets.");
  return { title, description };
}

export function youtubeUploadMetadata(snapshot: unknown, review: z.infer<typeof youtubeReviewInput>) {
  // Privacy is never omitted: Google's documented default can be public.
  // Scheduling/publishAt, tags, category and other mutable metadata are not
  // accepted by this bounded contract. No provider call occurs here.
  return {
    snippet: youtubeBaseMetadata(snapshot),
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
    policyVersion: youtubePolicyVersion,
  })));
}
