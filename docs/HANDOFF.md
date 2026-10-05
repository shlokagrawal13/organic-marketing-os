# Project handoff — 0.9.2 / 2026-10-05 (IST)

Latest local increment: EDITOR-01J font-aware bounded text layout, locally verified.
Selected-font metrics replace average character-count wrapping. Word splits keep
graphemes intact, including combining accents; title/caption areas stay separate.
Overfull text at the 16px minimum fails with a safe scene/cue error before storage
or cache work. Draft text and SRT remain intact; cache version 6 invalidates old
layouts. Passed 47 unit, 7 HTTP, 6 browser and 5 recovery cases, production builds
and all 12 migrations. Eighteen decoded frames cover three aspects at 720/1080.
Review VERIFICATION_REPORT.md for the actual checks and resolved environment issues.
Next: exact approval/publication of the 18-file source/docs payload, including
the prior EDITOR-01I post-CI evidence, then verify EDITOR-01J's own Actions run.
No public write was attempted for EDITOR-01J. Broader language/audio/device QA,
Indic/CJK shaping and automatic speech alignment remain open.

Latest published increment: EDITOR-01I fallback font/readability QA. The render worker
loads trusted fallback fonts from `RENDER_FONT_FALLBACK_PATHS`, requires each title
or burned caption cue to be fully covered by one configured TTF/OTF, passes the
selected controlled font file to FFmpeg and includes the configured font-set hashes
in scene cache keys. A real FFmpeg frame decode verifies visible Arabic/Hebrew
overlay pixels when the primary font lacks those glyphs and the fallback supplies
them. Passed 44 unit, 7 HTTP, 6 browser and 5 recovery/configuration cases plus
API/web builds. EDITOR-01I source/docs were published to public `main` through
`27aaf5cd752ad3fb83c5127523eff01416ace53a`; the remote tree matched the verified
local tree. CI run `37315707338` failed only because three fallback-font tests used
a local URW/Nimbus font absent from the workflow. A one-file local test fix now
uses CI-installed DejaVu Serif/Sans and passes the focused suite plus `npm test`.
The approved follow-up was published as `56702de088f2e8d2198e3ea858dd96efe6b9d200`
with tree `d4e6cf0c0d93defb64e391a0a1496dae5d5f1534`; Actions run
`37317283904` completed successfully.

Previous published increment: EDITOR-01H RTL text shaping at
`2e33a2cc230ab99bed6d28a18a35853e4ab9c313`. Arabic/Hebrew titles and burned
captions are accepted when the configured font covers them; FFmpeg drawtext uses
explicit `text_shaping=1`. Passed 42 unit, 7 HTTP, 6 browser and 5 recovery/
configuration cases plus API/web builds.

Previous published increment: EDITOR-01G configured-font glyph coverage. The worker
inspects exact TTF/OTF bytes before storage/cache/media work and records bounded
safe missing-glyph/configuration errors in render history. Glyph mappings use
pinned Fontkit 2.0.4; configuration is trusted administration input. Passed 41 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases,
API/web production builds, 12 fresh migrations and a full npm audit with zero
advisories. Published to public main as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched 187/187 blobs. Actions
run `37277131959` completed successfully with configured native PostgreSQL/Redis
application verification. No live/paid provider was used.
Existing EDITOR-01F script restrictions and captions-off Unicode SRT behavior
are preserved. Populated restore was not rerun because schema/migrations did not
change; prior EDITOR-01F evidence remains dated separately.

Previous published increment: EDITOR-01F rendered-text script preflight. Shared API and
worker validation reports unsupported title/burned-caption text by scene/cue;
captions-off Unicode SRT and unused fallback captions are preserved. Passed 37
unit, 7 HTTP, 6 browser and 5 recovery scenarios, API/web builds, 12 migrations
and populated PGlite upgrade/restore. Exact commands and corrected failures are
in VERIFICATION_REPORT.md.

Published EDITOR-01G to public `main` as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched all 187 local blob paths,
modes and SHAs. Actions run `37277131959` completed successfully.
Post-publication continuity updates are local evidence and can accompany the next source payload.

Publication update: EDITOR-01E is published to canonical public `main` after exact current-slice approval. Application commit `06e5da96ec4e811b0a95510247db25c3d54ac669` points to tree `092b502cca399cfe732d9743202f310b0c80d994`; recursive verification matched 185/185 remote blob paths, modes and SHAs. Actions run `37207895511` completed successfully.

Follow-up EDITOR-01E docs-only evidence publication completed at `3348ee27b4338c6403ac7a70234d56cd94e9b354`, tree `ef47a192649746b0257dfc44c8d52a8d2c48b7c2`, after exact approval for the 13 continuity/evidence docs. The earlier automatic approval review rejection is retained as an audit event and was not bypassed.

## Earlier published increment: EDITOR-01E

EDITOR-01E adds named Reels / Shorts (1080×1920), Landscape video (1920×1080) and Square feed (1080×1080) export presets plus Custom. Preset-only requests normalize into immutable job options; conflicting dimensions are rejected. Source drafts/approval stay unchanged; history shows saved settings and identical geometry reuses scene caches.

Passed 36 unit tests, 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios, API/web production builds, all 12 migrations and populated PGlite upgrade/fresh restore.

Published and CI-verified. Public main application commit `06e5da96ec4e811b0a95510247db25c3d54ac669` has tree `092b502cca399cfe732d9743202f310b0c80d994`; Actions run `37207895511` passed. No live/paid provider was used. Presets cover geometry only; automatic platform text/composition changes, policy/safe-area validation and publishing remain open.

Next: continue broader EDITOR-01 language/audio QA, including Indic/CJK
shaping/readability or automatic speech alignment. Arabic/Hebrew shaping and
fallback-font smoke coverage are verified within their bounded scope; this is still
not OCR-level readability, font licensing review or universal complex-script
support.

The user asked to continue the stopped Organic Marketing OS build without losing
prior work. The exact private remote base was restored, v0.8.1 was verified and
committed locally, and work progressed into durable generated media and its UI.

## Preserve

- Architecture and full master spec; twelve additive migrations, all previous SQL
  retained. User credentials, runtime database and media were not accessed.
- Existing accounts/brand/content/review/campaigns/media/rendering, credits/billing,
  model-routing and agent-graph functionality.
- No invented marketing metrics. Synthetic provider outputs exist only in tests.
- No automatic paid retry after UNKNOWN or an interrupted submit boundary.
- Separate local fixture, native infrastructure, live-provider and full-product
  acceptance claims. Exact results live in VERIFICATION_REPORT.md and qa JSON.

## Version 0.9 changes

MediaGeneration persistence and OpenAI image/voice/video adapters now run through
scoped APIs, fixed credit reservations, BullMQ dispatch and private ingestion.
A saved provider ID permits video polling after restart; saved private bytes permit
ingestion recovery. Submission ambiguity keeps credits for review. Byte/magic/
ffprobe checks, quota and tenant dedup run before asset completion. Scene attachment
is explicit and revision checked, preserves other scenes and resets approval.

The Asset library generation panel includes configuration availability, preset,
rights note, estimate acceptance, durable history, private previews/downloads and
attachment actions. Media worker health and sanitized generation exports are wired
in. See GENERATED_MEDIA.md for exact presets, money semantics and remaining limits.

## Continue

Read the checkpoint and task board. MEDIA-01D now has plan-specific model
allowlists, bounded image/voice options, separately quoted editing with one to
four ordered verified private image references, active credit-resolution guards
and retained UNKNOWN output reconciliation. Custom voices, another provider and
video reference modes remain; MEDIA-LIVE-01 requires authorized live
model access and spend. Advanced editing and other master modules remain pending.
Do not reset all completed work to pending because native/live gates are open.

EDITOR-01A is now published and CI-verified: deterministic cumulative scene timing
and move, duplicate-with-new-ID and remove controls passed the full verifier,
including save and real FFmpeg render in the browser. EDITOR-01B manual caption
cues passed 33 unit, 7 HTTP, 6 browser and 5 recovery scenarios, production builds
and populated PGlite upgrade/restore. Its own publication and CI passed. EDITOR-01C Fit/Fill framing passed 34 unit, 7 HTTP, 6 browser and
5 recovery scenarios, builds and populated upgrade/restore locally, then was
published and CI-verified. EDITOR-01D bounded image motion is also published and CI-verified with 35 unit, 7 HTTP, 6 browser and 5 recovery cases plus builds/upgrade; public application commit `9334411055f63f33333044b2b4ce079420fa2596`, tree `8be7bfe6976d21a7db3411627548ebd8af7bd8c4`, Actions run `37191164246` success. EDITOR-01E named platform/aspect render presets are published and CI-verified; see the latest increment above. Automatic
speech alignment and broader EDITOR-01 completion remain open.

The source is published to public `shlokagrawal13/organic-marketing-os` main.
The earlier EDITOR-01D and EDITOR-01E automatic approval review rejections are closed audit events after
the user's explicit approvals for those public uploads. Never touch the unrelated
`OrganicMarketing` repository.

The previous account-side Actions gate is cleared. Application commit
`06e5da96ec4e811b0a95510247db25c3d54ac669` contains EDITOR-01E on exact tree
`092b502cca399cfe732d9743202f310b0c80d994`. Public run `37207895511` completed every native verification step
successfully.
No Windows deployment update or ChatGPT buffering root cause is claimed.
