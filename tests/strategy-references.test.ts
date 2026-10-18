import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { captureResearchSnapshot, resolveResearchContext, ResearchCandidate } from "../packages/core/research-context";
import { reviewStrategyReferences, StrategyRecommendation, strategyRecommendationsSchema } from "../packages/core/strategy-references";
import { ModelRouter, strategySchema } from "../packages/core/ai";
import { reviewAgentOutput } from "../packages/core/agents";

const org = randomUUID(), now = new Date();
function fixture(summary = "Synthetic audience observation: people asked for a clear example.") {
  const row: ResearchCandidate = { id: randomUUID(), organizationId: org, revision: 2, title: "Synthetic observation",
    category: "AUDIENCE", temporalScope: "CURRENT", summary, sourceUrl: "https://public.org/research",
    sourceLabel: "Synthetic source", observedAt: new Date(now.getTime() - 60000), collectedAt: new Date(now.getTime() - 50000),
    reviewedAt: new Date(now.getTime() - 40000), market: "India", language: "English", provenance: "MANUAL", authorizedSource: true, reviewStatus: "ACCEPTED" };
  const context = resolveResearchContext(captureResearchSnapshot(org, [row], now), org, [row], now);
  const recommendation: StrategyRecommendation = { id: "explain", recommendation: "Test a post with a clear example", basis: "RESEARCH",
    sourceRefs: [{ sourceId: row.id, revision: row.revision, quote: "people asked for a clear example" }], assumption: "The observation may not represent all audiences" };
  return { row, context, recommendation };
}
const output = (recommendations?: StrategyRecommendation[]) => ({ title: "Synthetic strategy", goal: "Test", audience: "Test", positioning: "Test",
  pillars: [{ name: "Education", purpose: "Explain" }], ideas: [{ title: "Test idea", hook: "Test hook", platform: "LinkedIn", format: "Text", purpose: "Explain", cta: "Read" }],
  cadence: "Weekly", experiments: [], assumptions: ["Synthetic fixture"], ...(recommendations ? { recommendations } : {}) });

test("references resolve only captured identities, revisions, exact excerpts and server citation links", () => {
  const { context, recommendation } = fixture(); const before = JSON.stringify(context);
  const result = reviewStrategyReferences(output([recommendation]), context, org, now);
  assert.equal(result.passed, true); assert.equal(result.recommendations[0].status, "MATCHED_REFERENCES");
  assert.equal(result.recommendations[0].references[0].sourceUrl, "https://public.org/research");
  assert.match(result.policy, /do not establish factual truth/); assert.equal(JSON.stringify(context), before);
  assert.equal(reviewAgentOutput("strategy", output([recommendation]), context, org).passed, true);
});
test("unknown, other-context and mismatched source revisions block review", () => {
  const { context, recommendation } = fixture();
  for (const [change, code] of [[{ sourceId: randomUUID() }, "UNKNOWN_SOURCE"], [{ revision: 3 }, "REVISION_MISMATCH"]] as const) {
    const result = reviewStrategyReferences(output([{ ...recommendation, sourceRefs: [{ ...recommendation.sourceRefs[0], ...change }] }]), context, org, now);
    assert.equal(result.passed, false); assert.ok(result.recommendations[0].issues.includes(code));
  }
  assert.equal(reviewStrategyReferences(output([recommendation]), fixture().context, org, now).passed, false);
});
test("fabricated, altered, trivial and uncaptured truncated excerpts cannot pass", () => {
  const { context, recommendation } = fixture("people asked for a clear example " + "x".repeat(1100) + " secret uncaptured ending");
  for (const quote of ["Fabricated quotation", "People asked for a clear example", "people", "secret uncaptured ending"]) {
    const result = reviewStrategyReferences(output([{ ...recommendation, sourceRefs: [{ ...recommendation.sourceRefs[0], quote }] }]), context, org, now);
    assert.equal(result.passed, false); assert.equal(result.recommendations[0].references.length, 0);
  }
});
test("missing recommendation declarations and research without references block approval while legacy shape stays readable", () => {
  const { context, recommendation } = fixture();assert.ok(strategySchema.safeParse(output()).success);
  const missing = reviewAgentOutput("strategy", output(), context, org);assert.equal(missing.passed, false);
  assert.ok(missing.findings.some(item => item.severity === "block"));
  assert.equal(reviewStrategyReferences(output([{ ...recommendation, sourceRefs: [] }]), context, org, now).passed, false);
});
test("assumptions require a visible gap/test explanation and cannot claim research references", () => {
  const { recommendation } = fixture(); const assumption: StrategyRecommendation = { ...recommendation, basis: "ASSUMPTION", sourceRefs: [], assumption: "No evidence supplied; test this hypothesis" };
  assert.equal(reviewStrategyReferences(output([assumption]), undefined, org, now).recommendations[0].status, "ASSUMPTION");
  for (const bad of [{ ...assumption, assumption: "   " }, { ...assumption, sourceRefs: recommendation.sourceRefs }])
    assert.equal(reviewStrategyReferences(output([bad]), undefined, org, now).passed, false);
});
test("duplicate recommendation IDs and duplicate source references cannot hide review findings", () => {
  const { context, recommendation } = fixture();
  assert.equal(reviewStrategyReferences(output([recommendation, recommendation]), context, org, now).passed, false);
  const result = reviewStrategyReferences(output([{ ...recommendation, sourceRefs: [...recommendation.sourceRefs, ...recommendation.sourceRefs] }]), context, org, now);
  assert.ok(result.recommendations[0].issues.includes("DUPLICATE_REFERENCE"));assert.equal(result.passed, false);
});
test("expiry uses the exact clock boundary and corrupt/future contexts fail closed", () => {
  const { context, recommendation } = fixture();const expiry = new Date(context.evidence[0].expiresAt);
  assert.equal(reviewStrategyReferences(output([recommendation]), context, org, new Date(expiry.getTime() - 1)).passed, true);
  const expired = reviewStrategyReferences(output([recommendation]), context, org, expiry);
  assert.ok(expired.recommendations[0].issues.includes("EXPIRED_SOURCE"));
  for (const corrupt of [{ ...context, evidence: [{ ...context.evidence[0], summary: "tampered" }] }, { ...context, capturedAt: new Date(now.getTime() + 1000).toISOString() }])
    assert.equal(reviewStrategyReferences(output([recommendation]), corrupt, org, now).passed, false);
});
test("actual ModelRouter response retains structured references for the agent approval gate", async () => {
  const { context, recommendation } = fixture();const generated = output([recommendation]);
  const fake = (async (_url: unknown, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));assert.match(payload.messages[0].content, /exact, unchanged excerpt/);
    assert.deepEqual(JSON.parse(payload.messages[1].content).brand.research, context);
    return Response.json({ choices: [{ message: { content: JSON.stringify(generated) } }] });
  }) as typeof fetch;
  const result = await new ModelRouter([{ name: "fixture", url: "https://fixture.test", key: "test-only", model: "fixture", capabilities: ["text", "json", "strategy"], qualityTier: "premium" }], fake)
    .run("strategy", { prompt: "Synthetic strategy" }, { research: context }, async () => {});
  assert.deepEqual(result, generated);assert.equal(reviewAgentOutput("strategy", result, context, org).passed, true);
  const content = { title: "Synthetic draft", platform: "LinkedIn", format: "Text", hook: "Test hook", body: "Synthetic test body", cta: "Read", scenes: [] };
  const contentFetch = (async (_url: unknown, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));assert.ok(!payload.messages[0].content.includes("Return 1–12 recommendations"));
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  }) as typeof fetch;
  const contentResult = await new ModelRouter([{ name: "fixture", url: "https://fixture.test", key: "test-only", model: "fixture" }], contentFetch)
    .run("content", { prompt: "Synthetic draft" }, {}, async () => {});
  assert.deepEqual(contentResult, content);
});
test("recommendations and references are bounded and model-supplied citation URLs are rejected", () => {
  const { recommendation } = fixture();
  assert.equal(strategyRecommendationsSchema.safeParse(Array(13).fill(recommendation)).success, false);
  assert.equal(strategyRecommendationsSchema.safeParse([{ ...recommendation, sourceRefs: Array(4).fill(recommendation.sourceRefs[0]) }]).success, false);
  assert.equal(strategyRecommendationsSchema.safeParse([{ ...recommendation, sourceRefs: [{ ...recommendation.sourceRefs[0], sourceUrl: "https://invented.test" }] }]).success, false);
  assert.equal(strategyRecommendationsSchema.safeParse([{ ...recommendation, sourceRefs: [{ ...recommendation.sourceRefs[0], quote: "x".repeat(2001) }] }]).success, false);
});
