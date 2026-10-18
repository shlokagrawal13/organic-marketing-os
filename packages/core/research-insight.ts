import { z } from "zod";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
export const searchIntents = ["INFORMATIONAL", "COMMERCIAL", "NAVIGATIONAL", "TRANSACTIONAL"] as const;
export const communitySignals = ["QUESTION", "OBJECTION", "PAIN_POINT", "REQUEST", "FEEDBACK"] as const;
export const insightCategories = ["COMPETITOR", "SEARCH", "AUDIENCE", "COMMUNITY"] as const;
export const researchInsightSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("COMPETITOR"), subject: text(160), contentTheme: text(300),
    format: text(120), positioning: text(500), opportunity: text(500),
    differentiation: text(500), assumptions: text(500),
  }).strict(),
  z.object({
    kind: z.literal("SEARCH"), query: text(200), intent: z.enum(searchIntents),
    keywords: z.array(text(80)).min(1).max(8), questions: z.array(text(200)).min(1).max(5),
    answerAngle: text(500), assumptions: text(500),
  }).strict(),
  z.object({
    kind: z.literal("AUDIENCE"), segment: text(160), observedNeed: text(500),
    interests: z.array(text(160)).max(5), questions: z.array(text(200)).max(5),
    painPoints: z.array(text(200)).max(5), proposedResponse: text(500), assumptions: text(500),
  }).strict(),
  z.object({
    kind: z.literal("COMMUNITY"), channelContext: text(160), signal: z.enum(communitySignals),
    topic: text(200), observation: text(500), proposedResponse: text(500), assumptions: text(500),
  }).strict(),
]);
export type ResearchInsight = z.infer<typeof researchInsightSchema>;

/** Analyst interpretation attached to one cited observation, never measured demand or verified facts. */
export function parseResearchInsight(value: unknown, category: string): ResearchInsight | null {
  if (value == null) return null;
  const insight = researchInsightSchema.parse(value);
  if (insight.kind !== category) throw new Error("Insight type must match the research category.");
  // Browser-safe UTF-8 bound, including JSON escaping and multi-byte scripts.
  if (new TextEncoder().encode(JSON.stringify(insight)).length > 6000)
    throw new Error("Structured insight must fit within 6,000 UTF-8 bytes.");
  return insight;
}
