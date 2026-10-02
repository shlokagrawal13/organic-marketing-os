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
Version 0.9 was published after explicit user approval to private `main` as
application commit `b47c34fd9fd1fe9b24beea96aacb41a9a9dedf7b`. The remote tree `a85c8a0384083167121e6fa34f46d9ac837fba8c` matches the local
verified source exactly: 182/182 blob paths, modes and SHAs matched with zero
mismatches. The prior automatic approval review rejection is retained only as an
audit event; it was resolved by the user's explicit approval for this destination.
The unrelated `shlokagrawal13/OrganicMarketing` project remains excluded.

The push triggered GitHub Actions run `37002434700`, which completed with
`startup_failure` before any job started; the jobs list was empty and combined
status returned no statuses. Earlier authenticated diagnostics identified an
account billing gate. These records do not diagnose ChatGPT buffering.

## Next work

Continue MEDIA-01D: source-image/editing contracts, plan-aware media routing and
safe provider-output reconciliation. MEDIA-LIVE-01 tracks authorized provider
acceptance separately. Then continue advanced editing, sourced research, official
publishing, analytics/growth, administration, notifications, data lifecycle and
broader collaboration UX from TASK_BOARD.md. Do routine local work independently;
request only essential external access or concrete authorization.
