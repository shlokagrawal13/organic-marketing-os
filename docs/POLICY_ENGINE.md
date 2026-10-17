## POLICY-01G — policy-management UI (local verified)

The owner/admin form is available under Connections. It uses F optimistic revisions and deployment ceilings, requires explicit review, preserves conflicting drafts and protects unsaved navigation/workspace changes. Restricted roles do not load it; server role removal removes editable controls after a rejected save. Production build and all 12 browser cases passed; backend/schema are unchanged from F. See [POLICY_01G_MANAGEMENT_UI.md](POLICY_01G_MANAGEMENT_UI.md). Wider semantic/multi-platform and live/master gates remain partial.

## POLICY-01F — workspace rules (local verified)

POLICY-01F is locally verified: OWNER/ADMIN workspace YouTube policy API with monotonic revisions, deployment-bound validation and audited updates; upload preview/save and manual/scheduled dispatch bind the current workspace policy. Workspace data export and populated archive restore include the policy. Current checks: 12 focused units, 18 isolated HTTP, 1 focused production browser, 22 PGlite migrations, and 2 additional policy HTTP cases against dedicated PostgreSQL 17.11/Redis 7.4.11 fixtures with 22 native migrations. API/web production builds and populated PGlite upgrade/archive restore passed. POLICY-01 remains partial. No public push, native CI, live provider, full Compose/MinIO, native cross-store restore or full master acceptance is claimed.

Supported settings and exact authorization, concurrency, preview revision and dispatch behavior are documented in [POLICY_01F_WORKSPACE_RULES.md](POLICY_01F_WORKSPACE_RULES.md). New workspace policies take effect without a process restart; deployment rule edits retain the earlier all-process rebuild/restart contract. The management form remains pending; existing upload-review UI reads and submits the workspace revision.

## POLICY-01E — declarative metadata rules (local)

YouTube/Video metadata limits, allowed visibility and the optional affirmative
synthetic-media restriction now come from validated `packages/core/youtube-rules.json`.
The rule fingerprint enters the effective policy version, maintenance source
fingerprint and all existing saved-review/dispatch identities. Rule changes need
a rebuild/restart of every API and worker, a new operator maintenance receipt and
fresh preparation/review; they do not silently reuse old approvals. Reservation
also rejects a missing, expired or stale-policy review before inserting an attempt.
The browser reads the rules from the tenant-gated preview and restricts its choices.

See [POLICY_01E_AUDIT.md](POLICY_01E_AUDIT.md) for the complete section 33/40 gap
audit, supported settings and rollout contract. Multi-platform/database-managed
rules, semantic quality and live/master acceptance remain open. Prior records
below describe historical source/evidence; current execution results are recorded
in `docs/qa/policy01e-declarative-rules-evidence.json` when the increment closes.

## Current policy continuation state — 2026-10-17

POLICY-01D source `d165187` and native-CI closure `0eeaff6` are already public. Its saved native CI evidence passed; older local/unpublished descriptions below retain the initial development history. Broader configurable platform/format/disclosure and semantic policy work remains partial. See [RESUME_CONTEXT.md](RESUME_CONTEXT.md).

# Policy and quality checks

## POLICY-01D YouTube policy-source provenance (local, unpublished)

The live YouTube stop switch now binds an operator review to an exact, ordered manifest of five official Google sources: `videos.insert`, the video resource, API Terms, Developer Policies and Required Minimum Functionality. Policy version `youtube-upload-policy-2026-10-17` and source fingerprint `3959c5d7738b34e9e8c7b2bcf9193460dffc06f47f787782ae06a67575f8debf` must both match the deployed environment, and the UTC review timestamp must still be within seven days. A missing or changed source fingerprint blocks manual dispatch, scheduled dispatch and readiness before provider traffic.

The readiness endpoint and sanitized deployed receipt expose the non-secret fingerprint so operations evidence can prove which exact source set was acknowledged. Advancing this policy version intentionally invalidates earlier saved upload reviews. Focused verification passed 7/7 unit/runner cases, 1/1 social-dispatch HTTP and 2/2 claim-policy HTTP cases, API/web builds and both zero-vulnerability audits. A broad attempt without unbundled Noto fixtures is excluded, not presented as a pass. Own native CI remains required after publication. This gate does not certify legal compliance or provider acceptance. See `docs/qa/policy01d-platform-policy-provenance-evidence.json`.

## POLICY-01C dispatch-time evidence freshness (published and native-CI verified)

The application now evaluates the current `ContentClaimReview` again at every outbound eligibility boundary. It does not trust the sanitized review snapshot captured when the publication intent was prepared.

- Schedule preview and creation evaluate evidence at the requested due time. Evidence that is current now but will expire before that time cannot be scheduled.
- The due worker evaluates evidence at its claim time. A stale, changed-policy, changed-fingerprint, wrong-tenant or otherwise incomplete review moves the schedule to `NEEDS_REVIEW` with `CLAIM_EVIDENCE_CHANGED`, before creating an attempt or calling the provider.
- Attempt reservation evaluates evidence at the current server time. Manual and scheduled dispatch therefore fail before a ledger attempt when the review is already stale.
- The durable `SUBMITTING` transaction evaluates evidence again using the same timestamp used for the YouTube policy-expiry check and `startedAt`. This is the last database boundary before a resumable-upload provider request.
- A successful transition stores a sanitized claim-review receipt inside the attempt policy snapshot. It contains review ID, content revision, policy version, claim-set fingerprint, reviewer, review time and dispositions only. Source URLs, labels and override reasons are excluded.
- A pre-provider `RESERVED` attempt remains safely retryable with the same ledger record after the underlying review is restored; it cannot enter `SUBMITTING` while the review is stale.

Claim-free content remains complete without a review. A complete owner-override-only review has no evidence timestamp to expire, but remains bound to the exact tenant, revision, policy version and claim-set fingerprint. The existing 30-day age and five-minute future-skew semantics are unchanged; no schema migration is needed.

Verification on the final local source passed 210/210 unit/export cases, 16/16 isolated HTTP cases (including the new dispatch-boundary case), 9/9 production browser cases, 5/5 recovery cases and 21 fresh PGlite migrations. Its exact published tree then passed native Actions run 38957638173 with the same 210/16/9/5 counts, 21 native PostgreSQL migrations, native Redis, builds, readability, populated upgrade and two zero-vulnerability audits. The regression proves zero provider requests for stale evidence and no sensitive evidence fields in the submission snapshot.

This remains a review-age and continuity gate. It does not fetch a URL, resolve DNS, prove reachability, assess source quality, verify claim truth, or establish legal/platform compliance. Live Google acceptance, deployed acceptance, native PostgreSQL plus private-media restore and full master acceptance remain open. POLICY-01 remains Partial. See `docs/qa/policy01c-dispatch-freshness-evidence.json`.

## POLICY-01B evidence source and review freshness (local, unpublished)

Policy `bounded-claims-2026-10-15-evidence-2` advances the existing bounded claim gate. Evidence-source policy `claim-evidence-source-2026-10-15` permits HTTPS references without userinfo or nondefault ports, rejects IP addresses and malformed/single-label hosts, and excludes `example`, `internal`, `invalid`, `local`, `localhost`, `onion`, `test`, and `home.arpa` suffixes. Default HTTPS port, casing and fragments are canonicalized; path and query are preserved. This is syntax checking only: no DNS lookup or URL fetch occurs and public reachability or credibility is not certified.

Every EVIDENCE resolution must declare a review timestamp within the last 30 days; at most five minutes of future clock skew is accepted. The boundary is inclusive to the millisecond. Saving a review, approving content and preparing publication all validate the current policy version, exact claim set and fresh evidence. A stale review becomes incomplete and must be saved again. The review view exposes the earliest evidence expiry, or null for an all-owner-override review. OWNER-only overrides remain explicitly acknowledged and audited. Source URLs, labels and reasons stay out of publication snapshots and audit details. No schema migration is needed.

The 30-day rule is a versioned application choice, not automated fact-checking or a platform rule. Later scheduled/live dispatch revalidation is outside this increment. Human facts/rights/platform review, broader semantic policy and authorized live acceptance remain required. See `docs/qa/policy01b-evidence-source-evidence.json` for current-source checks and limits. Earlier sections describe historical increments.

## POLICY-01A bounded claim evidence gate (local, unpublished) — 2026-10-14 UTC

Policy version `bounded-claims-2026-10-14` deterministically inspects the saved title, hook, body, CTA and each scene's voiceover, on-screen text, caption and CTA. It emits at most 50 field-bound signals for numeric results, selected superlative/comparative phrases and selected proof assertions. Signal IDs and the ordered claim-set fingerprint are SHA-256 bound to the policy version and exact field occurrence.

Approval behavior:

- Claim-free revisions keep the existing structural and human-review flow.
- Every detected claim requires exactly one acknowledged resolution for the current revision.
- OWNER, ADMIN and EDITOR may save an HTTPS evidence URL, a human-readable label and review time.
- Only OWNER may save a documented override of at least 20 characters; role failures return 403.
- The current content row is locked for review save and approval. Revision, workspace, policy version and fingerprint mismatches fail closed.
- Every review save creates an audit event with counts and identifiers, but without source URL/label or override reason.
- Publication preparation re-evaluates the current claim set under the content lock and stores only review ID, revision, policy version, fingerprint, reviewer, timestamp and claim dispositions. It excludes evidence URLs/labels and override reasons.
- Any content edit creates a new revision, clears approval and makes the prior review ineligible.

The detector is intentionally bounded. It does not fetch or authenticate sources, judge truth, rank source quality, decide legal/platform compliance, or identify every factual implication. Human facts, rights, brand and platform review remains mandatory. Verification and limitations are recorded in `docs/qa/policy01-claim-evidence.json`.

## SOCIAL-01 YouTube connections and upload-review UI (local) — 2026-10-10 UTC

The local approved-video panel makes the bounded YouTube metadata and declaration review available to workspace approvers. It has no preselected visibility/audience/synthetic choice, shows server-derived title/description read-only, and requires all four acknowledgments. The new GET for a saved review is tenant and approver gated and excludes its fingerprint. UI declarations are human review inputs, not verified legal or platform compliance; no upload occurs. See `docs/qa/social01-review-ui-evidence.json`. Previous dated sections are historical.

## Bounded YouTube upload review — local, 2026-10-10

`GET /api/workspaces/:organizationId/publication-intents/:id/youtube-policy-preview` shows title/description derived from the approved Video revision; it does not post. A workspace approver (OWNER, ADMIN or EDITOR) can submit `POST .../:id/youtube-policy-review` for one authorized YouTube channel with explicit `privacyStatus`, `selfDeclaredMadeForKids`, `containsSyntheticMedia` and true metadata/audience/synthetic/rights/platform-rule acknowledgments. The title is limited to 100 characters; the description is limited to 5000 UTF-8 bytes; angle brackets are rejected. The service never relies on YouTube's public privacy default. It accepts no client-provided title/description or `publishAt` in this bounded contract. Official references reviewed: https://developers.google.com/youtube/v3/docs/videos/insert and https://developers.google.com/youtube/v3/docs/videos (both checked 2026-10-10; local version `youtube-videos-insert-2026-10-08`).

The review is tenant/account/revision/render bound, immutable, audited and valid for at most 24 hours. The internal SUBMITTING transition rechecks its version, expiry and canonicalized JSONB metadata fingerprint and stores the exact review snapshot before any future outbound request. A changed choice or expired review needs a new preparation. The API currently has no review UI or upload sender; a signed-in approver's declarations are human assertions, not proof of legal rights, truth or platform compliance. A maintainer must recheck official rules and advance the version when they change. Semantic evidence, platform frequency, live quota and provider-side moderation remain POLICY-01 work.

Content checks cover required title/copy/voiceover, obvious guaranteed-results language, CTA warnings, scenes and unique scene IDs. These do not verify truth, grammar, copyright or current platform rules. Review requires no blocking structural failures; authorized approval requires explicit facts/rights/brand/platform acknowledgment. Edits invalidate it.

Media checks cover actual container/type, dimensions/duration, tenant-owned attachments, supported render bounds, and output H.264/AAC/dimensions/duration. They do not judge aesthetics, intelligibility, licensing or misleading claims. Render approval requires a human acknowledgment that the video was watched and reviewed, and approved content at the exact saved revision. Any content edit or removal of content approval clears that render approval.

The publication preparation endpoint rechecks content approval, structural checks and matching render approval at snapshot time; it does not send to an external provider. Content edits and approval removal invalidate prepared records. The local SOCIAL-01 attempt ledger rechecks exact approval/render and connection state at reserve and submission boundaries, blocks unresolved/confirmed duplicates on the same account/content revision, and does not retry uncertain attempts. These are structural safety gates, not platform policy clearance. A configurable database policy engine, current per-platform metadata/constraints/disclosures, semantic media QA and publication-frequency policies are missing. No protection from account bans or legal compliance is implied.

The SOCIAL-01 refresh boundary now persists an uncertainty marker before a remote refresh call and prevents the internal attempt ledger from using that connection until a fresh grant or a fully committed response clears it. This is token safety; it does not implement current platform policy clearance.
<!-- POLICY01D_NATIVE_CLOSURE_START -->
## POLICY-01D official YouTube source provenance publication and native CI — 2026-10-17 UTC

The approved 23-path source/config/docs/evidence/checkpoint payload is public on `main` at `d1651879dee580eed48c108f84bd24a7f3d242e5` (parent `972ca69b79809c47db1f12597931a3e965c57f31`, tree `3d85ca8f6d2c9fbeba5747a62060f3fa88e144e8`). Remote compare showed exactly 23 approved paths with no deletion or extra path, and the public tree matches the frozen locally verified tree.

Its own Actions run `39020625965` (#79), job `117361538915`, attempt 1 succeeded: 211/211 unit/export, 16/16 HTTP, 9/9 production browser and 5/5 recovery cases passed with zero failed/skipped/cancelled/todo; API/web builds, 21 fresh native PostgreSQL migrations, native Redis, populated upgrade/archive restore, 44 bounded English readability samples plus blank negative control, and both zero-vulnerability audits passed. Artifact `12097176336` is 6,192,778 bytes with digest `sha256:b329c1b12065453ab5fe42016a16c7ac51a4d0fb86e907a33d4a10111bfcd5e4`; downloaded bytes matched metadata, all 124 ZIP entries passed CRC, and all 211 unit receipts are unique.

POLICY-01D binds approval, manual/scheduled dispatch and readiness receipts to the maintained official YouTube source-manifest fingerprint `3959c5d7738b34e9e8c7b2bcf9193460dffc06f47f787782ae06a67575f8debf`. It fails closed on missing or mismatched version, fingerprint or review time. It does not fetch or hash remote page bodies, prove that every platform rule is complete, perform a live Google upload, prove deployed behavior, verify native PostgreSQL plus private-media restore, or complete master acceptance. POLICY-01 remains Partial. GitHub's Node-action/setup-java/Ubuntu migration notices and Redis/DEP0169 advisories were non-failing maintenance warnings; every workflow step passed. This 16-path closure payload is locally verified and unpublished pending separate approval; implementation is unchanged. See `docs/qa/policy01d-platform-policy-provenance-evidence.json`, `docs/qa/policy01d-platform-policy-provenance-native-ci-evidence.json` and `docs/qa/policy01d-platform-policy-provenance-native-unit-receipts.json`.
<!-- POLICY01D_NATIVE_CLOSURE_END -->
