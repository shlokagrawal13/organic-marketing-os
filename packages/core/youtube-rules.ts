import { z } from "zod";
import { draftSchema } from "./ai";
import { digest } from "./security";
import configuredRules from "./youtube-rules.json";

// Operator-maintained deployment policy. Config can tighten these platform
// ceilings, but cannot remove the required format, audience or disclosure inputs.
export const youtubeRulesSchema = z.object({
  revision: z.string().regex(/^[a-z0-9.-]{1,80}$/u),
  platform: z.literal("YouTube"),
  format: z.literal("Video"),
  titleMaxCharacters: z.number().int().min(1).max(100),
  descriptionMaxUtf8Bytes: z.number().int().min(1).max(5000),
  allowedPrivacyStatuses: z.array(z.enum(["private", "unlisted", "public"]))
    .min(1).max(3).refine((items) => new Set(items).size === items.length),
  requireSyntheticMediaDeclaration: z.boolean(),
}).strict();

export function createYoutubeMetadataPolicy(raw: unknown) {
  const parsed = youtubeRulesSchema.parse(raw);
  const rules = Object.freeze({ ...parsed,
    allowedPrivacyStatuses: Object.freeze([...parsed.allowedPrivacyStatuses].sort()),
  });
  const fingerprint = digest(JSON.stringify(rules));
  return Object.freeze({
    rules,
    fingerprint,
    baseMetadata(snapshot: unknown) {
      const draft = draftSchema.strip().parse(snapshot);
      if (draft.platform !== rules.platform || draft.format !== rules.format)
        throw new Error("Only approved YouTube videos can receive an upload review.");
      const title = draft.title.trim();
      const description = [draft.hook, draft.body, draft.cta]
        .map((part) => part.trim()).filter(Boolean).join("\n\n");
      if (!title || title.length > rules.titleMaxCharacters || /[<>]/u.test(title))
        throw new Error(`YouTube title must be 1–${rules.titleMaxCharacters} characters without angle brackets.`);
      if (!description || Buffer.byteLength(description, "utf8") > rules.descriptionMaxUtf8Bytes || /[<>]/u.test(description))
        throw new Error(`YouTube description must be nonempty, at most ${rules.descriptionMaxUtf8Bytes} UTF-8 bytes and without angle brackets.`);
      return { title, description };
    },
    checkDeclarations(review: { privacyStatus: string; containsSyntheticMedia: boolean }) {
      if (!rules.allowedPrivacyStatuses.some((status) => status === review.privacyStatus))
        throw new Error("The selected visibility is unavailable under the current YouTube policy.");
      if (rules.requireSyntheticMediaDeclaration && !review.containsSyntheticMedia)
        throw new Error("The current YouTube policy requires a synthetic-media declaration.");
    },
  });
}

// Parse once at startup; invalid configuration prevents the app/worker loading.
// Rebuild and restart every API/worker after changing the deployment rules.
export const youtubeMetadataPolicy = createYoutubeMetadataPolicy(configuredRules);

export function createWorkspaceYoutubeMetadataPolicy(raw: unknown, deploymentPolicy = youtubeMetadataPolicy) {
  const policy = createYoutubeMetadataPolicy(raw);
  const deployment = deploymentPolicy.rules;
  if (policy.rules.titleMaxCharacters > deployment.titleMaxCharacters ||
      policy.rules.descriptionMaxUtf8Bytes > deployment.descriptionMaxUtf8Bytes ||
      policy.rules.allowedPrivacyStatuses.some((status) => !deployment.allowedPrivacyStatuses.includes(status)) ||
      (deployment.requireSyntheticMediaDeclaration && !policy.rules.requireSyntheticMediaDeclaration))
    throw new Error("Workspace rules cannot loosen the deployment YouTube policy.");
  return policy;
}
