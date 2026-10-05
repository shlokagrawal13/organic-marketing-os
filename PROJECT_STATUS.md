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
  EDITOR-01C adds verified Fit/Fill framing for images/video, centered cropping,
  mode-aware caching and a guard against oversized intermediate frames.
  EDITOR-01D adds published, CI-verified image-only Static / Slow zoom in, capped at 8%,
  with stationary overlays and effective-motion scene caching.
  EDITOR-01E adds published, CI-verified named export presets, immutable job geometry,
  Custom reset and saved history labels.
  EDITOR-01F adds conservative script/character preflight before queueing and in
  the worker, with scene/cue-specific errors. Captions-off Unicode SRT and unused
  fallback captions remain supported.
  EDITOR-01G adds actual configured-font glyph mapping checks before worker
  storage/cache/media work and safe scene/cue/codepoint errors in render history.
  EDITOR-01H verifies Arabic/Hebrew rendered titles and burned captions
  with explicit FFmpeg text shaping. EDITOR-01I adds published, CI-verified
  trusted fallback fonts and decoded readability smoke coverage for allowed
  rendered text. Broader Indic/CJK shaping,
  automatic transcription and speech alignment remain open.
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

EDITOR-01K audio output QA is locally verified: stereo 48 kHz AAC, finite audio/video/container durations and aligned audio start are required for cached segments and final exports. Decoded PCM tests cover narration trim/padding, scene boundaries, muted embedded video sound, silent scenes, music looping/volume and invalid-cache rebuilding. Passed 49 unit, 7 HTTP, 6 browser and 5 recovery cases, API/web production builds and all 12 fresh migrations.

Subjective speech quality, loudness/true-peak targets, arbitrary codecs/channel layouts, physical-device playback, Indic/CJK shaping and automatic speech alignment remain open. No new dependency, schema/migration, live/paid provider or user runtime data change.
EDITOR-01K source/docs are local; public publication and its own CI remain pending.

EDITOR-01J is published at `ffb398d34279898074765141048cb6955e198c53` with matching tree `97fe4253f2e63dabd545a95481768210ea1009a2`. Actions run `37353516609` completed successfully: build, unit tests, dependency audits, populated upgrade and native application flows passed.

Titles
and burned cues use selected-font metrics, grapheme-safe wrapping and bounded
separate text areas. Text that cannot fit at 16px fails with a safe scene/cue error
before storage/cache work; drafts and SRT stay intact. Cache version 6 prevents
reuse of old layouts. Passed 47 unit, 7 HTTP, 6 production-browser and 5 recovery
cases, both production builds and 12 fresh migrations. Eighteen decoded frames
cover wide Latin, accents, Greek/Cyrillic and Arabic/Hebrew fallback across all
three aspects at 720/1080. This does not certify Indic/CJK, every font, OCR or
physical-device readability. Architecture, dependencies and migrations are unchanged.

EDITOR-01I is published and CI-verified on public `main` at
`56702de088f2e8d2198e3ea858dd96efe6b9d200`; tree
`d4e6cf0c0d93defb64e391a0a1496dae5d5f1534` matched the verified local follow-up
tree. The initial EDITOR-01I publish at `27aaf5cd752ad3fb83c5127523eff01416ace53a`
failed Actions run `37315707338` only because fallback-font tests referenced a
local URW/Nimbus font not installed by the workflow. The approved follow-up uses
CI-installed DejaVu fonts, and Actions run `37317283904` passed build, unit tests,
audits, populated upgrade and native application verification.

EDITOR-01H is published at `2e33a2cc230ab99bed6d28a18a35853e4ab9c313`. It adds explicit Arabic/Hebrew RTL text shaping while keeping unsupported scripts blocked. Passed 42 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases after rebuilding dist.

EDITOR-01G is published and CI-verified. Passed 41 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases,
API/web production builds, 12 fresh migrations and a full npm audit with zero
advisories. Published to public main as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched 187/187 blobs. Actions
run `37277131959` completed successfully with configured native PostgreSQL/Redis
application verification. No live/paid provider was used.
Populated upgrade/fresh restore was last rerun for EDITOR-01F; no schema/migration
changed in this increment.

EDITOR-01F is published and CI-verified: 37 unit, 7 HTTP, 6 production-browser and
5 recovery/configuration scenarios passed, with API/web builds, 12 migrations
and populated PGlite upgrade/fresh restore. Public Actions also passed the native
PostgreSQL/Redis application harness. No live/paid provider was used.

Published EDITOR-01G to public `main` as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched all 187 local blob paths,
modes and SHAs. Actions run `37277131959` completed successfully.

EDITOR-01F remains published and CI-verified at `72b796d6d93ae5f5da475e3c33d021858131df1e`;
tree `97e227fa6352de563f6e3d018704960f8e34264d`, Actions run `37228966502`.

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
are retained only as audit events; EDITOR-01C, EDITOR-01D and EDITOR-01E each have their own
current-slice approvals and successful Actions evidence for this destination.
The unrelated `shlokagrawal13/OrganicMarketing` project remains excluded.

EDITOR-01B is published at application commit `4611fb0170d4851be6bc6d805009c42a0ba5dd63`;
its tree `54e29ec0a2d0fa15921be62ccd0282de9e135c07` exactly matches all 184 local
blob paths, modes and SHAs. Public run `37143980421` completed every
workflow step successfully, including native application flows and browser evidence.
Local checks passed 33 unit, 7 HTTP, 6 browser and 5 recovery scenarios,
both production builds and the 12-migration populated PGlite upgrade/restore.
EDITOR-01C is published at application commit `177936421b896737ed6ea424f7520c32651ee596`;
its tree `aa368ff82aaca7d29fef10da26dcc4c12ccee51b` exactly matches all 184 local blob paths, modes and SHAs.
Public run `37189446835` completed every workflow step successfully, including native
application flows and browser evidence. Local checks passed 34 unit, 7 HTTP,
6 browser and 5 recovery scenarios, both production builds and the 12-migration
populated PGlite upgrade/restore.
EDITOR-01D is published at application commit `9334411055f63f33333044b2b4ce079420fa2596`;
its tree `8be7bfe6976d21a7db3411627548ebd8af7bd8c4` exactly matches all 184 local
blob paths, modes and SHAs. Public run `37191164246` completed every workflow step
successfully, including native application flows and browser evidence. Local checks
passed 35 unit, 7 HTTP, 6 browser and 5 recovery scenarios, both production builds
and the 12-migration populated PGlite upgrade/restore.
EDITOR-01E is published at application commit `06e5da96ec4e811b0a95510247db25c3d54ac669`;
its tree `092b502cca399cfe732d9743202f310b0c80d994` exactly matches all 185 local
blob paths, modes and SHAs. Public run `37207895511` completed every workflow step
successfully, including native application flows and browser evidence. Local checks
passed 36 unit, 7 HTTP, 6 browser and 5 recovery scenarios, both production builds
and the 12-migration populated PGlite upgrade/restore. It adds named Reels / Shorts
(1080×1920), Landscape video (1920×1080) and Square feed (1080×1080) export presets
plus Custom; preset-only requests normalize into immutable job options and conflicting
dimensions are rejected.
These records do not diagnose ChatGPT buffering.

## Next work

Publish the reviewed EDITOR-01J source/docs payload after exact authorization and
verify its own GitHub Actions run. Prior EDITOR-01I post-CI evidence travels in the
same payload; its successful CI must not be attributed to EDITOR-01J.

Continue EDITOR-01 language/font/audio QA with broader Indic/CJK shaping, device/font
matrix and audio QA after EDITOR-01I fallback-font/readability smoke coverage. Automatic
speech alignment remains open. MEDIA-01D remaining provider/reference modes still require a
provider choice, and MEDIA-LIVE-01 tracks authorized provider acceptance separately. Then continue sourced research, official
publishing, analytics/growth, administration, notifications, data lifecycle and
broader collaboration UX from TASK_BOARD.md. Do routine local work independently;
request only essential external access or concrete authorization.
