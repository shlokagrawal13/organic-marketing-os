# Organic Marketing OS — 0.9.2

## EDITOR-01V saved CJK locale and font/readability verification — 2026-10-07 (IST)

EDITOR-01V is locally verified: saved per-render zh-Hans/zh-Hant/ja/ko locale, four independently default-disabled script opt-ins, controlled language-sensitive Fontkit outlines and conservative grapheme-safe wrapping. Complete 168/168 units passed on each of the modern and actual Ubuntu CI font sets (336 unique case receipts, 38 summaries, zero failed/cancelled/skipped/todo), 7 HTTP, 7 production-browser and 5 recovery/config cases. API/web production builds, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability audits passed. HarfBuzz 8.3.0 matches 14775 covered CJK strings (42 curated; all 11172 modern Hangul syllables), 160 regional Han font/locale cases and 28 mixed-script reference runs; four generated Han strings without font coverage are explicitly rejected. Clean full/production CJS/ESM exports independently match 183488 layouts across both font sets and retain the fifteen-script regressions. Each font set passed 72 new CJK exports / 216 decoded timed frames; sixteen representative frames were visually reviewed. ICU 74.2 strict independently accepts every emitted boundary in 176 cases. Natural recovery lock=119962ms, provider submission count 1. Public V publication and its own native CI remain pending; EDITOR-01 stays Partial.

Saved locale, trusted single TTF/OTF (16 MiB cap), complete-grapheme fallbacks, controlled outlines, effective cue overrides, captions-off and original Unicode/SRT are retained. NFC is shaping/measurement only. Locale/font changes rebuild caches; unchanged renders reuse them. Scene revision: mos-render-9-cjk-locale-uax14. The prior fifteen-script outline revision and guarded Fontkit 2.0.4 patch remain unchanged. Pinned linebreak 1.1.0 uses a Unicode 13 baseline with strict non-starters/opening-bracket and Korean/dictionary word protection; this is bounded acceptance, not universal current-Unicode conformity. Missing fonts, truncated fonts, oversized units, invalid/missing locale and mixed RTL are rejected. HTTP missing-locale requests create no job. Browser verifies saved locale and Japanese snapshot video. See docs/CJK_RENDERING.md and docs/qa/cjk-batch-evidence.json.

The first expanded HTTP matrix timed out at its inherited 120-second whole-case deadline. The bounded 180-second corrected case retains all assertions and each 60-second per-render wait; its fresh complete flow passed. The Japanese contextual-kerning issue and an incorrect mixed-reference font assumption were corrected without waiving failed inputs. Failed/incomplete probes are retained separately and excluded. Recovery used verified U closure revision 2026-10-07.11 / SHA-256 52e071434cc4bf6be68cf9eba61aa47c33c0322216f209a10227974aa5aa9e92; older checkout and runtime data remain preserved.

Local application verification uses disposable PGlite WASM PostgreSQL, native Redis 7.2.11, S3Proxy and synthetic providers. Public main ca7d7a34eddd791df55f0996c41b77d27179db9e / U Actions 37608908118 remains the last verified native application CI and applies only to U. No V public write is authorized or attempted. CJK variation sequences/per-overlay languages, broader font/device/readability, Indic/SEA joiner/control, ASR/audio/custom effects/platform/semantic acceptance, native cross-store restore/full Compose/MinIO and live/master acceptance remain open. Historical sections retain prior evidence.

## EDITOR-01U CI-fix publication and own native CI closure — 2026-10-07 (IST)

EDITOR-01U's explicitly approved 28-file CI-fix/source/docs/evidence payload is published at ca7d7a34eddd791df55f0996c41b77d27179db9e, tree d45e9e17d04a96cbbcb66654ae1958d216c5eb8e; all 242 public paths/modes/blob hashes match immutable reviewed source 5480b3fd3a7fa96687abe37804f0fd4d811fd5e7. Its own Actions 37608908118 attempt 1 completed successfully at 2026-10-07T10:50:25Z. Clean install with guarded Fontkit postinstall, API/web production builds, all 144 unit cases with zero failed/cancelled/skipped/todo and 144 unique receipts/18 summaries, 7 HTTP, 7 production-browser, 5 recovery/config cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability audits passed. The actual Ubuntu fonts passed all five new HarfBuzz reference/export matrices including the Myanmar mark offset, and retained Indic regressions. Native timings/archive hashes and artifact integrity are retained separately. The previous original U run failed 140/143 and remains excluded from pass evidence. Local dual-font verification retains 288 unit receipts, 65560 clean-export reference layouts, 180 new-script exports/540 timed frames and 20 visually reviewed representative frames; those local counts are separate from this native CI.

Own U CI-fix application CI uses disposable native PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore separately uses PGlite. Docker/full Compose/MinIO, native PostgreSQL/private-media cross-store restore, live providers, physical-device readability and full master acceptance remain open.

All fifteen script opt-ins remain independently default-disabled. Shared registry, trusted complete-grapheme font runs, controlled Fontkit outlines, Unicode SRT and bounded dictionary wrapping are retained. Indic/SEA joiners/word-break controls, CJK, broader font/device/readability, ASR/audio/custom effects/platform/semantic acceptance and live/master acceptance remain open; EDITOR-01 stays Partial. Next: CJK/font/readability, then focused Indic/SEA joiner and device acceptance.

This dated continuity closure is retained locally in the portable handoff; it was not added to the approved public payload. Original older dirty checkout and user runtime data remain preserved. Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.


## EDITOR-01U publication and CI-fix verification — 2026-10-07 (IST)

EDITOR-01U's exact approved 43 files are published at ed82e963cfaa4033703c3f22ca992b60aab26ea3 (tree 8d0f8bcdae09e284a4650241c35036b4eeb74fc5); all 240 public paths/modes/blob hashes match immutable reviewed source. Own Actions 37604254705 attempt 1 failed 140/143 unit cases: two inherited-Thai-flag assertions and one older-Noto Myanmar mark offset. Audits/upgrade/native application flows were skipped and are not pass evidence. The CI follow-up is locally verified: complete 144/144 units on each of the newer and actual Ubuntu CI font sets (288 case receipts, 36 summaries), 7 HTTP, 7 production-browser, 5 recovery/config cases, API/web production builds, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits. Four clean CJS/ESM exports independently matched 65560 HarfBuzz 8.3.0 layouts across both font sets and all fifteen registered scripts. Each font set also passed 90 new-script exports/270 timed frames, 115 curated/7406 unique covered new-script strings and 18 combined reference runs; twenty representative frames were visually reviewed. The corrected payload and its own native CI remain pending.

The runtime fix uses coverage-sensitive mark-to-base attachment and preserves contiguous uncovered MultipleSubst boundaries. The first multiplied output now carries its multiplied flag. Pristine and exact complete R/T/original U/fixed U patch inputs are accepted under the original upstream hash/version guard; partial/unknown/version-changed inputs still fail before any export write. Bengali/Gujarati tests explicitly isolate and restore the Thai opt-in. Every outline revision is now fontkit-outlines-v3-context-mark-base-coverage; the scene cache is mos-render-8-mark-base-coverage. Dependency records, schema/migrations and frontend remain unchanged. No glyph mismatch was waived or failing input removed.

Own CI-fix local application harness: disposable serialized PGlite, Redis 7.2.11, S3Proxy 4.1.1, real FFmpeg and synthetic providers. Native PostgreSQL CI requires publishing the separately reviewed fix payload; no Docker/full Compose/MinIO, native cross-store restore, live providers, physical devices or master acceptance established. Recovery naturally expired a 119873ms Redis lock, retained the provider receipt/private output/completed queue job and made exactly one video submission.

All fifteen per-script opt-ins still default to false. Indic/SEA joiners and word-break controls, CJK, broader font/device/readability, ASR/audio/custom effects/platform acceptance and live/master acceptance remain open; EDITOR-01 stays Partial. Original older dirty checkout and user runtime data are preserved. Publish the separately reviewed CI-fix payload and verify its own native run before continuing CJK/font/readability. Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define current state.


## EDITOR-01U Southeast Asian/Tibetan verification — 2026-10-07 (IST)

EDITOR-01U is locally verified: separately opt-in Thai/Lao/Khmer/Myanmar/Tibetan overlays use the shared registry, trusted complete-grapheme font/script runs and controlled Fontkit outlines. Passed API/web production builds, a complete 143-unit summary (zero failed/cancelled/skipped/todo, 143 unique case receipts and 18 summaries), 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits. HarfBuzz 8.3.0 independently matches 115 curated and 7406 unique total covered new-script strings in both CJS/ESM and runtime emitted outlines, plus 18 combined Latin/Greek/Cyrillic/fifteen-script reference runs. Each new script passed 18 pure/mixed exports and 54 decoded timed frames across six geometries/standard-inset placement (90 exports/270 frames total); ten portrait/mixed-landscape samples were visually reviewed for visibility and clipping. Clean full and production-only installs matched 32780 reference layouts across four exports, including all fifteen scripts; their patched bytes match the working install. Default DejaVuSans Lao additionally matched 21 cases in both exports and runtime outlines. Recovery naturally expired a 119920ms Redis lock; its case took 128.1s with exactly one video submission and the retained provider receipt/private output/completed queue job. The exact U publication payload and its own native CI remain pending.

All five new RENDER_<SCRIPT>_ENABLED flags default to false and remain independent of the ten Indic opt-ins. Both API and worker need each selected opt-in, trusted complete-grapheme/derived-glyph TTF/OTF coverage and FFmpeg librsvg. Tibetan diagnostics use NotoSerifTibetan-Regular.ttf. Missing original/derived glyphs, truncated fonts and mixed RTL fail before queue/storage/cache work; separate overlays, effective caption overrides and Unicode SRT remain supported. Dictionary word wrapping protects leading vowels, multi-grapheme words and Tibetan tsheg; oversized words reduce size or fail readably. Preserve legitimate joiners/word-break controls and use image fallback until their acceptance is verified. Fourteen modern Lao letters absent from the pinned test font (112 generated diagnostic strings) were identified as missing coverage and excluded from matching evidence, not accepted as .notdef.

The version/upstream-hash-guarded, idempotent Fontkit 2.0.4 CJS/ESM postinstall retains R/T null-anchor/mark-filtering/Sinhala fixes and adds Sara Am handling, copied nearest-first OpenType backtrack arrays, a dedicated per-syllable Myanmar shaper, contextual multiple-substitution cursor/base-attachment corrections and Tibetan USE category/dotted-circle fixes. The checked Myanmar grammar reproduces 84 states with 42 category columns offline. Every outline revision and the scene cache version are bumped for shared shaping/measurement changes. Pipe output preserves split UTF-8 without raising its size cap; large reference tests use batches of 100. Dependency records/versions/lockfile, schema/migrations and frontend are unchanged. HarfBuzz/Python remains a test oracle. Raw logs, installed dependencies and test-font bytes are excluded. Initial failures and corrections remain in docs/qa/southeast-batch-evidence.json; an earlier 142/143 unit run with an outdated error-wording assertion is excluded, and the full suite was rerun successfully.

Own U application checks use disposable serialized PGlite, native Redis 7.2.11, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore separately uses PGlite (4865827-byte archive, SHA-256 9d83b40a6628f8a540b66f851ff96bf83a932924edc3ae06132a56f86cd964a5). T public main eede92658ebde9e214c998442ae7988b4e1734e4 / Actions 37529863574 is still the last published native PostgreSQL/Redis evidence and applies only to T. No U public write or live/paid-provider call has been attempted. Original older dirty checkout was preserved; U was recovered and verified in an isolated checkout. Reference/frame acceptance is bounded, not every language/font case or physical-device readability. Indic/SEA joiners and word-break controls, CJK, broader font/device/readability, ASR/audio/custom effects/platform acceptance, actual Docker/full Compose/MinIO, native PostgreSQL/private-media cross-store restore and live/master acceptance remain open; EDITOR-01 stays Partial. After U publication/own CI, continue CJK/font/readability, then focused Indic joiner and device acceptance.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current U state.


## EDITOR-01T publication closure — 2026-10-07 (IST)

EDITOR-01T's approved 48-file source/config/docs/evidence payload is published and its own native CI verified. Public main eede92658ebde9e214c998442ae7988b4e1734e4, tree 5a9241f00bae03348b46d03cf384f57aeba78336; all 231 public blob paths/modes/SHAs match immutable local source a54dad774cf7569c42a1a005f12a24c0ca98fe4f. Actions run 37529863574 attempt 1 completed successfully at 2026-10-06T21:04:17Z. Logs confirm clean npm install with the guarded Fontkit patch, API/web production builds, a complete 113-unit summary with zero failed/cancelled/skipped/todo cases, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits. All seven independent script reference diagnostics and render matrices pass: 100 curated strings plus 656 generated Sinhala cases, 13 combined script reference runs, 126 exports and 378 decoded timed frames. CI reference engine: HarfBuzz 8.3.0 (emitted in all seven CI script diagnostics). Recovery naturally expired a 119830ms Redis lock; its case took 158.6s with exactly one video submission and the retained provider receipt/private output/completed queue job.

The shared registry centralizes script settings for API and worker while retaining separate script/font runs, opt-ins and acceptance tests. Gurmukhi, Odia (Unicode Oriya), Tamil, Telugu, Kannada, Malayalam and bounded non-joiner Sinhala remain disabled by default. Trusted complete-grapheme TTF/OTF coverage and FFmpeg librsvg are required. The guarded Fontkit 2.0.4 CJS/ESM fix covers null GPOS anchors, GDEF mark filtering/precedence and Sinhala mark advances while retaining the existing Indic GSUB shaper. Hindi/Bengali/Gujarati shaping fingerprints are bumped; plain overlay identity is retained. A 1e-7-pixel fractional-edge tolerance preserves actual-overflow rejection. Dependency records/versions, schema/migrations and frontend are unchanged. HarfBuzz/Python is a test oracle, not a runtime dependency. Local clean full/production-only installs matched 3024 reference runs. Previously resolved or incomplete findings remain preserved; no failed/incomplete run is counted as pass evidence.

Native application CI uses disposable PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore separately uses PGlite; it does not establish native PostgreSQL/private-media cross-store restore. No live/paid provider or user runtime data was used. Bounded reference/frame checks do not establish every language/font case or physical-device readability. Sinhala ZWJ/ZWNJ conjuncts remain explicitly unverified: preserve legitimate joiners and use image fallback; do not strip them. Other Indic joiners, Thai/Lao/Khmer/Myanmar/Tibetan, CJK, general bidi/font/device/readability, ASR, wider audio/custom effects/platform acceptance, actual Docker/full Compose/MinIO, native cross-store restore, live providers and full master acceptance remain open; EDITOR-01 remains Partial.

This dated 16-file publication/CI continuity closure is retained locally in the portable handoff; no additional public payload was attempted. The approved public source is the exact tree above. Historical pending sections below describe earlier checkpoints. Next: Southeast Asian/Tibetan, then CJK/font/readability batches, with independent per-script checks and explicit joiner/device gaps; release counts depend on actual findings.

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
it is not a database/media restore backup. The latest approved public source is EDITOR-01T at `eede92658ebde9e214c998442ae7988b4e1734e4`; Actions run `37529863574` passed its own native application verification. The dated publication/CI continuity closure is retained locally in this handoff.
