import { z } from "zod";
const text = z.string().trim().max(4000).default("");
const short = z.string().trim().max(300).default("");
export const brandProfile = z
  .object({
    name: z.string().trim().min(2).max(100),
    businessType: short,
    industry: short,
    website: z.union([z.string().url().max(500), z.literal("")]).default(""),
    products: text,
    pricing: text,
    offers: text,
    audience: text,
    problems: text,
    benefits: text,
    usp: text,
    competitors: text,
    market: short,
    languages: short,
    goals: text,
    platforms: z
      .array(
        z.enum([
          "Instagram",
          "Facebook",
          "YouTube",
          "LinkedIn",
          "X",
          "Telegram",
          "Pinterest",
          "TikTok",
        ]),
      )
      .max(8)
      .default([]),
  })
  .strict();
export const creativeDna = z
  .object({
    voice: text,
    vocabulary: text,
    avoid: text,
    humor: short,
    storytelling: text,
    visualStyle: text,
    colors: z
      .array(z.string().regex(/^#[a-fA-F0-9]{6}$/))
      .max(6)
      .default([]),
    typography: short,
    editingStyle: text,
    pacing: short,
    music: short,
    captionStyle: text,
    thumbnailStyle: text,
    hookStyle: text,
    ctaStyle: text,
  })
  .strict();
export const brandInput = z
  .object({
    profile: brandProfile,
    creativeDna,
    revision: z.number().int().min(0),
  })
  .strict();
export function completeness(profile: unknown, dna: unknown) {
  const p = (profile as Record<string, unknown>) || {},
    d = (dna as Record<string, unknown>) || {};
  const steps = [
    { label: "Business details", done: !!(p.name && p.industry && p.products) },
    { label: "Audience and needs", done: !!(p.audience && p.problems) },
    { label: "Positioning and goals", done: !!(p.usp && p.goals) },
    { label: "Creative identity", done: !!(d.voice && d.visualStyle) },
  ];
  return {
    steps,
    percent: Math.round(
      (steps.filter((s) => s.done).length / steps.length) * 100,
    ),
  };
}
