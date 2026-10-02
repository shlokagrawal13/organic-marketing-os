# Project status — Organic Marketing OS 0.9.0

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
  export include the new workflow. See GENERATED_MEDIA.md and UPGRADE_0.9.md.

## Verification and limits

Current exact evidence is in `docs/qa/verification-summary.json` and
`docs/VERIFICATION_REPORT.md`; unfinished test runs are not passes. The test database
is PGlite WASM PostgreSQL with serialized requests, Redis is native 7.2.11, object
storage is private S3Proxy 4.1.1 and media validation/rendering uses real FFmpeg.
Provider/SMTP/Stripe responses come only from isolated test fixtures.

Generated-media live quality, model access, actual charges and signed-redirect
behavior remain unverified. Source-image editing, additional provider options,
plan-specific media routing and automatic output/orphan reconciliation still need
engineering. Media generation is opt-in with no default key, model or price. USD
estimates do not impose a provider spending limit. No paid AI request was made.

Native PostgreSQL concurrency/restore, Docker/MinIO, cross-store recovery, live
providers/payments, cloud mail/TLS, broader security/load/accessibility and full
master acceptance remain open. The 161-row requirement matrix retains all scope;
Partial labels are not completion percentages.

## Source and publication

Canonical private repository: `shlokagrawal13/organic-marketing-os`, branch `main`.
Last verified remote head: `446c832ee2da2b7584e5213db925d1ed075388c0` (v0.8 plus
publication records). The recovered v0.8.1 local checkpoint is commit
`73359b0`; later work is identified by local `git rev-parse HEAD` and the manifest.
**Version 0.9 has not been uploaded.** Automatic approval review rejected the
GitHub source upload because it required explicit authorization for that payload
and destination. Local implementation continued; the rejection was not bypassed.
The unrelated `shlokagrawal13/OrganicMarketing` project remains excluded.

The last observed remote Actions run, `36623211633`, failed before jobs started.
Earlier authenticated diagnostics identified an account billing gate. Billing UI
was not rechecked this turn. These records do not diagnose ChatGPT buffering.

## Next work

Continue MEDIA-01D: source-image/editing contracts, plan-aware media routing and
safe provider-output reconciliation. MEDIA-LIVE-01 tracks authorized provider
acceptance separately. Then continue advanced editing, sourced research, official
publishing, analytics/growth, administration, notifications, data lifecycle and
broader collaboration UX from TASK_BOARD.md. Do routine local work independently;
request only essential external access or concrete authorization.
