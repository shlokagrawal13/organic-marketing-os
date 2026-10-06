# Organic Marketing OS — 0.9.2

## EDITOR-01T shared registry and Indic batch verification — 2026-10-07 (IST)

EDITOR-01T is locally verified: one shared script registry adds separately opt-in Gurmukhi, Odia (Unicode Oriya), Tamil, Telugu, Kannada, Malayalam and bounded non-joiner Sinhala overlays. Passed API/web production builds, 113 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits. Independent HarfBuzz 8.3.0 matches 100 curated strings plus 656 generated Sinhala consonant/vowel cases against both CJS/ESM exports and runtime emitted outlines; 13 independently referenced runs compose Latin/Greek/Cyrillic plus all ten registered Indic scripts. Each new script passed 18 pure/mixed exports and 54 decoded timed frames across six geometries/standard-inset placement (126 exports/378 frames total); 14 representative portrait/mixed-landscape samples were visually reviewed for visibility and clipping. Recovery naturally expired a 119932ms Redis lock; its case took 128.1s with exactly one video submission and the retained provider receipt/private output/completed queue job. The exact 48-file source/config/docs/evidence public payload and its own native CI are pending.

The shared registry drives API/worker Unicode preflight, whole-grapheme script/font runs and outline cache revisions. All seven new RENDER_<SCRIPT>_ENABLED flags default to false; Odia uses RENDER_ODIA_ENABLED and NotoSansOriya-Regular.ttf. Both API and worker need each selected opt-in, trusted complete-grapheme single TTF/OTF coverage and FFmpeg librsvg. Same-overlay Arabic/Hebrew mixing, controls/emoji and the remaining unsupported scripts stay blocked; separate overlays, effective cue overrides and unburned Unicode SRT remain supported. Sinhala ZWJ/ZWNJ conjuncts are explicitly outside acceptance: preserve the joiners and use an image; no stripping recommendation. Other Indic joiner controls retain the existing rejection. Fontkit 2.0.4 has a version/upstream-hash-guarded, idempotent CJS/ESM postinstall for permitted null GPOS anchors, GDEF mark-filtering sets (both coverage formats; IgnoreMarks overrides filtering, filtering overrides attachment class) and Sinhala GDEF-mark advances before GPOS while retaining the existing Indic GSUB shaper. Clean full and production-only installs matched 3024 independent reference runs across their four exports. Truncated sfnt tables now fail inspection before storage/cache. Fractional inset edges use only a 1e-7-pixel rounding tolerance, retaining real-overflow rejection. Every existing Indic shaping fingerprint is bumped (Hindi v4, Bengali/Gujarati v2); the new batch uses fontkit-outlines-v1-indic-registry-mark-filter-sinhala. Ordinary plain paths retain their identity. The npm unit command uses two file workers and requires cumulative Node summary and per-case receipts; zero exit without a complete summary fails verification. Dependency versions/lockfile, schema/migrations and frontend are unchanged; HarfBuzz/Python is a test oracle, not a runtime renderer dependency. Test-font bytes/raw logs are excluded.

Initial findings are retained in docs/qa/indic-batch-evidence.json: truncated Telugu fixture, Kannada mark-set filtering, Sinhala mark advances, two fractional inset matrix failures and an incorrect HTTP Analyst/outsider assertion were resolved or corrected; an incomplete full-unit log was excluded and the whole suite rerun with terminal-count checks. No failed/incomplete run is used as pass evidence.

Own T application verification uses disposable serialized PGlite, native Redis 7.2.11, S3Proxy, real FFmpeg and synthetic providers; populated upgrade/archive restore separately uses PGlite. S public commit 51cd7ae5cb2f3898dd3dea49d464ee156f7449a0 / Actions 37519604078 remains the latest native PostgreSQL 17/Redis 7 CI evidence, scoped to S only. These checks establish bounded reference/render acceptance, not every font/language case, general bidi semantics or physical-device readability. Sinhala/other Indic joiner acceptance, Thai/Lao/Khmer/Myanmar/Tibetan, CJK and broader font/device/readability QA remain open. ASR, wider audio/custom effects/platform acceptance, actual Docker/full Compose/MinIO, native cross-store restore, live providers and full master acceptance also remain open; EDITOR-01 stays Partial. Next planned batches are Southeast Asian/Tibetan, then CJK/font/readability; their number of releases depends on actual failures and acceptance findings, not an assumed fixed release count.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current T state.

### Historical EDITOR-01H checkpoint

EDITOR-01H enables Arabic/Hebrew rendered titles and burned captions when the configured font covers them. FFmpeg drawtext now pins `text_shaping=1`; Devanagari/Indic/CJK remain blocked with named errors until broader font/shaping support exists. Passed 42 unit cases, API/web production build and the full isolated verifier with 7 HTTP, 6 browser and 5 recovery scenarios. Local only; public publication and remote CI await current-payload approval.

### Historical EDITOR-01G publication

EDITOR-01G inspects the exact configured TTF/OTF glyph mappings before worker
storage/cache/media work. Missing glyphs produce safe scene/cue/codepoint errors
in render history; captions-off Unicode SRT stays supported. Passed 41 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases,
API/web production builds, 12 fresh migrations and a full npm audit with zero
advisories. Published to public main as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched 187/187 blobs. Actions
run `37277131959` completed successfully with configured native PostgreSQL/Redis
application verification. No live/paid provider was used.
Multilingual shaping remains open; see `docs/VIDEO_PIPELINE.md` for font setup.

### Historical EDITOR-01F publication

EDITOR-01F adds conservative rendered-text script preflight before queueing and
in the worker. Scene/cue errors explain unsupported text; captions-off Unicode
SRT and unused fallback captions are preserved. Passed 37 unit, 7 HTTP, 6 browser
and 5 recovery scenarios, API/web builds and populated PGlite upgrade/restore.
Published EDITOR-01F to public `main` as `72b796d6d93ae5f5da475e3c33d021858131df1e`;
tree `97e227fa6352de563f6e3d018704960f8e34264d` matched all 185 local blob paths,
modes and SHAs. Actions run `37228966502` completed successfully.
This does not implement multilingual shaping or configured-font glyph coverage.

### Earlier named export presets

EDITOR-01E adds named Reels / Shorts (1080×1920), Landscape video (1920×1080) and Square feed (1080×1080) export presets plus Custom. Preset-only requests normalize into immutable job options; conflicting dimensions are rejected. Source drafts/approval stay unchanged; history shows saved settings and identical geometry reuses scene caches. Passed 36 unit tests, 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios, API/web production builds, all 12 migrations and populated PGlite upgrade/fresh restore. Published to public main as application commit `06e5da96ec4e811b0a95510247db25c3d54ac669`; remote tree `092b502cca399cfe732d9743202f310b0c80d994` matched the local 185-blob tree exactly, and Actions run `37207895511` completed successfully. No live/paid provider was used. Presets cover geometry only; automatic platform text/composition changes, policy/safe-area validation and publishing remain open.

A working account, brand, content, media, workspace-operations and AI-credit milestone of the supplied AI Marketing OS V3 specification. **The full product is not finished or production-ready.** See `docs/PROJECT_STATUS.md` and the 161-row `docs/REQUIREMENTS_MATRIX.md` for the exact state.

Continuing in a new chat/account or coding agent? Begin with **`START_HERE.md`**. The source includes a current checkpoint, stable task IDs, verification evidence, access requirements and a one-message resume prompt. Generate/verify portable source checkpoints with `scripts/package_handoff.py` (optional Python 3 utility; no new application dependency).

## Upgrading an existing installation

Follow **`docs/UPGRADE_0.9.md`** and the referenced earlier upgrade notes. Preserve your existing `.env` and Docker volumes; do not run `docker compose down -v`.

## First installation

Install Node.js 24 and Docker Desktop with Compose. From this directory:

```bash
npm run setup
docker compose up -d --build
```

Open http://localhost:3000 and create your own account. Development verification/reset/invitation emails appear at http://localhost:8025. No demo account or performance data is seeded. The first image build needs internet access. Docker/MinIO execution for this release has not been verified in the build environment, where Docker is unavailable.

## What works

- NestJS API, PostgreSQL/Prisma with twelve migrations, Redis/BullMQ and a Next.js frontend.
- Accounts, HttpOnly sessions, rotation/revocation, email verification/recovery, organizations, roles, invitations and team access.
- Persistent Brand Brain/Creative DNA, version history, optimistic revisions and restore.
- Drafts, cumulative scene timelines, reorder/duplicate scene editing, comments, review/rejection/approval, approval invalidation, campaigns, editorial calendar, search and JSON exports.
- Queued text strategy/script/scene generation with compatible primary/fallback providers, validation and usage records.
- **Policy-aware model routing:** task capability, plan, declared quality, shared Redis health, configured dollar caps and comparable-fallback enforcement; ambiguous provider outcomes never start a second paid call.
- **Generated media:** saved image/voice/video jobs, rights and estimate acceptance, plan-aware models, bounded image/voice options, separately quoted editing with one to four verified private image references, fixed credit reservations, retained UNKNOWN output review, private validated outputs, restart recovery and revision-checked scene attachment. Enabled explicitly by an administrator; no live provider acceptance claimed.
- **Asset library:** private image/video/audio uploads, validation, previews, tags, search, deduplication, downloads, archive and restore.
- **Video studio:** uploaded media attached to scenes, reorderable/duplicable timeline scenes, per-scene Fit/Fill framing for images and video, actual FFmpeg MP4 rendering, uploaded narration/background music, manual timed caption cues with legacy full-scene fallback, portrait/landscape/square formats, progress/cancel/retry, reusable scene cache, preview and MP4/SRT/thumbnail downloads. Caption timing is manual, not automatic transcription or speech alignment.
- Separate approval for the exact rendered content revision, responsive light/dark UI.
- **Workspace health:** actual database/queue/storage/worker checks, tenant job counts, tracked storage usage and private workspace data export for owners/admins.
- **Credits & usage:** immutable history, accepted AI quotes, atomic reservations/settlement, queued-cancel release and review of uncertain provider outcomes. Restricted verified platform administrators can grant/correct/resolve credits. Self-hosted mode stays the default.
- **Billing:** database plans/entitlements/subscriptions, durable invoice records/views, explicit refund/dispute/fraud/proration policy and the official Stripe SDK contract for test/live configuration, hosted Checkout and Portal sessions, strict plan-price mapping, raw-signature webhook verification and Stripe subscription/paid-invoice mapping. The UI exposes billing only when configured; redirects never grant access.
- **Recovery:** queued AI jobs recover missing queue entries; interrupted provider calls fail without automatic replay; new jobs retain their original brand context.

To try the new workflow: **Asset library → upload media → Content library → Video draft → attach assets to scenes → Save → Render → Preview/download**. Review/approve the content before approving its rendered video. Text in a voiceover field is a script; it does not automatically synthesize speech. Generate AI voice explicitly in Asset library → Generate with AI, or attach recorded narration.

## AI configuration

In `.env`, set `AI_PRIMARY_URL`, `AI_PRIMARY_KEY`, `AI_PRIMARY_MODEL`, and declare its verified `AI_PRIMARY_QUALITY`. The provider must support compatible `/chat/completions`, JSON object responses and `max_completion_tokens`. Optional fallback uses `AI_FALLBACK_*` and is used only when its capability, quality, plan, health and cost policy remains compatible. Configure current per-million token rates before setting `AI_MAX_REQUEST_USD`; unknown-cost routes are blocked when a dollar cap is active. Then recreate API/text-worker containers. Never commit `.env` or put credentials in frontend code.

AI generation is fixture-tested, not live-provider verified. The test fixture is isolated in the verification harness and is never an application fallback. Rendering uploaded media needs no AI provider key.

For image/voice/video presets, explicit opt-in and current operator estimates, follow `docs/GENERATED_MEDIA.md`. Start the separate `media-worker`; provider keys stay on the server.

## Product-credit configuration

`BILLING_MODE=self_hosted` is the backward-compatible default. To enforce product credits, use `BILLING_MODE=credits`, configure per-task prices and restricted `PLATFORM_ADMIN_USER_IDS`, and restart API/text worker consistently. `BILLING_WEBHOOK_SECRET` protects the provider-neutral test endpoint. Stripe is disabled by default; `STRIPE_MODE=test` requires a test secret key, webhook secret and distinct Starter/Growth price IDs. Use `live` only after sandbox acceptance and production review. See `docs/BILLING.md`. No real Stripe account or payment was used in this release.

## Remaining work

Live generated-media acceptance and additional provider controls; word-aligned captions, motion/effects and platform variants; live sourced research/trends/SEO/AEO; official social OAuth/publishing; external analytics and growth learning; actual Stripe sandbox/live acceptance and money-moving refund/dispute lifecycle checks; retention/deletion; production observability, native cross-store restore exercises and full master acceptance. These require implementation, not just credentials.

## Verification

Run `npm run build`, `npm test`, `npm run verify:upgrade` and the isolated
`node scripts/verify-local.mjs --production-web` harness. See
`docs/VERIFICATION_REPORT.md` and `docs/qa/verification-summary.json` for checks
actually completed. The earlier missing Redis binary was resolved with the
optional checksum-pinned installer. Test fixtures never become runtime fallbacks.

EDITOR-01T production/full npm audits (2026-10-07 IST) report zero known npm advisories. This dated result excludes Java/S3Proxy, system FFmpeg/librsvg and application security. Native PostgreSQL races/restore, Docker/MinIO, live
providers and full master acceptance remain open.

The workspace NDJSON export includes records and authenticated media references;
it is not a database/media restore backup. The latest approved public source is EDITOR-01S at `51cd7ae5cb2f3898dd3dea49d464ee156f7449a0`; Actions run `37519604078` passed native application verification. EDITOR-01T is locally verified and awaits exact 48-file publication approval and its own native CI.
