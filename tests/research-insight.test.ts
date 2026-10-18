import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { parseResearchInsight } from "../packages/core/research-insight";
import { parseResearchInput } from "../packages/core/research";
import { captureResearchSnapshot, readResearchSnapshot, resolveResearchContext, assertResearchContextCurrent, ResearchContextChangedError, ResearchCandidate } from "../packages/core/research-context";
import { reviewStrategyReferences } from "../packages/core/strategy-references";
import { stableJson } from "../packages/core/requests";
import { competitorInsight, searchInsight, audienceInsight, communityInsight } from "./support/research-insight";
import { contextArtifact, buildAgentPlan } from "../packages/core/agents";
import { ModelRouter } from "../packages/core/ai";

const now = new Date(), org = randomUUID();
const candidate = (insight: unknown = searchInsight()): ResearchCandidate => ({ id: randomUUID(), organizationId: org,
  revision: 2, title: "Synthetic structured observation", category: "SEARCH", temporalScope: "CURRENT",
  summary: "Synthetic source summary, separate from analyst interpretation.", sourceUrl: "https://public.org/insight",
  sourceLabel: "Synthetic source", observedAt: new Date(now.getTime()-60000), collectedAt: new Date(now.getTime()-50000),
  reviewedAt: new Date(now.getTime()-40000), market: "India", language: "English", provenance: "MANUAL", reviewStatus: "ACCEPTED", authorizedSource: true, insight });

test("audience/community intake preserves declared scope, optional missing lists and strict manual interpretation fields", () => {
  for (const insight of [audienceInsight(), communityInsight()]) {
    assert.deepEqual(parseResearchInsight(insight, insight.kind), insight);
    assert.throws(() => parseResearchInsight(insight, "INDUSTRY"), /match/);
    for (const extra of [{ sentimentScore: 0.9 }, { count: 10 }, { personId: "fixture" }, { sourceUrl: "https://public.org/forged" }])
      assert.throws(() => parseResearchInsight({ ...insight, ...extra }, insight.kind));
  }
  const missing = { ...audienceInsight(), interests: [], questions: [], painPoints: [] };
  assert.deepEqual(parseResearchInsight(missing, "AUDIENCE"), missing);
  assert.throws(() => parseResearchInsight({ ...missing, observedNeed: " " }, "AUDIENCE"));
  assert.throws(() => parseResearchInsight({ ...communityInsight(), signal: "VERIFIED_SENTIMENT" }, "COMMUNITY"));
  assert.throws(() => parseResearchInsight({ ...communityInsight(), assumptions: "" }, "COMMUNITY"));
});

test("audience lists and community classifications enforce field, item, enum and UTF8 capacity bounds", () => {
  for (const key of ["interests", "questions", "painPoints"]) {
    assert.throws(() => parseResearchInsight({ ...audienceInsight(), [key]: Array(6).fill("fixture") }, "AUDIENCE"));
    assert.throws(() => parseResearchInsight({ ...audienceInsight(), [key]: ["x".repeat(key === "interests" ? 161 : 201)] }, "AUDIENCE"));
  }
  for (const signal of ["QUESTION", "OBJECTION", "PAIN_POINT", "REQUEST", "FEEDBACK"])
    assert.equal(parseResearchInsight({ ...communityInsight(), signal }, "COMMUNITY")?.kind, "COMMUNITY");
  for (const [key, length] of [["channelContext", 161], ["topic", 201], ["observation", 501], ["proposedResponse", 501]] as const)
    assert.throws(() => parseResearchInsight({ ...communityInsight(), [key]: "x".repeat(length) }, "COMMUNITY"));
  const oversized = { ...audienceInsight(), interests: Array(5).fill("क".repeat(160)), questions: Array(5).fill("क".repeat(200)), painPoints: Array(5).fill("क".repeat(200)) };
  assert.throws(() => parseResearchInsight(oversized, "AUDIENCE"), /6,000/);
});

test("audience/community snapshots retain assumptions, reject tampering and withdraw later edits, review loss and expiry", () => {
  for (const insight of [audienceInsight(), communityInsight()]) {
    const row = { ...candidate(insight), category: insight.kind }, snapshot = captureResearchSnapshot(org, [row], now);
    assert.deepEqual(snapshot.evidence[0].insight, insight); assert.ok(readResearchSnapshot(snapshot, org));
    for (const change of [{ insight: { ...insight, assumptions: "Edited hypothesis after capture" } }, { reviewStatus: "REJECTED" }, { organizationId: randomUUID() }])
      assert.equal(resolveResearchContext(snapshot, org, [{ ...row, ...change }], now).evidence.length, 0);
    assert.equal(resolveResearchContext(snapshot, org, [row], new Date(snapshot.evidence[0].expiresAt)).evidence.length, 0);
    assert.equal(readResearchSnapshot({ ...snapshot, evidence: [{ ...snapshot.evidence[0], insight: { ...insight, assumptions: "Forged history" } }] }, org), null);
    const invalid = captureResearchSnapshot(org, [{ ...row, insight: { ...insight, count: 123 } }], now);
    assert.equal(invalid.coverage!.rejected.invalidSource, 1);assert.equal(invalid.evidence.length, 0);
  }
});

test("audience/community analysis shares source capacity, excludes foreign bodies and cannot become a source quotation", () => {
  const insight = { ...audienceInsight(), observedNeed: "क".repeat(500), proposedResponse: "क".repeat(500), assumptions: "क".repeat(500), interests: [], questions: [], painPoints: [] };
  const rows = Array.from({ length: 10 }, () => ({ ...candidate(insight), category: "AUDIENCE" }));
  const snapshot = captureResearchSnapshot(org, [{ ...candidate(communityInsight()), category: "COMMUNITY", organizationId: randomUUID(), summary: "Private foreign interaction" }, ...rows], now);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= 24000);assert.ok(snapshot.coverage!.omitted.byteBudget > 0);
  assert.ok(!JSON.stringify(snapshot).includes("Private foreign interaction"));assert.deepEqual(snapshot.evidence[0].insight, insight);
  const context = resolveResearchContext(snapshot, org, rows, now), source = context.evidence[0];
  const checked = reviewStrategyReferences({ recommendations: [{ id: "audience", recommendation: "Test the proposal", basis: "RESEARCH", assumption: "Synthetic hypothesis",
    sourceRefs: [{ sourceId: source.id, revision: source.revision, quote: insight.proposedResponse }] }] }, context, org, now);
  assert.equal(checked.passed, false);assert.ok(checked.recommendations[0].issues.includes("QUOTE_NOT_FOUND"));
});

test("actual provider and research, audience and community agent traces receive identical scoped interpretations", async () => {
  const rows = [audienceInsight(), communityInsight()].map(insight => ({ ...candidate(insight), category: insight.kind }));
  const research = resolveResearchContext(captureResearchSnapshot(org, rows, now), org, rows, now);
  const brand = { profile: { audience: "Synthetic declared audience" }, research };
  for (const role of ["research", "audience", "community-intelligence"]) {
    const step = buildAgentPlan("strategy").steps.find(step => step.role === role)!;assert.ok(step);
    assert.deepEqual(contextArtifact(step, { brand, input: {} }).inputs.externalEvidence, research);
  }
  let calls = 0;
  const fake = (async (_url: unknown, init: RequestInit) => {
    calls++;const body=JSON.parse(String(init.body));assert.deepEqual(JSON.parse(body.messages[1].content).brand.research, research);
    assert.match(body.messages[0].content, /not population-wide facts/);assert.match(body.messages[0].content, /No interaction was collected or response sent/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Synthetic strategy", goal: "Test", audience: "Test", positioning: "Test",
      pillars: [{ name: "Test", purpose: "Explain" }], ideas: [{ title: "Test", hook: "Test", platform: "LinkedIn", format: "Text", purpose: "Explain", cta: "Read" }], cadence: "Weekly", experiments: [], assumptions: ["Synthetic fixture"] }) } }] });
  }) as typeof fetch;
  await new ModelRouter([{ name: "fixture", url: "https://fixture.test", key: "test-only", model: "fixture", qualityTier: "premium", capabilities: ["text", "json", "strategy"] }], fake).run("strategy", {}, brand, async () => {});
  assert.equal(calls, 1);
});

test("structured insight intake canonicalizes both kinds, retains assumptions and keeps legacy input optional", () => {
  const row = candidate();
  const { id, organizationId, revision, collectedAt, reviewedAt, provenance, reviewStatus, ...input } = row;
  const legacy = { ...input, observedAt: new Date(row.observedAt!).toISOString(), insight: undefined };
  assert.equal(parseResearchInput(legacy, now).insight, null);
  for (const insight of [searchInsight(), competitorInsight()]) {
    const parsed = parseResearchInput({ ...legacy, category: insight.kind, insight: { ...insight, assumptions: `  ${insight.assumptions}  ` } }, now);
    assert.deepEqual(parsed.insight, insight);
  }
});

test("structured insights reject mismatched categories, incomplete fields, unknown measurements and injected authority", () => {
  const valid = searchInsight();
  for (const bad of [{ ...valid, kind: "OTHER" }, { ...valid, query: " " }, { ...valid, assumptions: "" },
    { ...valid, intent: "VERIFIED" }, { ...valid, volume: 1000 }, { ...valid, sourceUrl: "https://public.org/forged" },
    { ...valid, reviewedBy: randomUUID() }, { ...valid, keywords: [] }, { ...valid, questions: [] }])
    assert.throws(() => parseResearchInsight(bad, "SEARCH"));
  assert.throws(() => parseResearchInsight(valid, "COMPETITOR"), /match/);
  assert.throws(() => parseResearchInsight(competitorInsight(), "INDUSTRY"), /match/);
  assert.throws(() => parseResearchInsight({ ...competitorInsight(), differentiation: "" }, "COMPETITOR"));
});

test("structured insights enforce list, field and serialized UTF8 limits without truncating analyst text", () => {
  for (const bad of [{ ...searchInsight(), keywords: Array(9).fill("x") }, { ...searchInsight(), questions: Array(6).fill("x") },
    { ...searchInsight(), keywords: ["x".repeat(81)] }, { ...searchInsight(), questions: ["x".repeat(201)] },
    { ...competitorInsight(), subject: "x".repeat(161) }, { ...competitorInsight(), assumptions: "x".repeat(501) }])
    assert.throws(() => parseResearchInsight(bad, bad.kind));
  const unicode = { ...searchInsight(), query: "क".repeat(200), keywords: Array(8).fill("क".repeat(80)),
    questions: Array(5).fill("क".repeat(200)), answerAngle: "क".repeat(500), assumptions: "क".repeat(500) };
  assert.throws(() => parseResearchInsight(unicode, "SEARCH"), /6,000/);
});

test("legacy evidence fingerprints remain byte-compatible when optional stored insight is absent or null", () => {
  const row = candidate(undefined); delete row.insight;
  const before = captureResearchSnapshot(org, [row], now);
  const { fingerprint, ...source } = before.evidence[0];
  assert.equal(Object.hasOwn(source, "insight"), false);
  assert.equal(fingerprint, createHash("sha256").update(stableJson(source)).digest("hex"));
  assert.deepEqual(captureResearchSnapshot(org, [{ ...row, insight: null }], now), before);
  assert.ok(readResearchSnapshot(before, org));
  assert.equal(resolveResearchContext(before, org, [{ ...row, insight: searchInsight() }], now).evidence.length, 0);
});

test("insights freeze with source fingerprints and cannot substitute edits, mismatched categories or forged snapshot data", () => {
  const row = candidate(), snapshot = captureResearchSnapshot(org, [row], now);
  assert.deepEqual(snapshot.evidence[0].insight, searchInsight());
  const context = resolveResearchContext(snapshot, org, [row], now);
  const changed = { ...row, insight: { ...searchInsight(), answerAngle: "Changed analysis after enqueue" } };
  assert.equal(resolveResearchContext(snapshot, org, [changed], now).evidence.length, 0);
  assert.throws(() => assertResearchContextCurrent(context, org, [changed], now), ResearchContextChangedError);
  assert.equal(readResearchSnapshot({ ...snapshot, evidence: [{ ...snapshot.evidence[0], insight: changed.insight }] }, org), null);
  for (const invalid of [competitorInsight(), { ...searchInsight(), volume: 123 }]) {
    const result = captureResearchSnapshot(org, [{ ...row, insight: invalid }], now);
    assert.equal(result.evidence.length, 0); assert.equal(result.coverage!.rejected.invalidSource, 1);
  }
});

test("full structured insights share the snapshot byte budget and omitted or foreign analysis never leaks", () => {
  const insight = { ...searchInsight(), answerAngle: "क".repeat(500), assumptions: "क".repeat(500) };
  const rows = Array.from({ length: 10 }, () => candidate(insight));
  const snapshot = captureResearchSnapshot(org, [{ ...candidate(), organizationId: randomUUID(), summary: "foreign secret" }, ...rows], now);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= 24000);
  assert.ok(snapshot.coverage!.omitted.byteBudget > 0);
  assert.ok(snapshot.evidence.length > 0 && snapshot.evidence.length < 10);
  assert.deepEqual(snapshot.evidence[0].insight, insight);
  assert.ok(!JSON.stringify(snapshot).includes("foreign secret")); assert.ok(readResearchSnapshot(snapshot, org));
});

test("analyst interpretation is never accepted as a source quote and uncertainty policy remains explicit", () => {
  const row = candidate(), context = resolveResearchContext(captureResearchSnapshot(org, [row], now), org, [row], now);
  assert.match(context.policy, /analyst interpretations/); assert.match(context.policy, /without copying/);
  assert.match(context.policy, /not measured demand/);
  const result = reviewStrategyReferences({ recommendations: [{ id: "test", recommendation: "Test the hypothesis", basis: "RESEARCH",
    sourceRefs: [{ sourceId: row.id, revision: row.revision, quote: searchInsight().answerAngle }], assumption: "Synthetic fixture" }] }, context, org, now);
  assert.equal(result.passed, false); assert.ok(result.recommendations[0].issues.includes("QUOTE_NOT_FOUND"));
});
