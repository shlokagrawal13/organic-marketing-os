import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseResearchInsight } from "../packages/core/research-insight";
import { parseResearchInput, researchMaximumAgeMs, researchTemporalScopes } from "../packages/core/research";
import { captureResearchSnapshot, readResearchSnapshot, resolveResearchContext, assertResearchContextCurrent, ResearchContextChangedError, ResearchCandidate } from "../packages/core/research-context";
import { reviewStrategyReferences } from "../packages/core/strategy-references";
import { industryInsight } from "./support/research-insight";
const now = new Date(), org = randomUUID();
const candidate = (insight: unknown = industryInsight()): ResearchCandidate => ({ id: randomUUID(), organizationId: org, revision: 2,
  title: "Synthetic industry observation", category: "INDUSTRY", temporalScope: "CURRENT", summary: "Synthetic source described a workflow change.",
  sourceUrl: "https://public.org/industry", sourceLabel: "Synthetic source", observedAt: new Date(now.getTime()-60000), collectedAt: new Date(now.getTime()-50000),
  reviewedAt: new Date(now.getTime()-40000), market: "India", language: "English", provenance: "MANUAL", reviewStatus: "ACCEPTED", authorizedSource: true, insight });

test("industry intake keeps source-scoped hypotheses and unknown counter-signals explicit and rejects fabricated authority", () => {
  const insight = industryInsight();assert.deepEqual(parseResearchInsight(insight, "INDUSTRY"), insight);
  assert.throws(() => parseResearchInsight(insight, "SEARCH"));
  for (const extra of [{ momentum: 99 }, { measuredDemand: 1000 }, { forecast: "Guaranteed growth" }, { verifiedTrend: true }, { temporalScope: "CURRENT" }])
    assert.throws(() => parseResearchInsight({ ...insight, ...extra }, "INDUSTRY"));
  for (const key of ["topic", "observedPattern", "businessRelevance", "proposedOpportunity", "assumptions"])
    assert.throws(() => parseResearchInsight({ ...insight, [key]: " " }, "INDUSTRY"));
  assert.throws(() => parseResearchInsight({ ...insight, counterSignals: undefined }, "INDUSTRY"));
  const row=candidate();assert.deepEqual(parseResearchInput({ title: row.title, category: row.category, temporalScope: row.temporalScope, summary: row.summary,
    sourceUrl: row.sourceUrl, sourceLabel: row.sourceLabel, observedAt: new Date(row.observedAt!).toISOString(), authorizedSource: true,
    insight: { ...insight, observedPattern: `  ${insight.observedPattern}  ` } },now).insight,insight);
});

test("industry scalar/list/UTF8 bounds reject oversized interpretation without truncation or silently inventing counter-signals", () => {
  const insight=industryInsight();
  for (const [key,length] of [["topic",201],["observedPattern",501],["businessRelevance",501],["proposedOpportunity",501],["assumptions",501]] as const)
    assert.throws(()=>parseResearchInsight({ ...insight,[key]:"x".repeat(length) },"INDUSTRY"));
  for (const counterSignals of [Array(6).fill("Synthetic alternative"),["x".repeat(201)],[""]])
    assert.throws(()=>parseResearchInsight({ ...insight,counterSignals },"INDUSTRY"));
  assert.deepEqual(parseResearchInsight({ ...insight,counterSignals:["One source may be unrepresentative"] },"INDUSTRY")?.kind,"INDUSTRY");
  assert.throws(()=>parseResearchInsight({ ...insight,observedPattern:"क".repeat(500),businessRelevance:"क".repeat(500),proposedOpportunity:"क".repeat(500),assumptions:"क".repeat(500) },"INDUSTRY"),/6,000/);
});

test("industry hypotheses preserve five temporal scopes and source review cannot renew expired observations", () => {
  for (const temporalScope of researchTemporalScopes) {
    const row={ ...candidate(),temporalScope },snap=captureResearchSnapshot(org,[row],now),eligible=["CURRENT","EVERGREEN","EMERGING"].includes(temporalScope);
    assert.equal(snap.evidence.length,eligible?1:0,temporalScope);
    if (eligible) {
      assert.equal(snap.evidence[0].temporalScope,temporalScope);assert.ok(readResearchSnapshot(snap,org));
      assert.equal(resolveResearchContext(snap,org,[row],new Date(new Date(row.observedAt!).getTime()+researchMaximumAgeMs)).evidence.length,0);
    } else assert.equal(snap.coverage!.rejected[temporalScope==="HISTORICAL"?"timeScope":"expired"],1);
    const old={ ...row,observedAt:new Date(now.getTime()-researchMaximumAgeMs),reviewedAt:now };
    assert.equal(captureResearchSnapshot(org,[old],now).evidence.length,0);
  }
});

test("industry counter-signal and scope edits withdraw queued evidence, fail provider boundary and leave captured history immutable", () => {
  const row=candidate(),snap=captureResearchSnapshot(org,[row],now),context=resolveResearchContext(snap,org,[row],now);
  for (const change of [{ insight:{ ...industryInsight(),counterSignals:["Later synthetic alternative"] } },{ temporalScope:"HISTORICAL" },{ reviewStatus:"REJECTED" },{ authorizedSource:false }]) {
    const changed={ ...row,...change };assert.equal(resolveResearchContext(snap,org,[changed],now).evidence.length,0);
    assert.throws(()=>assertResearchContextCurrent(context,org,[changed],now),ResearchContextChangedError);
  }
  assert.ok(readResearchSnapshot(snap,org));assert.deepEqual(snap.evidence[0].insight,industryInsight());
  assert.equal(readResearchSnapshot({ ...snap,evidence:[{ ...snap.evidence[0],insight:{ ...industryInsight(),counterSignals:["Forged history"] } }] },org),null);
});

test("industry selection and shared byte capacity exclude foreign bodies and preserve null/absent predecessor fingerprints", () => {
  const insight={ ...industryInsight(),observedPattern:"क".repeat(500),businessRelevance:"क".repeat(500),proposedOpportunity:"क".repeat(500) };
  const rows=Array.from({length:10},()=>candidate(insight));
  const snap=captureResearchSnapshot(org,[{ ...candidate(),organizationId:randomUUID(),summary:"Private foreign industry claim" },...rows],now,{categories:["INDUSTRY"],market:"india",language:"english"});
  assert.ok(Buffer.byteLength(JSON.stringify(snap))<=24000);assert.ok(snap.coverage!.omitted.byteBudget>0);assert.ok(!JSON.stringify(snap).includes("Private foreign industry claim"));
  assert.equal(captureResearchSnapshot(org,rows,now,{categories:["INDUSTRY"],market:"other",language:"english"}).evidence.length,0);
  const row=candidate(null);assert.deepEqual(captureResearchSnapshot(org,[row],now),captureResearchSnapshot(org,[{...row,insight:undefined}],now));
});

test("industry opportunities and counter-signals cannot impersonate source-summary quotations", () => {
  const row=candidate({ ...industryInsight(),counterSignals:["Synthetic alternative interpretation"] });
  const context=resolveResearchContext(captureResearchSnapshot(org,[row],now),org,[row],now),source=context.evidence[0];
  assert.match(context.policy,/Missing counter-signals mean not recorded/);assert.match(context.policy,/source recency does not verify a current trend/);
  for (const quote of [industryInsight().proposedOpportunity,"Synthetic alternative interpretation"]) {
    const checked=reviewStrategyReferences({recommendations:[{id:"industry",recommendation:"Test the proposal",basis:"RESEARCH",assumption:"Synthetic hypothesis",sourceRefs:[{sourceId:source.id,revision:source.revision,quote}]}]},context,org,now);
    assert.equal(checked.passed,false);assert.ok(checked.recommendations[0].issues.includes("QUOTE_NOT_FOUND"));
  }
});
