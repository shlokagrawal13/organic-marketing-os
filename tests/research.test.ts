import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseResearchInput,
  researchEvidenceState,
  researchMaximumAgeMs,
} from "../packages/core/research";

const now = new Date("2026-10-18T12:00:00.000Z");
const draft = {
  title: " Synthetic industry observation ",
  category: "INDUSTRY",
  temporalScope: "CURRENT",
  summary: " Fixture evidence; no real market findings. ",
  sourceUrl: "https://PUBLIC.org:443/report#section",
  sourceLabel: " Synthetic publication ",
  observedAt: "2026-10-17T12:00:00Z",
  market: " India ",
  language: " English ",
  authorizedSource: true,
};
const evidence = {
  ...parseResearchInput(draft, now),
  reviewStatus: "ACCEPTED" as const,
};

test("research intake canonicalizes declared citation without fetching and preserves missing drafts", () => {
  const parsed = parseResearchInput(draft, now);
  assert.equal(parsed.title, "Synthetic industry observation");
  assert.equal(parsed.sourceUrl, "https://public.org/report");
  assert.equal(parsed.sourceLabel, "Synthetic publication");
  assert.equal(parsed.observedAt, "2026-10-17T12:00:00.000Z");
  assert.equal(parsed.market, "India");
  assert.equal(parsed.language, "English");
  const missing = parseResearchInput(
    { ...draft, sourceUrl: null, sourceLabel: null, observedAt: null },
    now,
  );
  assert.equal(missing.sourceUrl, null);
  assert.equal(
    researchEvidenceState({ ...missing, reviewStatus: "UNREVIEWED" }, now)
      .freshness,
    "MISSING",
  );
});

test("research intake rejects unsafe reference syntax, unacknowledged sources and forged provenance", () => {
  for (const sourceUrl of [
    "http://public.org",
    "https://user:pass@public.org",
    "https://public.org:444",
    "https://127.0.0.1",
    "https://[::1]",
    "https://internal",
    "https://a.test",
    "https://a.local",
    "javascript:alert(1)",
  ])
    assert.throws(
      () => parseResearchInput({ ...draft, sourceUrl }, now),
      undefined,
      sourceUrl,
    );
  assert.throws(() =>
    parseResearchInput({ ...draft, authorizedSource: false }, now),
  );
  for (const extra of [
    { provenance: "FETCHED" },
    { collectedAt: now.toISOString() },
    { reviewedBy: "actor" },
    { organizationId: "tenant" },
  ])
    assert.throws(() => parseResearchInput({ ...draft, ...extra }, now));
});

test("research intake validates observation calendar, strict future boundary and bounded fields", () => {
  assert.equal(
    parseResearchInput({ ...draft, observedAt: now.toISOString() }, now)
      .observedAt,
    now.toISOString(),
  );
  assert.throws(
    () =>
      parseResearchInput(
        { ...draft, observedAt: new Date(now.getTime() + 1).toISOString() },
        now,
      ),
    /future/,
  );
  assert.throws(() =>
    parseResearchInput({ ...draft, observedAt: "2026-02-30T12:00:00Z" }, now),
  );
  for (const [field, value] of Object.entries({
    title: "x".repeat(161),
    summary: "x".repeat(5001),
    sourceLabel: "x".repeat(201),
    sourceUrl: "https://public.org/" + "x".repeat(2048),
    market: "x".repeat(101),
    language: "x".repeat(81),
    category: "OTHER",
    temporalScope: "LIVE",
  }))
    assert.throws(
      () => parseResearchInput({ ...draft, [field]: value }, now),
      undefined,
      field,
    );
  assert.throws(() => parseResearchInput({ ...draft, title: " " }, now));
});

test("research expires at the exact 30-day boundary and cannot be renewed by review", () => {
  const observedAt = new Date(now.getTime() - researchMaximumAgeMs);
  const boundary = researchEvidenceState({ ...evidence, observedAt }, now);
  assert.equal(boundary.freshness, "STALE");
  assert.equal(boundary.expiresAt, now.toISOString());
  assert.equal(boundary.eligibleForStrategy, false);
  assert.equal(
    researchEvidenceState(
      { ...evidence, observedAt: new Date(observedAt.getTime() + 1) },
      now,
    ).freshness,
    "CURRENT",
  );
  assert.equal(
    researchEvidenceState(
      { ...evidence, observedAt, reviewStatus: "UNREVIEWED" },
      now,
    ).freshness,
    "STALE",
  );
});

test("research freshness and strategy eligibility distinguish review status and temporal classification", () => {
  assert.equal(researchEvidenceState(evidence, now).eligibleForStrategy, true);
  for (const reviewStatus of ["UNREVIEWED", "REJECTED"] as const)
    assert.equal(
      researchEvidenceState({ ...evidence, reviewStatus }, now)
        .eligibleForStrategy,
      false,
    );
  for (const temporalScope of ["CURRENT", "EVERGREEN", "EMERGING"] as const)
    assert.equal(
      researchEvidenceState({ ...evidence, temporalScope }, now)
        .eligibleForStrategy,
      true,
    );
  const historical = researchEvidenceState(
    { ...evidence, temporalScope: "HISTORICAL" },
    now,
  );
  assert.equal(historical.freshness, "CURRENT");
  assert.equal(historical.eligibleForStrategy, false);
  const expired = researchEvidenceState(
    { ...evidence, temporalScope: "EXPIRED" },
    now,
  );
  assert.equal(expired.freshness, "STALE");
  assert.equal(expired.eligibleForStrategy, false);
});

test("research derives missing status for absent, corrupt or future stored evidence despite acceptance", () => {
  for (const incomplete of [
    { sourceUrl: null },
    { sourceUrl: "https://localhost" },
    { sourceLabel: " " },
    { observedAt: null },
    { observedAt: "invalid" },
    { observedAt: new Date(now.getTime() + 1) },
  ]) {
    const state = researchEvidenceState({ ...evidence, ...incomplete }, now);
    assert.equal(state.freshness, "MISSING");
    assert.equal(state.eligibleForStrategy, false);
  }
  assert.equal(
    researchEvidenceState({ ...evidence, observedAt: null }, now).expiresAt,
    null,
  );
  assert.equal(
    researchEvidenceState(evidence, new Date(NaN)).eligibleForStrategy,
    false,
  );
});
