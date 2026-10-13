import { digest } from "./security";

export type PostingPolicyConfig = {
  metadataSimilarityPercent: number;
  topicOverlapPercent: number;
  topicRepeatCount: number;
  ctaRepeatCount: number;
  minTopicTokens: number;
};

export type PostingPolicyPrior = {
  id: string;
  intentId: string;
  status: string;
  at: Date;
  metadata: unknown;
};

export type PostingPolicyWarning = {
  code: "SIMILAR_METADATA" | "REPEATED_TOPIC_CLUSTER" | "REPEATED_CTA_PATTERN";
  message: string;
};

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in",
  "is", "it", "of", "on", "or", "our", "the", "this", "to", "we", "with", "you",
  "your",
]);

const ctaPatterns: [string, RegExp][] = [
  ["book-now", /\bbook\s+now\b/u],
  ["buy-now", /\bbuy\s+now\b/u],
  ["comment", /\b(comment|tell\s+us|share\s+your\s+thoughts)\b/u],
  ["download", /\bdownload\b/u],
  ["follow", /\bfollow\b/u],
  ["learn-more", /\blearn\s+more\b/u],
  ["order-now", /\border\s+now\b/u],
  ["share", /\bshare\b/u],
  ["sign-up", /\b(sign\s+up|register)\b/u],
  ["subscribe", /\bsubscribe\b/u],
  ["visit", /\bvisit\b/u],
];

function snippet(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = (metadata as { snippet?: unknown }).snippet;
  return value && typeof value === "object" && !Array.isArray(value) ? value as {
    title?: unknown; description?: unknown;
  } : {};
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/gu, " ") : "";
}

function tokens(value: string) {
  return [...new Set(value.split(" ").filter((token) =>
    token.length > 2 && !stopWords.has(token)))].sort();
}

function hashed(values: string[]) {
  return values.map((value) => digest(value).slice(0, 16)).sort();
}

function overlap(first: Set<string>, second: Set<string>) {
  if (!first.size || !second.size) return 0;
  let shared = 0;
  for (const item of first) if (second.has(item)) shared++;
  return shared / Math.max(first.size, second.size);
}

function profile(metadata: unknown) {
  const data = snippet(metadata);
  const title = normalize(data.title);
  const description = normalize(data.description);
  const text = `${title} ${description}`.trim();
  const topicTokens = tokens(text);
  const metadataTokens = tokens(`${title} ${description}`.trim());
  const ctas = ctaPatterns.filter(([, pattern]) => pattern.test(text))
    .map(([code]) => code).sort();
  return {
    metadata: new Set(hashed(metadataTokens)),
    topics: new Set(hashed(topicTokens)),
    ctas: new Set(ctas),
    signals: {
      metadata: hashed(metadataTokens),
      topics: hashed(topicTokens),
      ctas,
    },
  };
}

export function evaluatePostingPolicy(input: {
  config: PostingPolicyConfig;
  currentMetadata: unknown;
  priors: PostingPolicyPrior[];
}) {
  const current = profile(input.currentMetadata);
  const threshold = input.config.metadataSimilarityPercent / 100;
  const topicThreshold = input.config.topicOverlapPercent / 100;
  const priorSignals = input.priors.map((prior) => {
    const priorProfile = profile(prior.metadata);
    return {
      id: prior.id,
      intentId: prior.intentId,
      status: prior.status,
      at: prior.at.toISOString(),
      metadataOverlap: overlap(current.metadata, priorProfile.metadata),
      topicOverlap: overlap(current.topics, priorProfile.topics),
      repeatedCtas: [...current.ctas].filter((cta) => priorProfile.ctas.has(cta)).sort(),
      signature: priorProfile.signals,
    };
  });
  const similarMetadata = priorSignals.filter((prior) =>
    prior.metadataOverlap >= threshold);
  const repeatedTopics = current.topics.size >= input.config.minTopicTokens ?
    priorSignals.filter((prior) =>
      prior.topicOverlap >= topicThreshold) : [];
  const ctaCounts = new Map<string, number>();
  for (const prior of priorSignals) for (const cta of prior.repeatedCtas)
    ctaCounts.set(cta, (ctaCounts.get(cta) ?? 0) + 1);
  const repeatedCtas = [...ctaCounts.entries()].filter(([, count]) =>
    count >= input.config.ctaRepeatCount).map(([cta]) => cta).sort();
  const warnings: PostingPolicyWarning[] = [];
  if (similarMetadata.length) warnings.push({ code: "SIMILAR_METADATA",
    message: "A recent or scheduled upload has similar metadata. Review for repetitive title or description patterns." });
  if (repeatedTopics.length >= input.config.topicRepeatCount)
    warnings.push({ code: "REPEATED_TOPIC_CLUSTER",
      message: "This topic appears repeatedly in recent or scheduled uploads. Check for audience fatigue before posting." });
  if (repeatedCtas.length) warnings.push({ code: "REPEATED_CTA_PATTERN",
    message: "The same call-to-action pattern appears repeatedly. Review whether the posting plan needs more variety." });
  return {
    warnings,
    signals: {
      version: "posting-policy-1",
      config: input.config,
      current: current.signals,
      matches: {
        similarMetadata: similarMetadata.map((prior) => prior.intentId).sort(),
        repeatedTopics: repeatedTopics.map((prior) => prior.intentId).sort(),
        repeatedCtas,
      },
      priors: priorSignals.map((prior) => ({
        id: prior.id,
        intentId: prior.intentId,
        status: prior.status,
        at: prior.at,
        metadataOverlapPercent: Math.round(prior.metadataOverlap * 100),
        topicOverlapPercent: Math.round(prior.topicOverlap * 100),
        repeatedCtas: prior.repeatedCtas,
        signature: prior.signature,
      })),
    },
  };
}
