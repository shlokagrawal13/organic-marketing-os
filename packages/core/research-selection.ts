import { z } from "zod";

// Kept browser-safe: selection controls never import server crypto or database code.
export const strategyResearchCategories = ["INDUSTRY", "AUDIENCE", "COMPETITOR", "SEARCH", "SEASONAL", "COMMUNITY"] as const;
export const researchSelectionSchema = z.object({
  categories: z.array(z.enum(strategyResearchCategories)).max(6).default([])
    .transform(values => [...new Set(values)].sort()),
  market: z.string().trim().max(100).default("").transform(value => value.toLowerCase()).pipe(z.string().max(100)),
  language: z.string().trim().max(80).default("").transform(value => value.toLowerCase()).pipe(z.string().max(80)),
}).strict();
export type ResearchSelection = z.infer<typeof researchSelectionSchema>;
export function matchesResearchSelection(row: { category: string; market: string; language: string }, selection: ResearchSelection) {
  return (!selection.categories.length || selection.categories.includes(row.category as any)) &&
    (!selection.market || row.market.toLowerCase() === selection.market) &&
    (!selection.language || row.language.toLowerCase() === selection.language);
}
// Prisma's PostgreSQL insensitive equals uses ILIKE: user %/_/backslash must be literal.
export function researchSelectionWhere(selection: ResearchSelection) {
  const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");
  return {
    ...(selection.categories.length ? { category: { in: selection.categories } } : {}),
    ...(selection.market ? { market: { equals: literal(selection.market), mode: "insensitive" as const } } : {}),
    ...(selection.language ? { language: { equals: literal(selection.language), mode: "insensitive" as const } } : {}),
  };
}
