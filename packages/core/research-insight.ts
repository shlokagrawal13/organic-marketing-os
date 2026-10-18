import { z } from "zod";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
export const searchIntents = ["INFORMATIONAL", "COMMERCIAL", "NAVIGATIONAL", "TRANSACTIONAL"] as const;
export const communitySignals = ["QUESTION", "OBJECTION", "PAIN_POINT", "REQUEST", "FEEDBACK"] as const;
export const calendarEventTypes = ["FESTIVAL", "HOLIDAY", "INDUSTRY_EVENT", "SEASONAL_DEMAND", "PRODUCT_LAUNCH", "PROMOTION", "IMPORTANT_DATE", "BUSINESS_EVENT"] as const;
export const calendarDateStatuses = ["UNKNOWN", "DECLARED"] as const;
export const insightCategories = ["COMPETITOR", "SEARCH", "AUDIENCE", "COMMUNITY", "SEASONAL", "INDUSTRY"] as const;
const calendarDate = z.string().regex(/^(?:|[0-9]{4}-[0-9]{2}-[0-9]{2})$/);
export const researchInsightSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("INDUSTRY"), topic: text(200), observedPattern: text(500),
    businessRelevance: text(500), proposedOpportunity: text(500),
    counterSignals: z.array(text(200)).max(5), assumptions: text(500),
  }).strict(),
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
    kind: z.literal("SEASONAL"), eventName: text(160), eventType: z.enum(calendarEventTypes),
    dateStatus: z.enum(calendarDateStatuses), startDate: calendarDate, endDate: calendarDate,
    timeZone: z.string().trim().max(100), culturalContext: text(500), businessRelevance: text(500),
    proposedOpportunity: text(500), assumptions: text(500),
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
  if (insight.kind === "SEASONAL") {
    for (const date of [insight.startDate, insight.endDate]) {
      if (date && (date < "0001-01-01" || !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date))
        throw new Error("Use real calendar dates in YYYY-MM-DD format.");
    }
    if (insight.dateStatus === "UNKNOWN" ? !!(insight.startDate || insight.endDate) :
      !insight.startDate || !insight.endDate || insight.endDate < insight.startDate)
      throw new Error("Unknown timing must have empty dates; declared timing requires an ordered start and end date.");
    if (insight.timeZone) {
      // Require named zones, rather than runtime-dependent numeric offsets.
      if (!/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/.test(insight.timeZone))
        throw new Error("Use a named IANA time zone or leave it unknown.");
      try { new Intl.DateTimeFormat("en", { timeZone: insight.timeZone }).format(0); }
      catch { throw new Error("Use a valid IANA time zone or leave it unknown."); }
    }
  }
  // Browser-safe UTF-8 bound, including JSON escaping and multi-byte scripts.
  if (new TextEncoder().encode(JSON.stringify(insight)).length > 6000)
    throw new Error("Structured insight must fit within 6,000 UTF-8 bytes.");
  return insight;
}

/** Inclusive declared local dates only; unknown timing/zone never implies a current event. */
export function seasonalWindowElapsed(value: unknown, now = new Date()): boolean {
  const insight = parseResearchInsight(value, "SEASONAL");
  if (!insight || insight.kind !== "SEASONAL" || insight.dateStatus !== "DECLARED" || !insight.timeZone) return false;
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid calendar clock.");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: insight.timeZone, calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}` > insight.endDate;
}
