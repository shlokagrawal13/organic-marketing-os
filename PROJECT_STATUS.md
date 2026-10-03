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
  to the exact content revision. EDITOR-01A adds cumulative scene timing plus
  reorder, duplicate-with-new-ID and remove controls verified through a real render.
  EDITOR-01B adds verified manual timed cues, legacy fallback and cue-aware SRT/cache.
  Automatic transcription and speech alignment are not implemented.
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
  allowlisted by workspace plan, a separately quoted image-edit preset accepts
  up to four ordered tenant-owned references verified before provider submission, bounded image
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
passed isolated provider fixtures, but video references, custom voices and another provider still
need engineering; plan routing, active-credit-resolution and retained UNKNOWN
output gates are local contracts only. Media generation is opt-in with no default key, model or price. USD
estimates do not impose a provider spending limit. No paid AI request was made.

The configured native PostgreSQL/Redis application harness has dated GitHub CI
evidence. Broader native concurrency/restore, full Docker/MinIO, cross-store recovery, live
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

EDITOR-01B is published at application commit `4611fb0170d4851be6bc6d805009c42a0ba5dd63`;
its tree `54e29ec0a2d0fa15921be62ccd0282de9e135c07` exactly matches all 184 local
blob paths, modes and SHAs. Public run `37143980421` completed every
workflow step successfully, including native application flows and browser evidence.
Local checks passed 33 unit, 7 HTTP, 6 browser and 5 recovery scenarios,
both production builds and the 12-migration populated PGlite upgrade/restore.
These records do not diagnose ChatGPT buffering.

## Next work

Continue EDITOR-01 with bounded per-scene image fit/fill controls. Automatic
speech alignment remains open. MEDIA-01D remaining provider/reference modes still require a
provider choice, and MEDIA-LIVE-01 tracks authorized provider acceptance separately. Then continue sourced research, official
publishing, analytics/growth, administration, notifications, data lifecycle and
broader collaboration UX from TASK_BOARD.md. Do routine local work independently;
request only essential external access or concrete authorization.
