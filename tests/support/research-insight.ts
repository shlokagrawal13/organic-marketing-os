// Synthetic fixture analysis only, never business analytics or real competitor/search findings.
export const competitorInsight = () => ({ kind: "COMPETITOR" as const, subject: "Synthetic competitor",
  contentTheme: "Synthetic how-to demonstrations", format: "Short tutorial", positioning: "A hypothetical beginner-friendly approach",
  opportunity: "Test an original worked example", differentiation: "Use our own workflow and original examples",
  assumptions: "Synthetic fixture; one observation does not establish market demand." });
export const searchInsight = () => ({ kind: "SEARCH" as const, query: "Synthetic workflow question", intent: "INFORMATIONAL" as const,
  keywords: ["synthetic workflow", "synthetic example"], questions: ["How would a synthetic workflow work?"],
  answerAngle: "Test an original concise explanation followed by a worked example",
  assumptions: "Synthetic fixture; no measured search volume, traffic or ranking evidence." });
