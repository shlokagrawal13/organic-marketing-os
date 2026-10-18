import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { calendarEventTypes, parseResearchInsight, seasonalWindowElapsed } from "../packages/core/research-insight";
import { researchEvidenceState, parseResearchInput } from "../packages/core/research";
import { captureResearchSnapshot, readResearchSnapshot, resolveResearchContext, assertResearchContextCurrent, ResearchContextChangedError, ResearchCandidate } from "../packages/core/research-context";
import { seasonalInsight } from "./support/research-insight";
const now = new Date("2026-10-18T18:29:59Z"), org = randomUUID();
const declared = () => ({ ...seasonalInsight(), dateStatus: "DECLARED" as const, startDate: "2026-10-18", endDate: "2026-10-18", timeZone: "Asia/Kolkata" });
const candidate = (insight: unknown = declared()): ResearchCandidate => ({ id: randomUUID(), organizationId: org, revision: 2,
  title: "Synthetic calendar source", category: "SEASONAL", temporalScope: "CURRENT", summary: "Synthetic source observation.", sourceUrl: "https://public.org/calendar",
  sourceLabel: "Synthetic calendar", observedAt: new Date(now.getTime()-60000), collectedAt: new Date(now.getTime()-50000), reviewedAt: new Date(now.getTime()-40000),
  market: "India", language: "English", provenance: "MANUAL", reviewStatus: "ACCEPTED", authorizedSource: true, insight });

test("seasonal intake retains all declared event types, missing timing and assumptions without inventing dates", () => {
  for (const eventType of calendarEventTypes) assert.deepEqual(parseResearchInsight({ ...seasonalInsight(), eventType }, "SEASONAL"), { ...seasonalInsight(), eventType });
  assert.deepEqual(parseResearchInsight(declared(), "SEASONAL"), declared());
  for (const extra of [{ recurrence: "YEARLY" }, { verifiedHoliday: true }, { demand: 1000 }])
    assert.throws(() => parseResearchInsight({ ...declared(), ...extra }, "SEASONAL"));
  assert.throws(() => parseResearchInsight(declared(), "COMMUNITY"));
  for (const key of ["eventName", "culturalContext", "businessRelevance", "proposedOpportunity", "assumptions"])
    assert.throws(() => parseResearchInsight({ ...declared(), [key]: " " }, "SEASONAL"));
  const row = candidate();
  assert.deepEqual(parseResearchInput({ title: row.title, category: row.category, temporalScope: row.temporalScope, summary: row.summary,
    sourceUrl: row.sourceUrl, sourceLabel: row.sourceLabel, observedAt: new Date(row.observedAt!).toISOString(), authorizedSource: true, insight: seasonalInsight() }, now).insight, seasonalInsight());
});

test("calendar dates reject normalization, invalid leap days, reversed ranges and inconsistent unknown timing", () => {
  for (const date of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-01-01", "2026-1-01", "2026-10-18T00:00:00Z"])
    assert.throws(() => parseResearchInsight({ ...declared(), startDate: date, endDate: date }, "SEASONAL"), date);
  assert.ok(parseResearchInsight({ ...declared(), startDate: "2028-02-29", endDate: "2028-02-29" }, "SEASONAL"));
  for (const change of [{ endDate: "2026-10-17" }, { startDate: "" }, { endDate: "" }, { dateStatus: "UNKNOWN" }])
    assert.throws(() => parseResearchInsight({ ...declared(), ...change }, "SEASONAL"));
  assert.ok(parseResearchInsight({ ...declared(), timeZone: "" }, "SEASONAL"));
});

test("calendar zones are explicit valid names and inclusive end dates follow local midnight including DST", () => {
  for (const timeZone of ["Mars/Nowhere", "+05:30", "GMT+5", "  +01  "])
    assert.throws(() => parseResearchInsight({ ...declared(), timeZone }, "SEASONAL"));
  for (const timeZone of ["UTC", "Etc/GMT+12", "Pacific/Kiritimati", "America/New_York", "Asia/Calcutta"])
    assert.ok(parseResearchInsight({ ...declared(), timeZone }, "SEASONAL"));
  assert.equal(seasonalWindowElapsed(declared(), now), false);
  assert.equal(seasonalWindowElapsed(declared(), new Date("2026-10-18T18:30:00Z")), true);
  const dst = { ...declared(), startDate: "2026-11-01", endDate: "2026-11-01", timeZone: "America/New_York" };
  assert.equal(seasonalWindowElapsed(dst, new Date("2026-11-02T04:59:59Z")), false);
  assert.equal(seasonalWindowElapsed(dst, new Date("2026-11-02T05:00:00Z")), true);
  assert.equal(seasonalWindowElapsed({ ...dst, timeZone: "" }, new Date("2026-11-03T00:00:00Z")), false);
  assert.equal(seasonalWindowElapsed(seasonalInsight(), now), false);
});

test("an ended event cannot be renewed by recent observation, acceptance or emerging scope and captured history stays readable", () => {
  const row = candidate(), snap = captureResearchSnapshot(org, [row], now), later = new Date(now.getTime()+1000);
  assert.equal(snap.evidence.length, 1);assert.ok(readResearchSnapshot(snap, org));
  const ctx = resolveResearchContext(snap, org, [row], later);
  assert.equal(ctx.evidence.length, 0);assert.equal(ctx.coverage!.availableByCategory.find(x => x.category === "SEASONAL")!.sources, 0);
  assert.ok(readResearchSnapshot(snap, org));assert.deepEqual(snap.evidence[0].insight, declared());
  for (const temporalScope of ["CURRENT", "EMERGING", "EVERGREEN"] as const) {
    const current = { ...row, temporalScope, observedAt: later, reviewedAt: later };
    assert.equal(researchEvidenceState(current as any, later).eligibleForStrategy, false);
    const next = captureResearchSnapshot(org, [current], later);
    assert.equal(next.evidence.length, 0);assert.equal(next.coverage!.rejected.expired, 1);
  }
  const context = resolveResearchContext(snap, org, [row], now);
  assert.throws(() => assertResearchContextCurrent(context, org, [row], later), ResearchContextChangedError);
});

test("seasonal source edits, cross-tenant rows, invalid stored dates and fingerprint tampering fail closed", () => {
  const row = candidate(), snap = captureResearchSnapshot(org, [row], now);
  for (const change of [{ insight: { ...declared(), endDate: "2026-10-19" } }, { insight: { ...declared(), endDate: "2026-02-30" } }, { reviewStatus: "UNREVIEWED" }, { organizationId: randomUUID() }])
    assert.equal(resolveResearchContext(snap, org, [{ ...row, ...change }], now).evidence.length, 0);
  assert.equal(readResearchSnapshot({ ...snap, evidence: [{ ...snap.evidence[0], insight: { ...declared(), timeZone: "UTC" } }] }, org), null);
  assert.equal(captureResearchSnapshot(org, [{ ...row, insight: { ...declared(), timeZone: "Invalid/Zone" } }], now).evidence.length, 0);
  assert.equal(captureResearchSnapshot(org, [{ ...row, insight: null }], now).evidence.length, 1);
});

test("seasonal hypotheses share bounded capacity, selection and unknown timing is preserved through snapshots", () => {
  const insight = { ...seasonalInsight(), culturalContext: "क".repeat(500), businessRelevance: "क".repeat(500), proposedOpportunity: "क".repeat(500), assumptions: "क".repeat(200) };
  const rows = Array.from({ length: 10 }, () => candidate(insight));
  const snap = captureResearchSnapshot(org, rows, now, { categories: ["SEASONAL"], market: "india", language: "english" });
  assert.ok(Buffer.byteLength(JSON.stringify(snap)) <= 24000);assert.ok(snap.coverage!.omitted.byteBudget > 0);
  assert.deepEqual(snap.evidence[0].insight, insight);assert.ok(readResearchSnapshot(snap, org));
  assert.equal(captureResearchSnapshot(org, rows, now, { categories: ["SEASONAL"], market: "other", language: "english" }).evidence.length, 0);
  assert.throws(() => parseResearchInsight({ ...insight, assumptions: "क".repeat(500) }, "SEASONAL"), /6,000/);
});
