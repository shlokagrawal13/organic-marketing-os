# Project status — Organic Marketing OS 0.9.2

The existing Next.js/NestJS/PostgreSQL/Redis/private-storage architecture now includes
an executable generated-media workflow. **The full V3 product is still incomplete.**
Provider fixtures and passing local tests do not certify production readiness.

## Current implementation

- Accounts/sessions/email, organizations/six roles/invitations, Brand Brain/Creative
  DNA versions, drafts/campaigns/calendar/comments/search, human review and revision
  protection remain implemented.
- Text tasks use policy-aware routing and a durable graph mapping all 18 agent
  roles. Research, publishing and performance roles disclose absent external data.
- Private uploaded and generated image/video/audio assets feed real FFmpeg rendering,
  narration, captions, thumbnails and scene caching. Render approval remains tied
  to the exact content revision.
- Immutable credits, plans/subscriptions, signed billing events, official Stripe
  request/webhook contracts and invoice views remain locally implemented. Actual
  Stripe sandbox acceptance is outstanding.
- Version 0.9 adds an additive twelfth migration, scoped media-generation API,
  dedicated worker, OpenAI image/speech/video HTTP adapters, accepted estimates,
  fixed credit reservations, cancellation records, unknown-outcome review,
  private output validation/provenance and explicit scene attachment.
- Asset library → Generate with AI provides consent/cost gates, saved job history,
  previews/downloads and attachment controls. Workspace health and private record
  export include the new workflow. MEDIA-01D has started: media models can be
  allowlisted by workspace plan, a separately quoted single-image edit preset
  verifies tenant-owned source bytes before provider submission, bounded image
  and voice options are saved with each request, and
  platform credit review cannot resolve active media generations. UNKNOWN
  provider output written to private storage is retained as structured
  review evidence instead of becoming a hidden orphan. See GENERATED_MEDIA.md
  and UPGRADE_0.9.md.

## Verification and limits

Current exact evidence is in `docs/qa/verification-summary.json` and
`docs/VERIFICATION_REPORT.md`; unfinished test runs are not passes. The test database
is PGlite WASM PostgreSQL with serialized requests, Redis is native 7.2.11, object
storage is private S3Proxy 4.1.1 and media validation/rendering uses real FFmpeg.
Provider/SMTP/Stripe responses come only from isolated test fixtures.

Generated-media live quality, model access, actual charges and signed-redirect
behavior remain unverified. Single-image editing and bounded image/voice options
passed isolated provider fixtures, but multi-image/video references, custom voices and another provider still
need engineering; plan routing, active-credit-resolution and retained UNKNOWN
output gates are local contracts only. Media generation is opt-in with no default key, model or price. USD
estimates do not impose a provider spending limit. No paid AI request was made.

Native PostgreSQL concurrency/restore, Docker/MinIO, cross-store recovery, live
providers/payments, cloud mail/TLS, broader security/load/accessibility and full
master acceptance remain open. The 161-row requirement matrix retains all scope;
Partial labels are not completion percentages.

## Source and publication

Canonical public repository: `shlokagrawal13/organic-marketing-os`, branch `main`.
Version 0.9.2 was published after explicit user approval to public `main` and
verified against the local checkpoint. Prior automatic approval review rejections
are retained only as audit events; they were resolved by the user's explicit
approvals for this destination.
The unrelated `shlokagrawal13/OrganicMarketing` project remains excluded.

The earlier public account-side Actions gate was cleared. Public run
`37049004398` for commit `b2ac0ee74247ad8b9478bf82516161ea4211e69f`
completed the native application verification workflow successfully. The current
MEDIA-01D retained-output and source-image-edit slices still need publication
and their own remote CI check.
These records do not diagnose ChatGPT buffering.

## Next work

Continue MEDIA-01D with the remaining provider/reference modes, or move to the
next ready module after recording a provider choice.
MEDIA-LIVE-01 tracks authorized provider acceptance separately. Then continue advanced editing, sourced research, official
publishing, analytics/growth, administration, notifications, data lifecycle and
broader collaboration UX from TASK_BOARD.md. Do routine local work independently;
request only essential external access or concrete authorization.
