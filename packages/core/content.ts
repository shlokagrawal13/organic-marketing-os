import { z } from "zod";
import { draftSchema } from "./ai";
export const contentInput = draftSchema
  .extend({
    campaignId: z.string().uuid().nullable().default(null),
    plannedAt: z.string().datetime().nullable().default(null),
  })
  .strict();
export function checkContent(content: z.infer<typeof draftSchema>) {
  const checks: { label: string; severity: "pass" | "warning" | "block" }[] =
    [];
  checks.push({
    label: content.title.trim() ? "Title is present" : "Add a title",
    severity: content.title.trim() ? "pass" : "block",
  });
  const text = [
    content.hook,
    content.body,
    content.cta,
    ...content.scenes.map((s) => s.voiceover),
  ].join(" ");
  const exists =
    content.body.trim().length > 0 ||
    content.scenes.some((s) => s.voiceover.trim());
  checks.push({
    label: exists ? "Content is present" : "Add copy or a scene voiceover",
    severity: exists ? "pass" : "block",
  });
  const overclaim =
    /guaranteed\s+(viral|results|returns)|100%\s+(guaranteed|effective)|will go viral/i.test(
      text,
    );
  checks.push({
    label: overclaim
      ? "Remove unsupported guarantees"
      : "No obvious guaranteed-results language detected",
    severity: overclaim ? "block" : "pass",
  });
  checks.push({
    label: content.cta.trim()
      ? "Call to action is present"
      : "Consider adding a call to action",
    severity: content.cta.trim() ? "pass" : "warning",
  });
  if (content.format === "Video")
    checks.push({
      label: content.scenes.length
        ? "Storyboard scenes are present"
        : "Add storyboard scenes",
      severity: content.scenes.length ? "pass" : "block",
    });
  const unique =
    new Set(content.scenes.map((s) => s.id)).size === content.scenes.length;
  checks.push({
    label: unique
      ? "Scene identifiers are unique"
      : "Duplicate scene identifiers",
    severity: unique ? "pass" : "block",
  });
  checks.push({
    label:
      "Human review required for facts, rights, brand fit and platform rules",
    severity: "warning",
  });
  return { passed: !checks.some((c) => c.severity === "block"), checks };
}
