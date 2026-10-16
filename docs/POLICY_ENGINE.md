# Policy and quality checks

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
