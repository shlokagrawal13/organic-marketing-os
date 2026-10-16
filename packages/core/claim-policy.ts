import { digest } from "./security";

export const claimPolicyVersion = "bounded-claims-2026-10-15-evidence-2";
export const claimPolicyDisclaimer =
  "This bounded detector only flags selected claim patterns. A source link does not prove truth, source quality, legal compliance or platform compliance; human review remains required.";

export type ClaimKind = "NUMERIC_RESULT" | "COMPARATIVE" | "PROOF_ASSERTION";
export type ClaimSignal = {
  id: string;
  kind: ClaimKind;
  location: string;
  excerpt: string;
};
export type ClaimPolicyContent = {
  title: string;
  hook: string;
  body: string;
  cta: string;
  scenes: Array<{
    voiceover?: string;
    onScreenText?: string;
    caption?: string;
    cta?: string;
  }>;
};

const rules: Array<{ kind: ClaimKind; pattern: RegExp }> = [
  {
    kind: "NUMERIC_RESULT",
    pattern:
      /(?:\b\d+(?:\.\d+)?\s*%(?!\w)|\b\d+(?:\.\d+)?\s*(?:x\b|times\b)|(?:₹|\$|€|£)\s*\d[\d,.]*(?=\s|$)|\b\d+(?:\.\d+)?\s+(?:days?|weeks?|months?|years?|users?|customers?|sales?|revenue|leads?|roi\b))/giu,
  },
  {
    kind: "COMPARATIVE",
    pattern:
      /\b(?:best|fastest|leading|most\s+effective|top[- ]rated|number\s+one|#1|outperform(?:s|ed|ing)?|better\s+than|more\s+effective\s+than)\b/giu,
  },
  {
    kind: "PROOF_ASSERTION",
    pattern:
      /\b(?:clinically\s+proven|scientifically\s+proven|research[- ]backed|proven\s+to|certified|award[- ]winning)\b/giu,
  },
];

const fields = (content: ClaimPolicyContent) =>
  [
    ["title", content.title],
    ["hook", content.hook],
    ["body", content.body],
    ["cta", content.cta],
    ...content.scenes.flatMap((scene, index) => [
      [`scenes[${index}].voiceover`, scene.voiceover || ""],
      [`scenes[${index}].onScreenText`, scene.onScreenText || ""],
      [`scenes[${index}].caption`, scene.caption || ""],
      [`scenes[${index}].cta`, scene.cta || ""],
    ]),
  ] as Array<[string, string]>;

const excerptAround = (text: string, start: number, length: number) => {
  const from = Math.max(0, start - 48);
  const to = Math.min(text.length, start + length + 48);
  return text.slice(from, to).replace(/\s+/gu, " ").trim();
};

export function detectClaimSignals(content: ClaimPolicyContent): ClaimSignal[] {
  const found: ClaimSignal[] = [];
  const seen = new Set<string>();
  for (const [location, text] of fields(content)) {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        const excerpt = excerptAround(text, match.index || 0, match[0].length);
        const identity = `${rule.kind}\u0000${location}\u0000${match[0].toLocaleLowerCase("en-US")}\u0000${match.index}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        found.push({
          id: digest(`${claimPolicyVersion}\u0000${identity}`),
          kind: rule.kind,
          location,
          excerpt,
        });
        if (found.length === 50) return found;
      }
    }
  }
  return found;
}

export const claimSetFingerprint = (claims: ClaimSignal[]) =>
  digest(
    JSON.stringify({
      policyVersion: claimPolicyVersion,
      claims: claims.map(({ id, kind, location, excerpt }) => ({
        id,
        kind,
        location,
        excerpt,
      })),
    }),
  );

export function evaluateClaimPolicy(content: ClaimPolicyContent) {
  const claims = detectClaimSignals(content);
  return {
    policyVersion: claimPolicyVersion,
    claimSetFingerprint: claimSetFingerprint(claims),
    claims,
    disclaimer: claimPolicyDisclaimer,
  };
}
