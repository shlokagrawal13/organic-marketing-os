import { z } from "zod";
import { readResearchSnapshot, ResearchContext } from "./research-context";

export const strategyRecommendationSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  recommendation: z.string().trim().min(1).max(2000),
  basis: z.enum(["RESEARCH", "ASSUMPTION"]),
  sourceRefs: z.array(z.object({
    sourceId: z.string().min(1).max(100), revision: z.number().int().positive(),
    quote: z.string().min(1).max(2000),
  }).strict()).max(3),
  assumption: z.string().max(1000),
}).strict();
export const strategyRecommendationsSchema = z.array(strategyRecommendationSchema).min(1).max(12);
export type StrategyRecommendation = z.infer<typeof strategyRecommendationSchema>;
export const strategyReferenceVersion = "strategy-references-2026-10-18";
const policy = "Checks match source identities, captured revisions and exact excerpts only. They do not establish factual truth, relevance or that an excerpt supports a recommendation. Review all strategy claims and assumptions before approval.";

/** Resolve links from server-captured evidence, never model-supplied URLs. */
export function reviewStrategyReferences(value: { recommendations?: StrategyRecommendation[] }, research: unknown,
  organizationId: string, now = new Date()) {
  const context = research as ResearchContext | null | undefined;
  const saved = context && context.status === "AVAILABLE" ? readResearchSnapshot({
    version: context.version, organizationId, capturedAt: context.capturedAt, evidence: context.evidence,
    ...(context.selection ? { selection: context.selection } : {}),
  }, organizationId) : null;
  const evidence = saved && new Date(saved.capturedAt) <= now ? saved.evidence : [];
  const parsed = strategyRecommendationsSchema.safeParse(value.recommendations);
  const checkedAt = now.toISOString();
  if (!parsed.success) return { version: strategyReferenceVersion, status: "MISSING" as const,
    passed: false, checkedAt, policy, recommendations: [], issues: ["MISSING_RECOMMENDATIONS"] };
  const seen = new Set<string>();
  const recommendations = parsed.data.map((item, index) => {
    const issues: string[] = [], references: { sourceId: string; revision: number; quote: string; sourceUrl: string; sourceLabel: string }[] = [];
    if (seen.has(item.id)) issues.push("DUPLICATE_RECOMMENDATION"); seen.add(item.id);
    if (item.basis === "ASSUMPTION") {
      if (!item.assumption.trim()) issues.push("ASSUMPTION_REQUIRED");
      if (item.sourceRefs.length) issues.push("UNEXPECTED_REFERENCES");
    } else if (!item.sourceRefs.length) issues.push("MISSING_REFERENCES");
    const seenRefs = new Set<string>();
    for (const ref of item.sourceRefs) {
      if (seenRefs.has(ref.sourceId)) { issues.push("DUPLICATE_REFERENCE"); continue; }
      seenRefs.add(ref.sourceId);
      const source = evidence.find(source => source.id === ref.sourceId);
      if (!source) { issues.push("UNKNOWN_SOURCE"); continue; }
      if (source.revision !== ref.revision) { issues.push("REVISION_MISMATCH"); continue; }
      if (now.getTime() >= new Date(source.expiresAt).getTime()) { issues.push("EXPIRED_SOURCE"); continue; }
      if (Array.from(ref.quote.trim()).length < 8) { issues.push("QUOTE_TOO_SHORT"); continue; }
      if (!source.summary.includes(ref.quote)) { issues.push("QUOTE_NOT_FOUND"); continue; }
      references.push({ sourceId: source.id, revision: source.revision, quote: ref.quote,
        sourceUrl: source.sourceUrl, sourceLabel: source.sourceLabel });
    }
    return { index, id: item.id, status: issues.length ? "BLOCKED" : item.basis === "ASSUMPTION" ? "ASSUMPTION" : "MATCHED_REFERENCES",
      issues: [...new Set(issues)], references };
  });
  const passed = recommendations.every(item => !item.issues.length);
  return { version: strategyReferenceVersion, status: passed ? "PASSED" as const : "BLOCKED" as const,
    passed, checkedAt, policy, recommendations, issues: [] };
}
