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
