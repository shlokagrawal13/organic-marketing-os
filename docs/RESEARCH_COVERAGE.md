## Current CI fixture follow-up — 2026-10-18 IST

RESEARCH-01E application source `0378110432b954c93631f0851f9ee182413589a1` remains verified by native Actions run `39134469984` (242 unit, 33 HTTP, 19 browser, 5 recovery; builds, readability, audits and populated coverage restore passed). Later continuity run `39135793894` passed units/HTTP but stopped at 18/19 browser cases when the existing YouTube review test lost navigation after reload; recovery did not run in that attempt.

Auth-budget exhaustion deterministically reproduced the missing-navigation state (429); resetting only the isolated fixture buckets restored the same session and navigation (200). A guarded shared auth/API reset now isolates the affected browser fixtures, and a new regression case retains the normal runtime limiter assertion. The exact failed CI response remains unobserved because its artifact bytes were blocked by proxy 403; the detailed receipt distinguishes that gap from the reproduced mechanism.

Fresh complete native follow-up: 33 HTTP, 20 production browser and 5 recovery cases passed. Production code, runtime rate limits, timeouts and verification steps are unchanged. This fixture/evidence follow-up requires its own full CI; read the newer HEAD in Git/Actions. No follow-up CI success is claimed in advance. See `docs/qa/research01e-ci-fixture-followup.json`. Next remains RESEARCH-01F structured competitor/search insights; full live/factual/master acceptance remains open.

## Current continuation — RESEARCH-01E published native CI, 2026-10-18 IST

RESEARCH-01E source is public on main at `0378110432b954c93631f0851f9ee182413589a1` (tree `837efee7163de4c2a6eedf041420852c87a9b2ca`); all 35 published paths and the full tree matched local verification. Exact-source native Actions run `39134469984` passed: 242 unit/export, 33 HTTP, 19 production browser and 5 recovery cases. Builds, readability, migrations, restore and both audits passed.

RESEARCH-01E adds bounded research coverage and missing-data explanations. The latest-100 matching window records eligibility/rejection and source/byte omission counts, with one lookahead flag. Immutable capture counts and current category gaps reach the actual provider and trace. The viewer explains bounded scope and exclusions without exposing omitted source bodies; older jobs retain unknown coverage. Export and populated restore preserve the metadata without changing migrations.

Fresh verification: API/web production builds, 242 unit/export cases, 33 native HTTP cases, 19 production browser cases, 5 recovery cases, 23 unchanged migrations, 44 bounded readability samples, populated PGlite restore including coverage/selection/recommendation context, and both zero-vulnerability dependency audits.

Coverage describes source counts inside a bounded capture window; it does not establish completeness, truth, rights, quality, relevance or semantic entailment. No source retrieval or live trend/competitor/search measurement occurred. Live source/provider/deployed acceptance, wider research and POLICY-01, native PostgreSQL/private-media cross-store restore and full master acceptance remain open. CI verifies and does not deploy.

This continuity/evidence commit follows the native-verified application source. Read Git/Actions for its own newer HEAD and follow-up CI result; this receipt does not claim that follow-up result in advance. Local receipts/screenshots are verified separately. CI artifact bytes were not independently inspected; see the native receipt for the observed download limitation.

Next: Continue RESEARCH-01F: audit and implement the next bounded structured competitor/search insight slice from master sections 20–21. Preserve manual-source provenance, tenant/revision/review gates, frozen selection/coverage and explicit assumptions; run full verification, push and inspect exact-commit CI. Live adapters, semantic/factual-quality acceptance and full master acceptance remain open.

Evidence: `docs/RESEARCH_COVERAGE.md`, `docs/qa/research01e-evidence.json` and `docs/qa/research01e-native-ci-evidence.json`.

## Current continuation — RESEARCH-01E local verification, 2026-10-18 IST

RESEARCH-01E adds bounded research coverage and missing-data explanations. The latest-100 matching window records eligibility/rejection and source/byte omission counts, with one lookahead flag. Immutable capture counts and current category gaps reach the actual provider and trace. The viewer explains bounded scope and exclusions without exposing omitted source bodies; older jobs retain unknown coverage. Export and populated restore preserve the metadata without changing migrations.

Fresh verification: API/web production builds, 242 unit/export cases, 33 native HTTP cases, 19 production browser cases, 5 recovery cases, 23 unchanged migrations, 44 bounded readability samples, populated PGlite restore including coverage/selection/recommendation context, and both zero-vulnerability dependency audits.

Coverage describes source counts inside a bounded capture window; it does not establish completeness, truth, rights, quality, relevance or semantic entailment. No source retrieval or live trend/competitor/search measurement occurred. Live source/provider/deployed acceptance, wider research and POLICY-01, native PostgreSQL/private-media cross-store restore and full master acceptance remain open. CI verifies and does not deploy.

This checkpoint is locally verified; standing-authorized source publication and exact-commit native CI are pending. Earlier entries below retain historical scopes.

Next: Continue RESEARCH-01F: audit and implement the next bounded structured competitor/search insight slice from master sections 20–21. Preserve manual-source provenance, tenant/revision/review gates, frozen selection/coverage and explicit assumptions; run full verification, push and inspect exact-commit CI. Live adapters, semantic/factual-quality acceptance and full master acceptance remain open.

Evidence: `docs/RESEARCH_COVERAGE.md`, `docs/qa/research01e-evidence.json`.

# Bounded research coverage and missing-data explanations

RESEARCH-01E audits master sections 18–23 and 47 against the retained manual intake, strategy selection and recommendation review. The implemented increment records why a bounded research capture contains or lacks usable sources. It does not measure whether the research is sufficient, truthful or relevant.

| Master requirement | Retained behavior and this increment | Remaining acceptance |
| --- | --- | --- |
| 18 — structured research feeding strategy | Reviewed manual observations, frozen filters/sources, recommendation references; now captured eligibility/omission counts and category gaps reach the actual provider and trace | Structured domain insights and factual/relevance evaluation |
| 19 — current/historical/evergreen/emerging/expired distinctions | Existing freshness/time-scope gates retained; primary expiry/time-scope omission counts are visible | Live trend collection and measured trend quality |
| 20 — competitor opportunities/differentiation | COMPETITOR sources can be selected and missing evidence is explicit | Structured authorized competitor analysis; differentiation and no-copy quality acceptance |
| 21 — SEO/AEO/search questions and demand | SEARCH source coverage or its gap is explicit | Structured search insights, authorized demand data and answer-quality acceptance |
| 22–23 — localization and marketing-calendar context | Market/language selection, SEASONAL category and bounded evidence-gap explanations | Cultural/market/calendar adaptation and authoritative event acceptance |
| 47 — community intelligence | COMMUNITY source coverage or its gap is explicit | Authorized interaction ingestion and structured community insights |

## Capture scope and accounting

Strategy enqueue reads the latest 101 tenant-scoped matching records in deterministic updated-time/ID order under the existing workspace/membership lock. It assesses only the first 100. The extra record establishes whether older matching records existed; it supplies no source content or count beyond that boolean. No whole-library total is queried or inferred.

New snapshots retain a versioned coverage object: examined, eligible and captured counts; one primary rejection reason per ineligible record; eligible sources omitted by the 10-source or context-size limits; and category-level examined/eligible/captured counts. Reasons use this precedence: not accepted, not authorized, unsupported provenance, expired, historical time scope, then incomplete/invalid source data. Existing eligibility remains unchanged, including fresh evergreen/emerging observations. Coverage never contains rejected-source IDs, titles, summaries or URLs.

The accounting is exact within the examined window: examined equals eligible plus primary rejection counts; eligible equals captured plus eligible omissions. Category totals reconcile with the same examined window and captured identities. Snapshot readers validate these invariants and reject inconsistent metadata. Duplicate source identities cannot inflate counts. A conservative maximum serialized counter-size reserve keeps metadata and evidence inside the existing 24,000-byte UTF-8 snapshot limit; a source may be omitted to preserve that bound. No source citation is truncated to make it fit.

Category gaps describe the requested categories (all six when no category filter is supplied). They are source counts, not proof that every topic, question, competitor or market has been covered. There is no completeness percentage or confidence score.

## Generation, history and compatibility

The worker retains immutable capture counts and separately computes available sources per category after its current revision/fingerprint/review/freshness checks. Withdrawn, edited or expired sources can make a category unavailable while historical capture counts remain unchanged. The identical coverage object reaches the actual provider request, research/community trace and source-history viewer. Existing provider-boundary and approval checks continue to validate source identities and expiry.

The viewer distinguishes capture exclusions, capacity omissions, the bounded-window warning and category gaps at the generation check. Omitted source bodies are not exposed. Older jobs with no coverage retain an unknown-count message; current library data is never used to invent historical totals. Invalid snapshots fail closed. Content/scene requests keep their existing behavior.

Tenant record export and populated PGlite archive restore retain snapshots, frozen context and coverage without changing any migration. Native PostgreSQL/private-media cross-store restore remains an open acceptance item.

## Verification and next work

Focused units cover accounting, rejection precedence, fresh emerging evidence, tenant/omitted-data isolation, candidate lookahead, source/byte caps, legacy data, malformed counters and post-capture category loss. Native HTTP exercises actual queue/provider/trace equality, replay, withdrawal, tenant export and the 101-record lookahead. Browser checks exercise visible capture counts, category gaps, an unreviewed truncated window and desktop/dark/mobile source history. Exact executed results belong in the dated QA receipts after completion.

Next: RESEARCH-01F should audit and implement the next bounded structured competitor/search insight slice from master sections 20–21, retaining manual-source provenance, revision/review gates, selection/coverage and explicit assumptions. Live adapters, semantic/factual-quality acceptance, broader research, POLICY-01 and full master acceptance remain open. CI verifies and does not deploy.
