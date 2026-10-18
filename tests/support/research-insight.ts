// Synthetic fixture analysis only, never business analytics or real competitor/search findings.
export const competitorInsight = () => ({ kind: "COMPETITOR" as const, subject: "Synthetic competitor",
  contentTheme: "Synthetic how-to demonstrations", format: "Short tutorial", positioning: "A hypothetical beginner-friendly approach",
  opportunity: "Test an original worked example", differentiation: "Use our own workflow and original examples",
  assumptions: "Synthetic fixture; one observation does not establish market demand." });
export const searchInsight = () => ({ kind: "SEARCH" as const, query: "Synthetic workflow question", intent: "INFORMATIONAL" as const,
  keywords: ["synthetic workflow", "synthetic example"], questions: ["How would a synthetic workflow work?"],
  answerAngle: "Test an original concise explanation followed by a worked example",
  assumptions: "Synthetic fixture; no measured search volume, traffic or ranking evidence." });
export const audienceInsight = () => ({ kind: "AUDIENCE" as const, segment: "Synthetic first-time operators",
  observedNeed: "Synthetic source described difficulty choosing a first step", interests: ["Synthetic worked examples"],
  questions: ["Where could a synthetic operator start?"], painPoints: ["Unclear first step in a synthetic workflow"],
  proposedResponse: "Test an original beginner checklist", assumptions: "Synthetic fixture; not representative of all operators." });
export const communityInsight = () => ({ kind: "COMMUNITY" as const, channelContext: "Synthetic public discussion",
  signal: "OBJECTION" as const, topic: "Synthetic setup effort", observation: "Synthetic source raised an objection about setup effort",
  proposedResponse: "Test an original explanation of setup steps and limits", assumptions: "Synthetic fixture; no verified frequency, sentiment or individual profile." });

export const seasonalInsight = () => ({ kind: "SEASONAL" as const, eventName: "Synthetic business event", eventType: "BUSINESS_EVENT" as const,
  dateStatus: "UNKNOWN" as const, startDate: "", endDate: "", timeZone: "",
  culturalContext: "Synthetic local context; customs are not verified.", businessRelevance: "Test relevance to the synthetic business.",
  proposedOpportunity: "Test an original event-related explanation after confirming timing.", assumptions: "Synthetic fixture; dates, zone, demand and cultural relevance are unverified." });
