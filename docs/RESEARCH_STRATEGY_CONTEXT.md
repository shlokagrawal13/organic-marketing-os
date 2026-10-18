## Current continuation — RESEARCH-01C local verification, 2026-10-18 IST

RESEARCH-01C adds structured recommendation source references and explicit assumptions. Deterministic checks bind source IDs, captured revisions and exact excerpts; invalid/missing references block approval. Approval rechecks current reviewer membership and cited live source acceptance/fingerprint/expiry. The UI displays matched excerpts, blocked findings or evidence-gap assumptions and gates Use idea on approval. Tenant export/restore preserves recommendation output and agent run/step reviews.

Fresh verification: API/web production builds, 237 unit/export cases (9 new reference cases), 31 native HTTP cases (4 new reference/approval cases), 18 production browser cases, 5 recovery cases, 23 unchanged migrations, bounded readability, populated PGlite restore including recommendation/run/step reference JSON, and both zero-vulnerability dependency audits.

Reference matching does not establish truth, source quality, relevance or semantic entailment, nor automatically validate every strategy field. All claims and assumptions need human review. Historical approvals are not retroactively certified or revoked after later source changes. Live research/provider/deployed acceptance, wider research and POLICY-01, native PostgreSQL/private-media cross-store restore and full master acceptance remain open. CI verifies and does not deploy.

This checkpoint is locally verified; standing-authorized source publication and exact-commit native CI are pending. Earlier entries below retain historical scopes.

Next: Continue RESEARCH-01D: add explicit bounded research selection/filter criteria to strategy requests, with reviewer-visible category, market and language choices and immutable capture of those choices. Preserve tenant/revision/expiry checks and missing-data behavior; verify actual provider input and reviewer UX, then push and inspect exact-commit CI. Live source adapters, source-quality/semantic acceptance and full master acceptance remain open.

Evidence: `docs/STRATEGY_REFERENCE_REVIEW.md`, `docs/qa/research01c-evidence.json`.

## Current continuation — RESEARCH-01B published native CI, 2026-10-18 IST

RESEARCH-01B bounded strategy research context source is public on main at `7ecc56363639141582032904ba2070484e3ca83a` (tree `33419fca5a7ba40c1a7282064ed90ac5b01d853a`). All 38 published paths and the full tree matched the locally verified source. Exact-source native Actions run `39110770249` succeeded: 228 unit/export, 27 HTTP, 16 production browser and 5 recovery cases. API/web builds, bounded readability, 23 fresh PostgreSQL migrations, Redis, populated upgrade/archive restore and both zero-vulnerability dependency audits passed.

Native job logs and artifact metadata/upload digest were checked. Independent artifact ZIP/digest/image-byte inspection is not claimed; see the native evidence record for the actual download limitation. Local unit receipts and desktop/dark/mobile screenshots are saved and verified separately.

Manual source entry, URL syntax checks and team acceptance do not establish source reachability, factual accuracy or rights. New strategy jobs consume bounded manual research snapshots; generated citation validity and live model quality remain unverified. RESEARCH-01 remains partial; wider trend/competitor/SEO/localization/calendar/community work is open. POLICY-01, live-source/provider/deployed production acceptance, native PostgreSQL plus private-media cross-store restore and full master acceptance remain open. CI is verification-only.

This continuity/evidence commit follows the native-verified application source. Read Git/Actions for its own newer HEAD and follow-up CI result; this source receipt does not claim that follow-up result in advance. Standing implementation/verification/push/CI authorization is saved in AGENTS.md. Earlier dated local/unpublished notes below are historical.

Next: Continue RESEARCH-01C: add explicit generated recommendation/citation references bound to captured research source IDs. Validate unknown, missing and unsupported references, retain visible missing-data/assumption states, and test actual model-output fixtures plus reviewer UX. Do not treat context delivery as proof of factual correctness. Then push and inspect exact-commit CI; live source adapters and quality acceptance remain open.

Evidence: `docs/RESEARCH_STRATEGY_CONTEXT.md`, `docs/qa/research01b-evidence.json`, `docs/qa/research01b-native-ci-evidence.json`.

# Reviewed research in strategy requests

RESEARCH-01B connects the manual research library to newly queued strategy jobs. It supplies the same bounded evidence context to the research/community agent trace and the actual model request. Content and scene jobs retain their previous context behavior.

## Selection and durable capture

Strategy enqueue holds the workspace lock, rechecks current writer membership, and reads the latest 100 workspace research records in deterministic updated-time/ID order. It captures at most 10 complete, accepted, current records. Historical, expired, missing, rejected, unreviewed, unauthorized or malformed records are excluded. Another workspace's records cannot enter the snapshot.

The immutable job `brandContext.researchSnapshot` records its policy version, workspace, capture time and source identities. Each source includes revision, citation URL/label, category/time scope, manual provenance, declared observation time, server collection/review times, market/language and a fingerprint. Summaries use at most 1,000 Unicode code points, with truncation explicitly marked. The serialized snapshot has a 24,000-byte UTF-8 limit. Records that would exceed the budget are skipped; no citation is silently truncated. Replaying an existing request key returns the existing job and does not recapture newer observations.

This is a bounded selection policy, not a claim that every library entry is considered or relevant to every strategy. The model must distinguish supplied evidence from assumptions. The library still contains manually declared observations; this integration performs no source retrieval or independent truth/rights verification.

## Worker and provider boundaries

At execution, the worker checks captured evidence against the current tenant record, revision, fingerprint, review status and observation expiry. It retains the captured version when still eligible; it never substitutes newly edited text into an older request. Changed, withdrawn, missing or expired observations are omitted. If no usable evidence remains, generation receives an explicit missing-evidence state and instructions to label research gaps and assumptions.

The raw queue snapshot is removed from model context. Only the resolved evidence, its capture/check times, exclusion IDs/reasons and manual-source policy enter `frozenContext.brand.research`. The actual ModelRouter request uses the same resolved Brand Brain context. Research and community trace steps expose that same evidence object.

Immediately before each provider attempt, including fallback, the worker rechecks the selected records and clock. A change or expiry at this boundary stops generation with an explicit research-refresh error; it does not alter the frozen request or silently send another paid request. Existing credit settlement/review behavior is preserved. Checks describe the database/clock at the request boundary; they do not hold database locks across network calls or promise that a source cannot change after transmission.

Legacy queued jobs without a research snapshot remain explicitly `LEGACY_NOT_CAPTURED`; the worker never silently adds today's library to an old request. Invalid or foreign-workspace snapshots fail closed to missing evidence. Source fingerprints bind captured fields, not the contents or factual quality of remote pages.

## User review and persistence

Strategy generation history offers **View research sources**. It shows the sources selected for that job, source versions and observation/expiry times, or explains that usable research was missing. This is a record of model context; it is not proof that every generated recommendation cites or correctly interprets the evidence. Existing agent-trace export includes the same context. Human approval of strategy output remains required.

The existing JSON job/agent context fields preserve snapshots through workspace export and populated PGlite archive restore. No new schema migration is required; 23 existing migrations remain intact.

## Verification and remaining work

Focused tests cover scope/authorization, deterministic limits and Unicode budgets, immutable versions, exact expiry, malformed/legacy data, trace/model equality, and provider fallback after a source change. Native integration exercises actual queue execution and the local HTTP provider fixture, including tenant isolation, idempotent replay, edited/rejected sources, delayed/empty/legacy requests and writer-role removal. Production browser checks cover visible source context on desktop/dark/mobile. The populated restore fixture retains both a legacy job and a strategy job with a usable captured source.

Exact fresh results are recorded in `docs/qa/research01b-evidence.json` and the native CI receipt after execution. These synthetic provider tests prove input delivery and policy behavior, not live model quality or the factual truth of cited material.

Next work should add explicit generated recommendation/citation references bound to the captured source IDs, validate missing/unknown/stale references, and make unsupported recommendations visibly reviewable. Live source ingestion, source-quality acceptance, wider trend/competitor/SEO/localization/calendar/community analysis and full master acceptance remain open.
