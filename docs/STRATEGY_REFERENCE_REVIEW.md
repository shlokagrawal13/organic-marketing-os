## Current continuation — RESEARCH-01C local verification, 2026-10-18 IST

RESEARCH-01C adds structured recommendation source references and explicit assumptions. Deterministic checks bind source IDs, captured revisions and exact excerpts; invalid/missing references block approval. Approval rechecks current reviewer membership and cited live source acceptance/fingerprint/expiry. The UI displays matched excerpts, blocked findings or evidence-gap assumptions and gates Use idea on approval. Tenant export/restore preserves recommendation output and agent run/step reviews.

Fresh verification: API/web production builds, 237 unit/export cases (9 new reference cases), 31 native HTTP cases (4 new reference/approval cases), 18 production browser cases, 5 recovery cases, 23 unchanged migrations, bounded readability, populated PGlite restore including recommendation/run/step reference JSON, and both zero-vulnerability dependency audits.

Reference matching does not establish truth, source quality, relevance or semantic entailment, nor automatically validate every strategy field. All claims and assumptions need human review. Historical approvals are not retroactively certified or revoked after later source changes. Live research/provider/deployed acceptance, wider research and POLICY-01, native PostgreSQL/private-media cross-store restore and full master acceptance remain open. CI verifies and does not deploy.

This checkpoint is locally verified; standing-authorized source publication and exact-commit native CI are pending. Earlier entries below retain historical scopes.

Next: Continue RESEARCH-01D: add explicit bounded research selection/filter criteria to strategy requests, with reviewer-visible category, market and language choices and immutable capture of those choices. Preserve tenant/revision/expiry checks and missing-data behavior; verify actual provider input and reviewer UX, then push and inspect exact-commit CI. Live source adapters, source-quality/semantic acceptance and full master acceptance remain open.

Evidence: `docs/STRATEGY_REFERENCE_REVIEW.md`, `docs/qa/research01c-evidence.json`.

# Strategy recommendation references

RESEARCH-01C adds structured source references and an approval check to newly generated strategies. It checks identities and excerpts; it does not determine whether an observation is true, representative or logically supports a recommendation.

## Model output and deterministic checks

The strategy prompt asks for 1–12 recommendations. Each has a unique short ID, recommendation text, a `RESEARCH` or `ASSUMPTION` basis, up to three source references, and an assumption/limits explanation. A research reference contains only a captured source ID, revision and exact quoted excerpt. The application resolves citation labels and URLs from the server-captured context; model-supplied citation URL fields are rejected.

Research-based recommendations require at least one reference. IDs must be present in the exact resolved evidence used for generation; revisions must match. Quotes must be unchanged substrings of the supplied bounded summary, with at least eight Unicode code points after trimming. Text outside a truncated excerpt, invented quotes, wrong revisions, expired sources and unknown sources block approval. Duplicate recommendation IDs and duplicate source references are flagged. These are bounded identity/excerpt checks, not semantic entailment or factual validation.

Assumptions require no source references and a nonblank explanation of the missing data or proposed test. They can be reviewed when no research was supplied, with their evidence gap visible. The broader strategy fields and every recommendation still require human review for claims, relevance, feasibility, rights and brand fit.

Persisted strategies using the older output shape remain readable. Missing recommendation declarations produce a missing-reference review state for new executions; they cannot acquire a passing citation review by omission. Malformed structured fields fail output-schema validation. Existing historical approvals are not retroactively rewritten or presented as reference-validated.

## Worker, approval and reviewer interface

The worker saves the checked recommendation references in the agent run's `finalReview.citationReview` and compliance/critique trace steps. A structurally valid result with invalid references remains visible for review, but its compliance/critique steps are blocked and the approval endpoint rejects it. A reviewer can reject it and request a corrected generation.

On approval, the API rechecks current approver membership under the workspace/membership locks and recomputes reference checks from the stored output and frozen model context. It then revalidates only the cited live workspace records against captured revisions/fingerprints, acceptance and expiry under the workspace lock. An edit, withdrawal or expiry between generation and approval prevents approval. Changes to uncited observations do not unnecessarily block a valid result. No network calls occur under this approval transaction.

The interface shows recommendation assumptions or matched source excerpts with canonical links and captured versions. It uses “excerpt matched; review relevance” language. Invalid/missing references are visible, and approval is disabled for a blocked saved review. **Use idea** requires an approved agent result. Approval remains a point-in-time human decision: later source changes do not automatically revoke historical approvals or certify downstream drafts.

## Export, restore and verification

Workspace NDJSON export now includes tenant-scoped agent runs and steps alongside job output, preserving frozen context and citation review. A populated PGlite archive restore checks recommendation output, the frozen source context and both run/step review JSON after loading a fresh database. No schema or migration changes are needed.

Focused units exercise real ModelRouter output parsing, exact references/quotes, invalid/legacy cases, assumptions, duplicate IDs, expiry boundaries and bounds. Native HTTP tests cover actual fixture-provider output, tenant/role checks, approval-time source changes, historical expiry, forged review input and full export. Browser tests cover matched, blocked and missing-evidence assumption states, approval/copy controls, rejection and desktop/dark/mobile display. Exact fresh counts and publication receipts are in the current QA evidence records.

No source page was fetched and no live model quality or semantic citation correctness was verified. Wider research ingestion, source selection/relevance, live-provider acceptance, native PostgreSQL/private-media cross-store restore and full master acceptance remain open.

Next: RESEARCH-01D should add explicit bounded research selection/filter criteria for strategy requests, with reviewer-visible category/market/language choices and immutable capture of those choices. Keep tenant/revision/expiry checks and missing-data behavior; then verify and publish the exact source with CI. Live source adapters and factual-quality acceptance remain separate open work.
