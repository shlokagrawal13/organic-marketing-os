# Changelog

## SOCIAL-01 YouTube OAuth callback local verification — 2026-10-09 UTC

The published `02f8fb1` provider contract is now wired locally to owner/admin OAuth start and session-bound, one-time callback routes. The callback exchanges a PKCE proof, checks one owned channel and stores tenant/account-bound encrypted access/refresh tokens, with a role/session recheck and safe metadata response. The isolated API fixtures cover cross-tenant/role denial, wrong session, replay/concurrency, denied grant, role demotion, provider failure, missing configuration and token/code non-disclosure. No real Google grant or post occurred; the UI and refresh/provider revocation/dispatch remain open.

Final local verification: clean locked install and Fontkit postinstall, Prisma generate/validate, API and web production builds, 193/193 unit (22 summaries; zero failed/skipped/cancelled/todo), 11/11 HTTP, 7/7 production browser, 5/5 recovery, 15 fresh PGlite migrations, populated PGlite upgrade/archive restore, and both zero-vulnerability npm audits. The first restricted-sandbox unit run failed the media subprocess test; its 10/10 isolated cases and the complete final suite passed with normal local process I/O. SHA-verified Ubuntu Noto and four pinned CJK fonts were supplied outside source. Native PostgreSQL CI on this new delta remains pending. The 15-file prior CI closure and this local increment are not published; public `main` remains `02f8fb1`. SOCIAL-01 is Partial. Details: `docs/qa/social01-oauth-callback-evidence.json`. Earlier sections are dated history.

## SOCIAL-01 YouTube OAuth contract publication and native CI — 2026-10-09 UTC

The user approved the cumulative 19 source/docs/evidence paths. Public GitHub `main` is `02f8fb1d8fc7052b249f305cfe9b7b4790a1e079` (parent `d5cd5767d9000ad4ff0b959219904f4259b6c3de`, tree `78a843edf240c6f3ee1e9385d4faa567436f4b51`); all 301 public blob paths, modes and Git SHAs matched the reviewed source. Own native Actions run `37989266829`, job `114018963643`, attempt 1 succeeded: 193/193 unit cases with 193 unique receipts and 22 summaries including final, 9/9 HTTP, 7/7 browser, 5/5 recovery, 14 fresh native migrations, API/web production builds, 36/36 bounded English OCR plus 8/8 busy-background samples and blank negative control, populated PGlite upgrade/restore and both zero-vulnerability audits. Browser artifact `11644413628` SHA-256 matched GitHub metadata; ZIP CRC passed for 123 entries and all 44 OCR sample image hashes matched the report. The published provider helper has no API start/callback route or live Google call; SOCIAL-01 remains Partial. This later CI closure record is local and unpublished. See `docs/qa/social01-oauth-contract-native-ci-evidence.json`. Dated earlier pending sections below are historical.

## SOCIAL-01 YouTube OAuth provider contract (local) — 2026-10-09 UTC

Added a fixed-endpoint provider helper for official YouTube web-server OAuth. It generates random state and S256 PKCE proof, requests offline consent for YouTube read-only identity and upload scopes, validates token exchange/refresh scopes and required offline grant, fetches exactly one owned channel, and requires a successful provider response for grant revocation. The registered callback URI is server-configured and production HTTPS only. Clean locked install and Fontkit postinstall passed; four focused contract cases and API TypeScript build passed. The helper is not called by an API route: one-time state/session binding, callback persistence, refresh rotation/revocation in the database, policy, authenticated dispatch, scheduler and any authorized live post remain open. No Google request or public publication occurred. The published `d5cd576` source retains its own 189/9/7/5 native CI evidence; that CI does not cover this local helper. See `docs/qa/social01-youtube-oauth-contract-evidence.json`. Earlier sections below are dated history.

## SOCIAL-01 attempt-ledger publication and native CI — 2026-10-09 UTC

The user approved the exact cumulative 26 source/config/docs/evidence paths. Public GitHub `main` is `d5cd5767d9000ad4ff0b959219904f4259b6c3de` (parent `78b78a9cc057d20815c67ca5af6e4c2e79a41ae0`, tree `81a96ca2550a9d3e6b163fb1b9dcec7e78d2404a`); all 296 public blob paths, modes and Git SHAs matched the verified source. Its own native Actions run `37944332517`, job `113866571278`, attempt 1 succeeded: 189/189 unit cases with 189 unique receipts and 21 summaries, 9/9 HTTP, 7/7 browser, 5/5 recovery, 14 fresh native migrations, API/web production builds, 36/36 bounded English OCR plus 8/8 busy-background crops and blank negative control, populated PGlite upgrade/restore and both zero-vulnerability audits. Browser artifact `11624520187` ZIP SHA-256 matched GitHub metadata; CRC passed for 123 entries, and all 44 OCR sample image hashes matched the report. No external provider post occurred. This later closure record is local and unpublished. SOCIAL-01 remains Partial: official OAuth/refresh/provider revocation, verified read-only reconciliation, current platform policy, authenticated dispatch, scheduler and authorized live test post remain open. See `docs/qa/social01-attempt-ledger-native-ci-evidence.json`. Dated prior pending sections below are historical.

## SOCIAL-01 local connection and attempt ledger — 2026-10-09 UTC

Added a 14th migration for tenant-scoped YouTube connection metadata/encrypted token fields and immutable publication attempts. Tokens use AES-256-GCM with per-encryption nonce and tenant/provider/account-bound associated data; only safe metadata is listed. Owner/admin local revocation blocks reserved attempts and marks in-flight attempts UNKNOWN. The internal ledger requires exact approved video/render, upload scope and known future token expiry; an attempt commits SUBMITTING before an outbound boundary, stale submissions become UNKNOWN without retry, and unresolved/confirmed duplicates for the account and content revision are blocked. No OAuth creation route, scheduler, provider sender, verified lookup, live account or post is wired. The read-only lookup evidence flag is currently an internal caller assertion; a future adapter must verify it against the provider.

Final source verification passed 189/189 unit cases (21 summaries, zero failed/skipped/cancelled/todo) and 9/9 isolated HTTP scenarios with 14 fresh migrations, real FFmpeg media exports, token unit, API/web production builds, Prisma validation and populated PGlite upgrade/archive restore. Browser/recovery suites, dependency audits and native CI were not rerun for this local delta; the prior public native CI applies only to the foundation. The first broad unit attempt lacked optional fonts; SHA-verified test fonts were restored. A sandboxed Unicode child-process failure passed with local process I/O permission. Earlier full reruns were interrupted to fix unknown expiry and are not counted. Public `main` remains `78b78a9`; this new source and the prior 14 local closure files have not been approved for public publication. SOCIAL-01 remains Partial. See `docs/qa/social01-attempt-ledger-evidence.json`. Historical sections follow.

## EDITOR-01AE + SOCIAL-01 publication and native CI — 2026-10-09 UTC

The user approved the cumulative 30 source/config/docs/evidence paths. Public GitHub `main` is `78b78a9cc057d20815c67ca5af6e4c2e79a41ae0` (parent `470da707e0feb8fa5aaf8e2a829dbd32549f20b9`, tree `70b9911ce96df9bc5cfe8183ac6ba97d5d6d8c1d`); all 288 public blob paths, modes and Git SHAs match the verified source. Own native Actions run `37912786834` job `113761672603` attempt 1 succeeded: 188/188 unit cases with 188 unique receipts and 20 summaries, 8 HTTP, 7 browser, 5 recovery, 13 migrations, API/web build, 36/36 English OCR plus 8/8 busy-background crops and blank negative control, populated PGlite upgrade/restore and both zero-vulnerability audits. Browser evidence artifact SHA-256/CRC matched and its receipts were inspected. Raw account recordings, runtime fonts and secrets were not published. This closure record is local and not in the approved 30-file scope. SOCIAL-01 remains Partial: OAuth, authorized accounts, platform policy, durable provider attempts/UNKNOWN recovery, scheduler and live test post are still open. EDITOR-01 also remains Partial for broader real-content/device/platform/language acceptance. See `docs/qa/editor01ae-social01-native-ci-evidence.json`. Older sections below are dated history.

## SOCIAL-01 local publication preparation — 2026-10-09 UTC

A new tenant-scoped API prepares an immutable snapshot from an approved content revision. Video preparations require a finished render approved for that exact revision. A per-workspace UUID request key is idempotent and rejects conflicting reuse; editing/archiving content or removing approval invalidates active preparations, while historical snapshots remain. Role, tenant, concurrent request and cancel paths are covered by isolated HTTP tests. This is internal preparation only: no OAuth connection, platform rule engine, schedule, provider call, attempt receipt or published status exists. The 13th migration applied on disposable PGlite; the API build and focused HTTP test passed. The full 8-case HTTP suite passed with all 19 SHA-verified test fonts and real FFmpeg media exports. An earlier 7/8 run failed solely because this checkout lacked optional render font files; those were restored and the complete suite rerun. UI/recovery/unit/native CI were not rerun for this increment. Public main remains at AD; cumulative AE and SOCIAL-01 changes are local and unpublished. See `docs/qa/social01-foundation-evidence.json`.

## EDITOR-01AE busy-background title/caption contrast — 2026-10-09 UTC

A reproducible 320px OCR probe on the published Z high-detail test background read 7/8 reviewed Extra margins and Device safe English title/caption crops; the long Extra margins title failed despite human legibility. Burned text backdrops now use 85% black opacity in both FFmpeg drawtext and Indic/CJK SVG instead of 65%. The same pinned background and exact crop matrix now pass 8/8; the existing black-background readability matrix remains 36/36 with blank negative control. Text placement/timing/fonts/SRT are unchanged, and only text-bearing scene cache keys refresh. Selected renderer/placement/Hindi SVG/audio tests passed 16/16; API/web build and isolated production browser render/download/approval passed 1/1 with 12 migrations. Prototype mixed Hindi frames were visually inspected. Old Z phone videos remain the original bytes; new AE exports need their own phone/app review. This synthetic OCR gate does not establish real footage, all scripts, subjective style or physical-device readability. AE is local and unpublished; EDITOR-01 remains Partial. See `docs/qa/editor01ae-busy-readability-evidence.json`.

## EDITOR-01AB closure + AC + AD publication and own CI — 2026-10-09 UTC

The user approved the cumulative 22-file public scope. GitHub `main` now points to `470da707e0feb8fa5aaf8e2a829dbd32549f20b9` (parent `0d725bf221ae05b44d6343b5a316a04676a6dc92`, tree `dfec63b95563075557a4ae821398ebaf5ca20b65`). All 282 public blob paths, modes and Git SHAs exactly match the reviewed source. Own native Actions run `37906151524` attempt 1 succeeded: 188/188 unit cases with zero failed/cancelled/skipped/todo, 7 HTTP, 7 production-browser, 5 recovery/configuration, 12 migrations, 36/36 bounded English readability samples with blank negative control, API/web build, populated PGlite upgrade/restore and two zero-vulnerability npm audits. Browser artifact ZIP SHA-256/CRC matched metadata; 188 unique unit receipts/20 summaries and 36 OCR samples were inspected. Raw user screen recordings and runtime logs remain excluded. This follow-up closure record is local and unpublished. Subjective/real-content audio, wider device/platform/language readability, native cross-store restore, Compose/MinIO, live providers and full master acceptance remain open; EDITOR-01 stays Partial. See `docs/qa/editor01ad-native-ci-evidence.json`.

## EDITOR-01AD bounded loud-audio export QA — 2026-10-09 UTC

A full-scale synthetic narration/music mix at maximum supported music gain exceeded full scale after AAC decoding on the prior final assembly. Final assembly now disables limiter makeup gain, adds music-volume-aware output headroom and limits narration-only output. Existing scene caches stay valid; final audio is re-encoded. Real FFmpeg exported AAC peaks after the fix were 0.78931 for narration stereo, 0.52557 for loud mix stereo and 0.74327 for mono downmix; 4× stereo resampling stayed below full scale. Focused render/media/placement unit cases passed 16/16; API/web build and the isolated production browser media flow passed 1/1 with 12 migrations and real render/download/approval. The first browser attempt failed on absent optional font paths in the fresh checkout; supplying two verified local fonts made the same source pass. A restricted sandbox Unicode subprocess check also passed when run with working subprocess I/O. This synthetic peak check does not establish subjective balance, standardized true peak for all material or physical-device playback. Own native CI on AD awaits publication. Public main remains AB; cumulative AB closure + AC + AD is local and unpublished. EDITOR-01 remains Partial. See `docs/qa/editor01ad-audio-peak-evidence.json`.

## EDITOR-01AC safe initial portrait placement — 2026-10-09 UTC

New browser composer sessions now start at 9:16/720 with Device safe text placement already selected. A user can still explicitly choose Standard; the captured Reels/Shorts overlap warning appears, and choosing the Reels / Shorts preset again returns to Device safe. Previously selected Extra margins and saved render snapshots retain their explicit values. Only UI initialization and focused browser assertions changed; API/schema/renderer/legacy default serialization/dependencies are unchanged. Fresh `npm ci`, guarded Fontkit postinstall, API TypeScript and Next production builds passed. The isolated production `media.spec.ts` passed 1/1 after 12 fresh migrations and real render/download. Its first attempt stopped before tests because the clean checkout lacked API build output; the final source was rerun after build and passed. Full unit/HTTP/recovery/audits were not rerun for this UI-only delta; AB's own native CI remains prior evidence. The captured Standard failure and wider app/device/content/language acceptance remain open. AC is local and unpublished; EDITOR-01 remains Partial.

## EDITOR-01Z+AA+AB publication and own CI closure — 2026-10-09 UTC

The user explicitly approved the cumulative 28-file public scope. Published `main` at `0d725bf221ae05b44d6343b5a316a04676a6dc92` (parent `62eb9393dfc68d6b15e4f1da2dbe296c772dd5ee`, tree `6511bc0ea60af32dd2ae816b4438ebcdc4377b39`); all 279 public blob paths, modes and SHA-1s exactly match the reviewed source. Raw account screen recordings remain outside the repository. Own Actions run `37823837950` attempt 1 succeeded: 188/188 unit cases with zero failed/cancelled/skipped/todo, 7 HTTP, 7 production-browser, 5 recovery/configuration cases, 12 migrations, 36/36 bounded English readability samples, API/web build, populated PGlite upgrade/restore and both zero-vulnerability npm audits. The browser artifact ZIP digest matched GitHub metadata and CRC passed; 188 unique unit case receipts/20 summaries and the 36-sample OCR report with blank negative control were inspected. The earlier automatic approval rejection was resolved by the user's explicit approval. See `docs/qa/editor01ab-native-ci-evidence.json`. This later closure record is local and unpublished. Broader device/content/language acceptance, native cross-store restore, full Compose/MinIO, live providers and full master acceptance remain open; EDITOR-01 is Partial.

## EDITOR-01AB Reels/Shorts preset selection — 2026-10-08 UTC

The composer now selects Device safe when a user actively chooses the Reels / Shorts preset from Standard placement. A previously explicit Extra margins or Device safe choice is preserved. Users can still explicitly select Standard afterward; the captured app-overlap warning remains visible. The browser test covers these transitions, production render/download, and saved render snapshot isolation. `npm run build:web` and the isolated production `media.spec.ts` (1/1, 12 fresh migrations) pass on the final source. API, renderer, schema, dependencies and previously saved render options are unchanged. Full unit/HTTP/recovery/audits were not rerun for this UI-only change. This is local and unpublished; Z+AA+AB are pending exact public-scope approval. Wider devices, actual content, app versions and language/font readability remain open; EDITOR-01 is Partial.

## EDITOR-01AA bounded real-app UI review — 2026-10-08 IST

Six user-provided WhatsApp-transcoded Android screen recordings show the exact Z portrait fixtures in YouTube Shorts and Instagram Reels viewing UI. Standard placement **fails** in both: the long lower caption overlaps account/action text, and Instagram also shows the opening title near/under account/audio UI. Extra margins and Device safe show no overlap in the sampled playback. This is one captured phone/account/UI state (386×850 transcodes); phone model, native capture size, app versions, real footage and other devices remain unverified. Only recording SHA-256, timestamps and account-free observations are in `docs/qa/editor01aa-platform-review-evidence.json`; raw account videos are not packaged. The composer now warns when Standard 9:16 is selected and recommends Device safe for new social exports, while preserving existing saved settings. API/backend/renderer/schema/dependencies are unchanged. Web production build and isolated focused browser `media.spec.ts` passed (1 case, 12 fresh migrations, real render/download); full unit/HTTP/recovery/audits were not rerun for this UI/docs increment. AA is local and unpublished; EDITOR-01 stays Partial.

## EDITOR-01Z device review pack — 2026-10-08 IST

Added `scripts/prepare-device-review.ts`, `npm run prepare:device-review`, and `docs/DEVICE_ACCEPTANCE.md`. Saved three hashed portrait H.264 fixtures, selected frames and evidence under `docs/qa/editor01z-*` for actual phone/app UI review. The synthetic high-detail background exposed OCR noise and a partial Standard short read. No runtime renderer, API, schema, migration or dependency change. Y public/native CI passed; Z remains local and device/app acceptance remains pending.

## EDITOR-01Y bounded readability QA — 2026-10-08 IST

Added decoded-frame containment and cue-timing coverage for optional device-safe placement alongside inset, plus an isolated FFmpeg/Tesseract 36-sample English small-screen OCR check with a blank negative control. Native CI now installs English Tesseract data, runs the check and uploads QA artifacts. Selected local suite 14/14, API/web builds and OCR 36/36 pass; source rendering behavior is unchanged. Physical-device, platform-app and multilingual readability remain open.

## EDITOR-01W local verification complete — 2026-10-07 UTC

EDITOR-01W recovered from the durable WIP checkpoint and reran final verification on rebuilt dependencies. Modern fonts passed 187/187 unit cases with complete receipts; Ubuntu fonts-noto-core 20201225-2 passed the same 187/187 suite. The production build passed, isolated local application verification passed 7 HTTP, 7 production-browser and 5 recovery/configuration cases with 12 migrations, both npm audits reported zero vulnerabilities, and 30 generated control QA frames across both fontsets were reviewed with no clipping/visibility failure. Public GitHub publication and native W CI are not attempted yet and require separate explicit approval.

## EDITOR-01W recovery and verification in progress — 2026-10-07 UTC

Latest WIP: nested lookup insertion regression reproduced and corrected. Twenty-two focused cases pass on each font set; mixed CJK wrapping remains at complete joined font-unit boundaries. Fresh full/production installs, populated PGlite upgrade/archive restore and both zero-vulnerability audits pass. Historical 186-case unit run passed but source changed during execution; final 187-case suites are required. Application run passed seven HTTP checks and two browser cases, then ended without complete browser/recovery summaries; exact cause unconfirmed and no full application pass is claimed. Final verification continues. No W publication attempted.

EDITOR-01W reconstructed from the verified V durable checkpoint after the prior W scratch worktree/logs were absent in this runtime. The older dirty Q/R tree and verified V archive are preserved. Restored archive SHA-256 5960c811b93cdba456a9952db10823bf392e3dafa952353972d50bad1ffb260e; recovered 254-file manifest passed. Public main remains 96e1af064e8c6e2673c33260b157201f5ddfa3bd. No W publication is authorized or attempted.

Bounded ZWJ/ZWNJ/ZWSP/WJ policy, complete joined font units, control-aware line breaking, cmap/cache provenance and guarded CJS/ESM shaping fixes are implemented. Sinhala uses corrected USE syllable/reph/pre-base reordering; the prior 675 Sinhala and 1203 Tibetan reference strings pass on each font set. All fifteen new per-script control reference cases, wrapping/rejection and four Fontkit guards pass in each 21-case focused run. API/web production build passed. Full dual-font units/exports, application HTTP/browser/recovery, fresh installs/upgrade/audits and visual review are pending; W remains work in progress and EDITOR-01 Partial. Every script opt-in stays independently disabled by default. Initial failed probes, test syntax/mock fixes, CJK rejection ordering and the Khmer dictionary cut-before-ZWSP failure are retained as failures, not acceptance evidence.


## EDITOR-01V publication and own native CI closure — 2026-10-07 (IST)

EDITOR-01V's exact approved 48 files are published at 96e1af064e8c6e2673c33260b157201f5ddfa3bd, tree a7a3bee4048a80a23717a4269d00e057f7203083; all 254 public blob paths/modes/hashes match the immutable reviewed source. Own native Actions 37646367807 attempt 1 passed: 168 unit cases with complete terminal summary and unique case receipts, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, API/web production builds, 12 migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits. Native CJK reference/export checks and prior fifteen-script regressions passed. Artifact ZIP digest, CRC and every retained PNG/receipt hash were verified. EDITOR-01 stays Partial.

Own V application CI uses disposable native PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore separately uses PGlite. CJK variations/per-overlay locales, broader font/device/readability, Indic/SEA joiners/controls, ASR/audio/effects/platform/semantic acceptance, full Compose/MinIO, native PostgreSQL/private-media cross-store restore, live providers and master acceptance remain open.

The public source remains the exact approved 48-file payload. This later publication/CI closure is retained locally in the portable handoff and has not been published. Earlier dated pending sections are historical. Dual-font local verification remains separate: 336 unit receipts, 183488 clean-export reference layouts, 144 CJK exports/432 timed frames and sixteen representative visual reviews. Next: focused Indic/SEA joiner/control acceptance and broader font/device readability.

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

## EDITOR-01S publication closure — 2026-10-07 (IST)

EDITOR-01S's approved 25-file source/config/docs/evidence payload is published and its own native CI verified. Public main 51cd7ae5cb2f3898dd3dea49d464ee156f7449a0, tree 42abf968e0c0ab64fdfe0a665afd580e3b71f3fa; all 211 public blob paths/modes/SHAs match immutable local source 54d777e19042859a0b209d42663d93cf56126dae. Actions run 37519604078 attempt 1 completed successfully at 2026-10-06T19:39:45Z. Logs confirm clean npm install with the guarded Fontkit patch, API/web production builds, 73 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both npm audits with zero vulnerabilities. Independent HarfBuzz checks for 19 Gujarati conjunct/matra/reph strings pass against both CJS/ESM exports and emitted outlines; six independently referenced mixed-script runs match combined positions/scales. S's 54 decoded timed frames from 18 pure/mixed-script exports across six geometries/standard-inset placement pass; HTTP verifies private Gujarati MP4/SRT downloads and same-overlay Gujarati/RTL rejection before creating a job. Active-poll recovery naturally expired a 119831ms Redis lock; its case took 128.9s with exactly one video submission and the retained provider receipt/private output/completed queue job.

Gujarati remains a separate administrator opt-in (RENDER_GUJARATI_ENABLED=false by default), with trusted complete-grapheme TTF/OTF coverage and FFmpeg librsvg required. Gujarati-free Bengali/Hindi runtime fingerprints and ordinary plain-script paths are retained. Shared API/worker preflight rejects same-overlay Arabic/Hebrew mixing before queueing, while unburned Unicode SRT and cue overrides remain supported. Dependency package records/versions/integrities, the existing Fontkit 2.0.4 guarded null-anchor patch, schema/migrations and frontend are unchanged by S. HarfBuzz/Python remains an independent test oracle, not a runtime renderer dependency. The exact CI HarfBuzz version is not logged.

Native application CI uses disposable PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore is a separate PGlite check, not native PostgreSQL/private-media cross-store restore. No live/paid provider or user runtime data was used. Reference/pixel checks do not establish every Gujarati language/font case or physical-device readability. Other Indic/CJK, general bidi/language semantics, ASR, wider audio/custom effects/platform acceptance, actual Docker/complete Compose/MinIO, native cross-store restore and full master acceptance remain open.

This dated publication closure is retained locally in the portable handoff; the exact approved public payload is the tree above. Historical pending sections below describe earlier checkpoints. Next: bounded remaining other Indic/CJK/font/readability acceptance; EDITOR-01 remains partial.

## EDITOR-01S Gujarati overlay verification — 2026-10-07 (IST)

EDITOR-01S is locally verified: separate opt-in Gujarati titles/burned caption cues use trusted complete-grapheme font/script runs, including bounded Latin/Greek/Cyrillic/Devanagari/Bengali combinations. API/web production builds, 73 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits passed. Independent HarfBuzz 8.3.0 matches glyph order, advances, offsets and emitted outlines for 19 Gujarati conjunct/matra/reph strings in both CJS/ESM Fontkit exports; six independently referenced mixed-script runs also match combined outline positions/scales. 18 pure/mixed exports yield 54 decoded timed frames across six geometries and standard/inset placement; portrait/landscape samples were visually reviewed for visibility and clipping. Recovery naturally expired a 119914ms Redis lock; the case took 128.1s with exactly one video submission and the retained provider receipt/private output/completed queue job. The exact 25-file source/config/docs/evidence publication and its own native CI are pending.

Set RENDER_GUJARATI_ENABLED=true on API and render worker only after configuring a covering trusted single TTF/OTF and FFmpeg librsvg; default is false, independently of Hindi/Bengali. Missing complete-grapheme coverage fails before storage/cache work. Shared API/worker preflight rejects same-overlay Gujarati/Arabic/Hebrew mixing before queueing; separate overlays retain their independent directions. Controls/emoji and other unsupported scripts remain blocked for burned text. Unburned Unicode SRT and effective cue overrides are preserved; the remaining unsupported-script HTTP/SRT regression now uses Tamil. Gujarati-containing renders use fontkit-outlines-v1-gujarati-script-font-runs; Gujarati-free Bengali/Hindi and plain-script fingerprints retain their prior identities. No dependency/version/lockfile, Fontkit patch, schema/migration or frontend changes. HarfBuzz/Python is a test oracle, not a production renderer dependency. Test font bytes and raw logs are excluded from the source handoff; trusted runtime fonts remain administrator-provided.

Own S application verification used disposable serialized PGlite, native Redis 7.2.11, S3Proxy, real FFmpeg and synthetic providers; populated upgrade/archive restore separately uses PGlite. Prior R public commit acbec7b9d04ff064fafe27675d7822b3d19ca135/Actions 37516681778 remains the latest native PostgreSQL 17/Redis 7 CI evidence, scoped to R only. Reference/pixel checks do not establish every Gujarati language/font case, general bidi semantics or physical-device readability. Remaining other Indic/CJK, ASR, wider audio/custom effects/platform acceptance, actual Docker/full Compose/MinIO, native cross-store restore, live providers and full master acceptance remain open; EDITOR-01 stays Partial.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current S state.

## EDITOR-01R publication closure — 2026-10-07 (IST)

EDITOR-01R's approved 32-file source/config/docs/evidence payload is published and its own native CI verified. Public main acbec7b9d04ff064fafe27675d7822b3d19ca135, tree 7027772a44ea9b64ad0b20c14fe6012366de9ee0; all 208 public blob paths/modes/SHAs match immutable local source 5962cbfe755b26d61d28b8ab50ec6142c816b559. Actions run 37516681778 attempt 1 completed successfully at 2026-10-06T19:15:00Z. Logs confirm clean npm install with the guarded Fontkit patch, API/web production builds, 68 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both npm audits with zero vulnerabilities. Independent HarfBuzz checks for 12 Bengali conjunct/matra/reph strings pass against both CJS/ESM exports and emitted outlines. R's 54 decoded timed frames from 18 pure/mixed-script exports across six geometries/standard-inset placement pass; HTTP verifies private Bengali MP4/SRT downloads and same-overlay Bengali/RTL rejection before creating a job. Active-poll recovery naturally expired a 119928ms Redis lock; its case took 128.1s with exactly one video submission and the retained provider receipt/private output/completed queue job.

Bengali remains a separate administrator opt-in (RENDER_BENGALI_ENABLED=false by default), with trusted whole-grapheme TTF/OTF coverage and FFmpeg librsvg required. Bengali-free Hindi runtime fingerprints and ordinary plain-script paths are retained. The Fontkit 2.0.4 postinstall is version/hash-guarded and skips only missing GPOS mark-class attachment points. Local full and production-only clean installs were verified; native CI verifies the full clean install. Dependency package records/versions/integrities and schema/migrations are unchanged; the lockfile adds only root install-script metadata. HarfBuzz/Python remains an independent test oracle, not a runtime renderer dependency.

Native application CI uses disposable PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore is a separate PGlite check, not native PostgreSQL/private-media cross-store restore. No live/paid provider or user runtime data was used. Reference/pixel checks do not establish every Bengali language/font case or physical-device readability. Other Indic/CJK, general bidi/language semantics, ASR, wider audio/custom effects/platform acceptance, actual Docker/complete Compose/MinIO, native cross-store restore and full master acceptance remain open.

This dated publication closure is retained locally in the portable handoff; the exact approved public payload is the tree above. Historical pending sections below describe earlier checkpoints. Next: bounded remaining other Indic/CJK/font/readability acceptance; EDITOR-01 remains partial.

## EDITOR-01R Bengali overlay verification — 2026-10-07 (IST)

EDITOR-01R is locally verified: separately opt-in Bengali titles/burned caption cues use trusted complete-grapheme script/font runs, with bounded Latin/Greek/Cyrillic/Devanagari combinations and shared API/worker rejection of same-overlay RTL mixing. Clean full and production-only npm installs apply the reviewed Fontkit 2.0.4 Node GPOS null-anchor patch. API/web production builds, 68 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 fresh migrations, populated PGlite upgrade/archive restore and both zero-vulnerability npm audits passed. Independent HarfBuzz 8.3.0 reference checks match 12 Bengali conjunct/matra/reph strings in both CJS/ESM exports and emitted outlines. 18 pure/mixed-script exports yield 54 decoded timed frames across six geometries and standard/inset placement; portrait/landscape samples were visually reviewed. Recovery naturally expired a 119945ms Redis lock; the case took 128.0s with one submission and retained private output/provider receipt. The exact 32-file source/config/docs/evidence publication and its own native CI are pending.

Set RENDER_BENGALI_ENABLED=true on API and render worker only after configuring a covering trusted single TTF/OTF and FFmpeg librsvg; default is false, independently of Hindi. Common danda punctuation alone does not require Hindi opt-in. Missing whole-grapheme coverage fails before storage/cache work; unburned Unicode SRT and cue overrides are preserved. Fontkit previously crashed on a permitted null GPOS mark anchor in কর্ম. The version/hash-guarded, idempotent postinstall skips only inapplicable type 4/5/6 attachment lookups, without invented offsets or disabled GPOS features. Both Docker install stages copy the script before npm ci; actual Docker/Compose startup is not verified. The lockfile changes only root hasInstallScript metadata; every dependency record/version/integrity is unchanged. Bengali-containing renders use fontkit-outlines-v1-bengali-script-font-runs; Bengali-free Hindi renders retain v3 and plain-script renders retain their existing identity. HarfBuzz/Python is a test oracle, not a production renderer dependency; runtime shaping still uses Fontkit and controlled outline-only SVG/FFmpeg.

Application verification here uses disposable serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers. Last native full CI remains the separately dated Q sharp run 37491518572 at public 3834a452011c6a942fdcd8bc0c11699305380831 (63/7/7/5); it does not verify R. No schema/migration, paid/live provider or user runtime-data change. Reference/pixel smoke checks do not establish every Bengali language/font case or physical-device legibility. Other Indic/CJK, general bidi/language semantics, ASR, wider audio/custom effects/platform acceptance, complete Compose/MinIO, native cross-store restore and full master acceptance remain open.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current R state.

## EDITOR-01Q sharp follow-up publication closure — 2026-10-06

EDITOR-01Q's approved 16-file sharp dependency-fix/evidence follow-up is published and own native CI verified. Public main 3834a452011c6a942fdcd8bc0c11699305380831, tree 9a2d9f68bb9c235dce50c106bba29272660f68f9; all 203 public blob paths/modes/SHAs match immutable local source 0c1627938a5c77bf7a210328e28c311729225822. Actions run 37491518572 attempt 1 completed successfully at 2026-10-06T16:02:41Z. Logs confirm API/web production builds, 63 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration scenarios, 12 migrations, populated PGlite upgrade/archive restore and zero-vulnerability production/full npm audits. Q's 36 decoded timed mixed-script frames across 12 exports/six geometries/both placements pass on this patched source. Active-poll recovery naturally expired a 119843ms Redis lock and completed its case in 158.4s; the same provider receipt/private output/completed queue job and exactly one video submission were asserted.

Original Q commit 8c3267ac77fa6833aee1e6099cb042ff44fad345 / Actions 37488801724 passed builds and 63 unit cases, then failed production audit on sharp 0.35.4 / GHSA-wq5f-xc86-pv6w; upgrade/native application flows were skipped. That historical failure is preserved. The approved follow-up pins sharp 0.35.5 and changes only its 27 platform/prebuilt libvips package-family lock records; unrelated packages and application/schema/migration source are unchanged. Local PNG/SVG smoke checks verified sharp's bundled librsvg 2.63.2; this does not establish patching of system FFmpeg/librsvg or all deployment images.

Native application CI uses disposable PostgreSQL 17/Redis 7, S3Proxy, real FFmpeg and synthetic providers. Populated upgrade/archive restore remains a separate PGlite check, not native PostgreSQL/private-media cross-store restore. No live/paid provider or user runtime data was used. Other Indic/CJK, general bidi/language semantics, physical-device readability, ASR, wider audio/custom effects/platform acceptance, full Compose/MinIO, native cross-store restore and full master acceptance remain open.

This dated publication closure is retained locally in the portable handoff; the exact approved public payload is the tree above. Historical pending/failure sections below describe prior checkpoints. Next: bounded remaining Indic/CJK/font/readability acceptance; EDITOR-01 remains partial.

## EDITOR-01Q publication and sharp dependency follow-up — 2026-10-06

EDITOR-01Q’s approved 22-file source/docs/evidence payload is published at 8c3267ac77fa6833aee1e6099cb042ff44fad345 with matching tree 36c2de112243b98234e8845310c33cd0af200db3. Its own Actions run 37488801724 passed production builds and all 63 unit cases, including 36 mixed-script decoded frames, but failed the production audit on sharp 0.35.4 / GHSA-wq5f-xc86-pv6w. Native HTTP/browser/recovery and populated upgrade were skipped, so Q native full-suite success is not claimed. A narrow sharp 0.35.5 override/lockfile follow-up is now locally verified: clean npm ci, bundled librsvg 2.63.2 PNG/SVG decoding, both zero-vulnerability audits, API/web builds, 63 unit, 7 HTTP, 7 production-browser, 5 recovery/configuration scenarios and 12 migrations, plus populated PGlite upgrade/archive restore. The new 16-file dependency-fix/evidence follow-up awaits exact public approval and its own native CI.

The lockfile changes only sharp and its platform/prebuilt libvips package family; other locked packages, application behavior and schemas/migrations are unchanged. This patches sharp’s bundled library, not system FFmpeg/librsvg packages or every deployment image. Local application checks use disposable serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers. Native database/private-media restore, full Compose/MinIO, other Indic/CJK, general bidi/language semantics, physical-device readability, ASR, wider audio/custom effects/platform and master acceptance remain open. Last full native CI remains the separately dated P recovery run 37484095477.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01Q mixed LTR overlays — 2026-10-06

EDITOR-01Q bounded mixed LTR overlays are locally verified. With the existing Devanagari opt-in and covering fonts, Latin/Greek/Cyrillic/Hindi titles and burned cues use separate complete-grapheme script/font runs. API and worker now share the mixed-script boundary, rejecting Hindi combined with Arabic/Hebrew in one overlay before queueing. Passed API/web production builds, 63 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration scenarios, with 12 fresh migrations. Focused QA passed 36 decoded timed frames from 12 exports across six output geometries and standard/inset placement; portrait/landscape frames were visually reviewed. Q publication and own native CI are pending.

The isolated verifier uses serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers. Dependencies, schema/migrations, tenant/role/revision gates and ordinary non-Devanagari cache identity are unchanged. Devanagari outline runtime keys are bumped to v3. Audits and populated upgrade/archive restore were not rerun; dated P recovery Actions run 37484095477 at 981dd237c4a4d30bc7ed6b6a897c6617c09255f7 remains preceding native/full-audit evidence for P only. Bengali/other Indic/CJK, general bidirectional mixing, language semantics, physical-device legibility, ASR, broader audio/custom effects/platform acceptance, full Compose/native cross-store restore and master acceptance remain open.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01P recovery-follow-up publication closure — 2026-10-06

EDITOR-01P recovery-test hardening and its approved 16-file recovery-fix/evidence payload are published and CI-verified. Public main 981dd237c4a4d30bc7ed6b6a897c6617c09255f7, tree 312e5ce9efa1f78fef47a4a06d1037beb6eebbbb; Actions run 37484095477 attempt 1 completed successfully at 2026-10-06T15:10:34Z. Logs confirm 59 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated PGlite upgrade/archive restore and zero-vulnerability production/full npm audits. The deterministic interrupted poll left an active Redis queue job with 119834ms lock remaining; natural expiry/recovery completed the case in 158.4s with the same provider receipt, private output, completed queue job and exactly one video submission. All 200 remote blob paths/modes/SHAs match the approved local source.

Changes are confined to isolated tests/fixtures and evidence. Production API/UI/workers, dependencies and migrations are unchanged. Native CI uses PostgreSQL/Redis, S3Proxy, real FFmpeg and synthetic providers. This test budget does not establish a production recovery SLA. Wider-script/readability and device QA, ASR, broader audio/custom effects/platform acceptance, full Compose/MinIO, native cross-store restore and master acceptance remain open.

This publication closure is retained locally in the portable handoff. The exact approved public payload is the tree above; historical pending sections below describe earlier checkpoints. Next: bounded editor wider-script/readability QA.

## EDITOR-01P recovery-test hardening — 2026-10-06

EDITOR-01P recovery-test hardening is locally verified. A test-only first-poll barrier deterministically kills the real media worker with an accepted provider receipt and active BullMQ job. After confirmed process exit, the Redis lock/active state remains untouched and expires naturally. The scenario observes 119907ms lock remaining, completes in 128.2s, and verifies the same provider ID/private asset, completed queue job and exactly one video submission. The recovery completion wait is bounded at 210s and the whole case at 300s. Passed 7 HTTP and 5 recovery/configuration cases with 12 fresh migrations. Follow-up publication and its native CI are pending.

Changes are isolated test/fixture code and evidence. Application/API/UI/worker behavior, dependencies and migrations are unchanged. Builds, unit/browser, audit and populated-upgrade suites were not rerun for this follow-up. Dated P CI run 37479269861 attempt 2 at c2936113616522db099771684226276e91976957 remains prior full-suite evidence. Current local checks use serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers, not native PostgreSQL or paid services. This closes the reproduced test-deadline mismatch locally; it does not establish a production recovery SLA, physical-device/live-provider or full master acceptance.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01P publication closure — 2026-10-06

EDITOR-01P saved-render scene/caption review navigation and the approved 19-file source/docs/evidence payload are published and CI-verified. Public main c2936113616522db099771684226276e91976957, matching verified local source tree 1dc3dd5c2078ea93f9f7d863f48ed9791db0e6fa; Actions run 37479269861 completed successfully on 2026-10-06T14:41:45Z. Logs confirm 59 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 200 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Physical devices, ASR, wider-script/readability, full Compose/native cross-store restore and master acceptance remain open. Initial CI attempt failed the media-worker restart recovery wait after 25s; all 7 browser cases passed. The same approved source passed the later CI attempt. An isolated Redis/BullMQ reproduction left a killed worker job active with 119993ms lock remaining, beyond the 25s assertion. This queue mechanism supports a timing-race explanation; original application failure causality remains an inference, and recovery-test hardening is prioritized. No code fix is claimed.

This closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

## EDITOR-01P saved-render review navigation — 2026-10-06

EDITOR-01P saved-render scene/caption review navigation is locally verified. Scene starts and caption offsets come only from the immutable render snapshot, including stale renders. Native player seeks preserve play/pause, keyboard activation works, and half-open scene/cue highlights track playback. Buttons wait for metadata and disable on load failure; switching render IDs resets player state. Captions-off exports label SRT-only cues. API/web production builds passed; all 7 browser scenarios passed across the initial 6-case pass and corrected focused review-test rerun. Public P publication and native CI are pending.

This is a UI-only increment with no backend, schema, dependency, renderer/cache or API-contract changes. Unit, HTTP, recovery, audits and populated-upgrade suites were not rerun for P. Dated O Actions run 37473495143 at eb9c02338bc62ab38aadafd713586f4b80f35a79 remains the preceding full-suite evidence, not P verification. No live/paid provider or user runtime data was used. Physical-device playback, wider Indic/CJK/font/readability, ASR, broader audio/custom effects/platform acceptance and full master acceptance remain open.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01O publication closure — 2026-10-06

EDITOR-01O responsive selected/saved composition guides and the approved 17-file source/docs payload are published and CI-verified. Public main eb9c02338bc62ab38aadafd713586f4b80f35a79, matching verified local source tree a90d05e29183ddeaa6b5be908b2d9656ae5abee8; Actions run 37473495143 completed successfully on 2026-10-06T13:51:31Z. Logs confirm 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 196 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Guides are review diagrams; complete Compose/MinIO, native cross-store restore, device/font/ASR and full master acceptance remain open.

This closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

## EDITOR-01O composition guides — 2026-10-06

EDITOR-01O composition guides are locally verified. The selected-export diagram follows aspect, resolution, text placement, background and burned-caption controls; saved-render guides read immutable job options independently. Extra-margin boxes reuse the renderer geometry; standard positions are explicitly approximate. API/web builds and all 6 production-browser scenarios passed on final code, including real export playback/approval/download, guide controls, saved settings after navigation and mobile overflow. Public O publication and native CI are pending.

This is a UI-only increment. Unit, HTTP, recovery, audits and populated-upgrade checks were not rerun; dated EDITOR-01N CI run 37450673612 remains the last full-suite evidence for N. Backend rendering/options/cache behavior and dependencies/migrations are unchanged. Guides are review diagrams, not actual text/frame or font-overflow preflight, and are not added to exports. No paid/live provider or user runtime data was used. Full platform/device/ASR and master acceptance remain open.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01N publication closure — 2026-10-06

EDITOR-01N optional aspect-aware Extra margins and the approved 23-file source/docs payload are published and CI-verified. Public main c33dc6fd43ffed8e8ed85d78c5fa9b77972bca38, matching verified local source tree 1e404024f8f8c86d0b3a344c569552bf6711979d; Actions run 37450673612 completed successfully on 2026-10-06T10:38:56Z. Logs confirm 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 195 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Product composition margins do not guarantee official platform UI exclusion; complete Compose/MinIO, native cross-store restore, wider scripts/device/ASR and full master acceptance remain open.

This publication closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

## EDITOR-01N optional extra text margins — 2026-10-06

EDITOR-01N optional Extra margins text placement is locally verified. The versioned inset-v1 option uses aspect-aware title/caption boxes; portrait leaves more room on the right and bottom. Omitted placement preserves legacy options, positions and cache keys. Immutable render options and preview/history retain the selection. Changing placement rebuilds text scenes while empty scenes reuse cache. Passed 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds and all 12 fresh migrations. The new frame matrix covers 36 decoded Latin/mixed-Hindi frames across six output geometries. N public publication and native CI are pending.

These are controlled product composition margins, not official platform UI guarantees. Font/grapheme bounds, minimum size, caption timing and SRT content remain enforced. No dependency/schema/migration change, live/paid provider or user runtime-data change. Complete Compose/MinIO, native cross-store restore, wider scripts/device QA, ASR and full master acceptance remain open. Latest M native CI is historical evidence for M only.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01M publication closure — 2026-10-06

EDITOR-01M mixed Latin/Devanagari font runs and the approved 18-file payload are published and CI-verified. Public main eb8196e594889984651e9b93eb3ffe1bd2e195c2, matching local source tree 2504d062d94c7691d05365353d2746659c1b9f14; Actions run 37444585056 completed successfully on 2026-10-06T09:45:36Z. Logs confirm 56 unit, 7 HTTP, 6 production-browser, 5 recovery/configuration scenarios, API/web build, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. No live/paid provider or user runtime data was used. Complete Compose/MinIO, native cross-store restore, broader language/device/ASR and master acceptance remain open.

This publication closure is retained in the portable handoff. Historical pending sections below describe earlier checkpoints.


## EDITOR-01M mixed-script font runs — 2026-10-06

EDITOR-01M mixed Latin/Devanagari titles and captions are locally verified. Configured fonts can cover separate script/grapheme runs in the same overlay; complete conjuncts and combining clusters remain in one font. Glyph outlines use normalized font units and a shared baseline/line height. The Devanagari runtime fingerprint is bumped to avoid earlier cached layouts. Passed 56 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds and 12 fresh migrations. Public publication and M native CI remain pending.

Scope: opt-in Latin + Devanagari + common punctuation/numbers. A grapheme that no single configured font covers fails before storage/cache work; Devanagari mixed with RTL/other scripts is rejected. Existing non-Devanagari rendering retains its path. No new dependency, schema/migration, live/paid provider or user runtime-data change. Other Indic/CJK, mixed bidirectional text, ASR, device QA and full production acceptance remain open.


## EDITOR-01L publication closure — 2026-10-06

EDITOR-01L and its approved 13-file dependency/evidence follow-up are published and CI-verified. Public main commit 2326f1290453b09306928a3155b5f508b3710349, tree 0d5d567f1cff2e06112898c96af15a89e1300cb2, Actions run 37440418977 completed success. Logs confirm 54 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, production builds, all 12 migrations, populated upgrade verification and zero-vulnerability production/full dependency audits. Original L run 37439306560 failed the source-map-js audit; the approved patch to 1.2.2 resolves it. No paid/live provider was used. Complete Compose/MinIO, native cross-store restore, wider scripts/device/ASR and full master acceptance remain open.

This closure record is retained locally in the portable handoff; the approved public payload is the exact tree recorded above. Historical pending/failure sections below describe earlier checkpoints.


Patched-install checks: archive SHA-512 matches lockfile; installed package reports 1.2.2; Prisma generation/API/web production builds and 54 unit cases pass. Invalid nonfinite/negative/excessive source-map section offsets reject promptly; valid mapping lookup works. Production and full npm audits report zero vulnerabilities. Full application suites are retained as dated pre-patch L evidence and were not rerun for this transitive parser patch. Initial npm update changed the lock/hidden metadata but left installed bytes at 1.2.1; explicitly installed the integrity-checked official archive before final build/tests.


## EDITOR-01L publication and dependency follow-up — 2026-10-06

EDITOR-01L 24-file payload is published at 924eadc0f207ed85ac9bc387c85a49d62fb50675 (tree 7a98fac4edadd4713772825bc3ad0bacf6dd045e). Actions run 37439306560 passed build and 54 unit cases, then failed production audit for source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q); upgrade/native application checks were skipped. The follow-up changes only the lockfile entry to source-map-js 1.2.2; production/full audits report zero vulnerabilities. Follow-up publication/native CI pending exact authorization.


## EDITOR-01L Devanagari rendering — 2026-10-06

EDITOR-01K is published and CI-verified. EDITOR-01L adds opt-in Devanagari titles/captions using trusted Fontkit-shaped glyph outlines, rasterized through FFmpeg librsvg and composited before fades. Default remains disabled. A covering configured TTF/OTF is required for each whole overlay; Bengali/CJK, emoji and formatting controls remain blocked. Local verification: 54 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds and 12 fresh migrations. L public publication and native CI are pending.

No universal Indic/CJK, arbitrary mixed-font, physical-device or ASR acceptance is claimed. The Noto Devanagari test font does not cover English letters; mixed English/Hindi requires one configured font covering the entire overlay. No dependency/schema change, paid/live provider call or user runtime-data change. Full Compose/MinIO and native restore acceptance remain open.

K publication: `9c3e67c41f60a0a7408cca522cd7292a645425d9`, matching tree `fc45a64336541df456737f34629faff1f42f6502`; Actions run `37356934913` completed successfully.


## 0.9.2 EDITOR-01K audio output QA - 2026-10-05 (IST)

- Require stereo 48 kHz AAC, finite audio/video/container duration and aligned audio start on new/cached segments and final MP4; incompatible caches rebuild.
- Decode exported AAC to PCM to verify narration trim/padding, scene boundaries, muted embedded video sound, silent scenes, music looping/volume and cache reuse.
- Passed 49 unit, 7 HTTP, 6 browser, 5 recovery cases, production builds and 12 fresh migrations. No encoding/cache-key, dependency or schema change; no live/paid provider used.
- Local source/docs only; publication and this increment’s own CI remain pending. Broader language/device/subjective audio acceptance remains open.

## 0.9.2 EDITOR-01J font-aware bounded text layout - 2026-10-05 (IST)

- Replace character-count wrapping with selected-font metrics and grapheme-safe word splitting; preserve accents, fallback font selection and explicit RTL shaping.
- Bound titles/cues in separate areas with a 16px minimum font size. Overfull text fails with a safe scene/cue message before storage/cache work; SRT and saved drafts remain intact.
- Advance scene cache version to 6 so prior-layout segments cannot be reused.
- Add six output-geometry combinations with 18 decoded frames checking titles and captions independently, plus overfull-caption history and captions-off/cue-override coverage. Final checks and publication state are recorded in VERIFICATION_REPORT.md.
- Published as `ffb398d34279898074765141048cb6955e198c53` with matching tree; Actions run `37353516609` passed.
- No dependency, schema/migration, architecture or live/paid-provider change.

## 0.9.2 EDITOR-01I fallback font/readability QA - 2026-10-05 (IST)

- Added trusted worker-side fallback fonts through `RENDER_FONT_FALLBACK_PATHS`; `RENDER_FONT_PATH` remains primary and configured paths are deduplicated.
- Require each title or burned caption cue to be fully covered by one configured TTF/OTF, pass the selected controlled font file to FFmpeg and include all configured font hashes in the scene cache key.
- Added a real decoded-frame readability smoke check for Arabic/Hebrew overlay pixels when the primary font lacks those glyphs and the fallback supplies them.
- Passed 44 unit cases, API/web production builds and full isolated verification with 7 HTTP, 6 browser and 5 recovery/configuration scenarios. No migration, dependency version or live/paid provider change.
- Published to public `main` through `27aaf5cd752ad3fb83c5127523eff01416ace53a`; the remote tree matched the verified local tree. Actions run `37315707338` failed unit tests because the fallback-font fixture used a local-only URW/Nimbus font. The approved follow-up switches the fixture to CI-installed DejaVu Serif/Sans and is published as `56702de088f2e8d2198e3ea858dd96efe6b9d200`; tree `d4e6cf0c0d93defb64e391a0a1496dae5d5f1534` matched locally and Actions run `37317283904` passed.

## 0.9.2 EDITOR-01H RTL text shaping - 2026-10-05 (IST)

- Enabled Arabic/Hebrew rendered titles and burned captions when the configured font covers them; FFmpeg `drawtext` now explicitly sets `text_shaping=1`.
- Kept Devanagari/Indic/CJK, emoji and unsupported symbols blocked with named errors; captions-off Unicode SRT remains supported.
- Passed 42 unit cases, API/web production build and full isolated verification with 7 HTTP, 6 browser and 5 recovery/configuration scenarios after rebuilding dist. No migration, dependency or live/paid provider change. Published to public main at `2e33a2cc230ab99bed6d28a18a35853e4ab9c313`.

## 0.9.2 EDITOR-01G configured-font coverage - 2026-10-05 (IST)

- Inspect exact configured TTF/OTF bytes with pinned Fontkit 2.0.4 before worker storage/cache/media work. Font hash and copied FFmpeg bytes stay identical.
- Add bounded font loading (16 MiB), explicit invalid/missing/unsupported-font failures and safe scene/cue/codepoint errors in render history. Script policy, effective cues and captions-off Unicode SRT remain unchanged.
- Passed 41 unit, 7 HTTP, 6 browser and 5 recovery cases, API/web builds, 12 fresh migrations and zero-advisory npm audit. Published to public main as `d9a205799e69725bd4642014f8aaeeea710e1b3f`; tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched 187/187 local blobs, and Actions run `37277131959` passed. No live/paid provider or schema/migration change.
- Glyph mappings do not certify complex shaping or readability. Those remain next work; populated upgrade/restore evidence remains from EDITOR-01F.

## 0.9.2 EDITOR-01F rendered-text preflight - 2026-10-05 (IST)

- Added shared API/worker script and character policy for titles and effective burned captions, with scene/cue-specific errors before a new job is created.
- Preserve common punctuation, accents, captions-off Unicode SRT and unused fallback captions. Drafts/voiceover notes remain unchanged. No new migration, dependency or paid call.
- Passed 37 unit, 7 HTTP, 6 production-browser and 5 recovery scenarios, API/web builds, 12 migrations and populated PGlite upgrade/restore. Published at `72b796d6d93ae5f5da475e3c33d021858131df1e`; tree `97e227fa6352de563f6e3d018704960f8e34264d` matches 185/185 local blobs, and Actions run `37228966502` passed every step.
- This conservative check is not font glyph inspection or multilingual shaping support; those and wider language/audio QA remain open.

## 0.9.2 EDITOR-01E named export presets — 2026-10-04 (IST)

- EDITOR-01E adds named Reels / Shorts (1080×1920), Landscape video (1920×1080) and Square feed (1080×1080) export presets plus Custom. Preset-only requests normalize into immutable job options; conflicting dimensions are rejected. Source drafts/approval stay unchanged; history shows saved settings and identical geometry reuses scene caches.
- Passed 36 unit tests, 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios, API/web production builds, all 12 migrations and populated PGlite upgrade/fresh restore.
- Published to public `main` as `06e5da96ec4e811b0a95510247db25c3d54ac669`; remote tree `092b502cca399cfe732d9743202f310b0c80d994` matched 185/185 local blobs and Actions run `37207895511` passed every workflow step. No live/paid provider was used. Presets cover geometry only; automatic platform text/composition changes, policy/safe-area validation and publishing remain open.

## 0.9.2 EDITOR-01D bounded image motion — 2026-10-04 (IST)

- Added Static / Slow zoom in for images, with a legacy static default and a center zoom capped at 8% over the scene. Fit/Fill normalization bounds frame allocations; overlays remain stationary.
- Image motion survives save/reload, reorder, duplication, generated asset attachment and AI scene rewrite. Videos and text cards ignore the stored preference and reuse their cached segments.
- Added decoded-frame motion/border/bounds checks, extreme-aspect motion coverage, strict preset validation and browser persistence/render coverage. No dependency, migration or paid provider call.
- Published to public `main` as `9334411055f63f33333044b2b4ce079420fa2596`; remote tree `8be7bfe6976d21a7db3411627548ebd8af7bd8c4` matched 184/184 local blobs and Actions run `37191164246` passed every workflow step.

## 0.9.2 EDITOR-01C visual fit/fill — 2026-10-04 (IST)

- Added per-scene Fit/Fill for attached images/video with the legacy Fit default; stored mode survives reorder, save/reload, duplication and AI scene rewrite.
- Fill crops centrally before upscaling to bound intermediate frames, then preserves aspect ratio and removes edge rounding. No arbitrary filter, source mutation or migration.
- Verified actual pixels for wide images/video, tall images and extreme 8192×2/2×8192 inputs, plus mode-only cache reuse. Passed 34 unit, 7 HTTP, 6 browser and 5 recovery scenarios, API/web builds and 12-migration populated PGlite upgrade/restore. Published as `177936421b896737ed6ea424f7520c32651ee596`; Actions run `37189446835` passed every workflow step.

## 0.9.2 EDITOR-01B manual timed captions — 2026-10-03

- Added up to 60 ordered, non-overlapping scene-relative manual caption cues, millisecond input precision, bounded text and schema/UI validation; old scenes retain full-scene captions.
- Added cue editing, save/reload/reorder persistence, half-open FFmpeg burn-in, scene-offset SRT and cue-aware cache invalidation. Burn-off still exports SRT; this is not ASR or automatic word alignment.
- Passed 33 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios, API/web builds and the 12-migration populated PGlite upgrade/restore. Real decoded frames verify visibility inside/outside/end of cues. Published as `4611fb0170d4851be6bc6d805009c42a0ba5dd63`; Actions run `37143980421` passed every workflow step.

## 0.9.2 EDITOR-01A scene timeline editing — 2026-10-03

- Added deterministic cumulative scene start/end timing shared with SRT generation.
- Added accessible move-earlier, move-later, duplicate-with-new-ID and remove controls while preserving each scene's attached media and production fields.
- Extended the production-browser flow to reorder, duplicate, remove, save and render the edited storyboard.
- API and Next.js production builds, 31 unit tests and the full 7 HTTP / 6 browser / 5 recovery harness with all 12 migrations passed locally and in public Actions run `37126029720` for commit `97381d1f620eb5f30ec095522c7057c99ac8c1c6`.

## 0.9.2 MEDIA-01D ordered multi-image editing — 2026-10-03

- Expanded the separately quoted edit preset from one to four ordered, unique tenant-owned image references.
- Revalidate every private object by tenant prefix, 8 MiB per-image bound, saved length, SHA-256 and detected MIME before the paid boundary; any missing/corrupt reference prevents submission.
- Added multi-select Asset library controls, a shared API capability limit and ordered repeated `image[]` multipart fields.
- API and Next.js production builds, 31 unit tests and the full 7 HTTP / 6 browser / 5 recovery harness with all 12 migrations passed. The HTTP fixture uploaded two distinct references and verified a two-part provider edit request.

## 0.9.2 MEDIA-01D single-image editing — 2026-10-03

- Added an opt-in, separately priced single-image edit preset and asset-library reference picker. The worker verifies tenant ownership and private image bytes before multipart provider submission.
- Added isolated HTTP/unit coverage for edit quotes, source integrity, multipart bytes and end-to-end asset ingestion. Full local verifier passed; live provider acceptance and remote CI for this slice remain pending.
- Added bounded image size, quality and background selection plus built-in voice, WAV/MP3 and speed selection. Requests and audits freeze the normalized preset; provider adapters and the status/UI contracts use the same catalog.
- Passed API and clean Next.js production builds, 31 unit tests, 7 HTTP scenarios, 6 browser scenarios, 5 recovery/configuration scenarios and all 12 migrations after the option expansion.

## 0.9.2 MEDIA-01D retained output reconciliation — 2026-10-02

- Retained provider bytes written to private storage when the worker loses its database claim before ingestion, moving the generation to UNKNOWN with a private output pointer for platform review.
- Kept linked credit reservations in REVIEW and added `media_generation.output_reconciliation_needed` audit evidence without exposing private object keys through public/export responses.
- Added recovery coverage for retained private output reconciliation.
- Verified `npm run build:api`, `npm test` and full `npm run verify`: 7 HTTP scenarios, 6 browser scenarios and 5 recovery/configuration scenarios passed after the sandboxed S3Proxy attempt was rerun with local service permission.
- The earlier public account-side Actions gate was cleared; public run `37049004398` for `b2ac0ee74247ad8b9478bf82516161ea4211e69f` passed before this slice. This slice still needs publish and remote CI evidence.

## 0.9.2 MEDIA-01D credit reconciliation guard — 2026-10-02

- Blocked platform credit review resolution for reservations linked to active media generations until the media job is terminal.
- Added integration coverage for a REVIEW media reservation that returns 409 while PENDING and can be released after UNKNOWN.
- Published to public `main` as source commit `b48b40b92b20bdd1f2aa1d3287ebfe70586b773a`; remote tree `e641e612e9fb6966a9e9a0fc2e5236bc43d62ee8` matched 182/182 local blob paths/modes/SHAs. The push-created Actions run still stopped at an account-side startup gate.
- Verified `npm test` and `npm run build:api`; full local harness still stops before integration because S3Proxy exits with `Operation not permitted`.

## 0.9.1 MEDIA-01D plan/source gates — 2026-10-02

- Added per-kind generated-media plan allowlists through `MEDIA_IMAGE_PLANS`, `MEDIA_VIDEO_PLANS` and `MEDIA_VOICE_PLANS`; status/create now resolve the workspace plan before exposing or queueing configured models.
- Added source-reference ownership gates: source asset IDs must be unique active image assets in the same workspace before the current provider preset rejects unsupported source-byte editing.
- Updated provider config/audit records to freeze allowed plans and source asset counts.
- Published to private `main` as source commit `0b9dce36c95027723ea0529e734316b2af039131`; remote tree `c1918f5b14059606dc39b239d5f7ffc7b854b061` matched 182/182 local blob paths/modes/SHAs. GitHub Actions run `37005496060` still failed before jobs.
- Verified `npm test` and `npm run build:api`; full local harness was attempted but S3Proxy exited before readiness with `Operation not permitted`, so no new integration/browser pass is claimed.

## 0.9.0 verified private source publication — 2026-10-02

- Published the exact verified v0.9 source to private `shlokagrawal13/organic-marketing-os` main as application commit `b47c34fd9fd1fe9b24beea96aacb41a9a9dedf7b`.
- Verified remote tree `a85c8a0384083167121e6fa34f46d9ac837fba8c` recursively against local source: 182 blob paths, modes and SHAs matched with zero mismatches.
- Recorded GitHub Actions run `37002434700` as `startup_failure` before any job; no native CI pass, live provider acceptance or billing fix is claimed.
- Resolved the earlier automatic approval-review upload gate with explicit user approval for this private payload and destination; the unrelated `OrganicMarketing` repository remains excluded.

## 0.9.0 — 2026-10-01

- Added twelfth migration and tenant-scoped durable generated-media API/worker for OpenAI image, voice and asynchronous video contracts.
- Added operator estimates, accepted fixed credit reservations, queued-cancel release and uncertain-outcome review without automatic paid replay.
- Added bounded private ingestion, media validation/provenance, saved receipt/output recovery and revision-checked scene attachment with approval invalidation.
- Added Asset library generation UI, previews/downloads/history, media worker health and sanitized record export.
- Passed 28 unit, 7 HTTP, 6 browser and 4 recovery/configuration scenarios, production builds and 12-migration populated PGlite upgrade/restore. No live provider call or real payment.
- Extended media providers/references/reconciliation and native/live acceptance remain open. GitHub upload was rejected by automatic approval review for missing explicit source-export authorization; v0.9 remains local.

## 0.8.1 — 2026-09-29

- Recovered and verified the latest private source checkpoint. Added an unprivileged checksum-pinned Redis test installer and explicit harness startup diagnostics.
- Named billing/credit tables for assistive technology and scoped the credit-history browser assertion to its ledger table.
- Added MEDIA-01A generated image/video/voice lifecycle contracts and six tests for duplicate submission, ambiguous acceptance, costs, cancel races, polling and targeted rights/tenant input. Runtime integration remains MEDIA-01B/C.
- Fresh checks: 25 unit, 6 HTTP, 5 browser and 3 recovery/configuration scenarios pass; API/web builds, 11 migrations, populated PGlite upgrade/restore and both npm audits pass with zero advisories. Native PostgreSQL/Compose, live providers and master acceptance remain open.

## 0.8.0 — 2026-09-29

- Added a versioned task-specific orchestration graph with explicit contracts covering all 18 master agent roles; roles are executable durable steps rather than names embedded in a prompt.
- Added frozen retrieval of Brand Brain, Creative DNA and up to ten recent approved content examples at queue time. Research/community steps disclose absent external evidence instead of inventing it.
- Added `AIAgentRun`/`AIAgentStep` persistence, dependency/state/output traceability, provider-usage linkage, stale-worker failure handling and tenant-scoped trace export.
- Added post-generation compliance/orchestrator critique and a role-gated human approve/reject endpoint. Obvious blocked guarantees cannot be approved; generated results cannot enter the draft/scene workflow until approved.
- Updated the creation UI with graph state, findings, review controls and downloadable traces.
- Passed 19 unit tests, Prisma generation, API and Next.js production builds, populated PGlite upgrade/restore through 11 migrations, and production/full npm audits with zero advisories. Fresh full HTTP/browser/recovery execution remains blocked because this runner has no `redis-server`.

## 0.7.0 — 2026-09-29

- Added task capability, declared quality, plan, provider priority, shared Redis health and request-cost policy to the centralized text model router.
- Strategy and scene work require premium providers; fallbacks are prefiltered for comparable capabilities/quality and recorded explicitly. Unknown transport or invalid/charged output outcomes stop without a second potentially billable call.
- Added durable route evidence to `AIUsage`: retry count, quality tier, failure code, provider request ID, unknown-outcome flag and routing metadata. Credits & usage now exposes route/result context.
- Added a tenth additive migration, safe environment configuration, subscription-plan-aware worker routing and configurable per-request dollar caps that reject unknown costs before a call.
- Passed 16 unit tests, Prisma generation, API and Next.js production builds, populated PGlite upgrade/restore through 10 migrations, and production/full npm audits with zero advisories. Full verifier remains blocked because this runner has no `redis-server`.

## 0.6.1 — 2026-09-28

- Added durable `BillingInvoice` persistence, a ninth additive migration, tenant-scoped invoice list/detail API routes and invoice rows in Credits & usage.
- Extended signed `invoice.paid` events with invoice ID, status, currency, paid/due amounts and provider invoice/PDF URLs; Stripe paid invoices map those fields when supplied.
- Added explicit refund, dispute, fraud-warning and proration policy to the billing summary and UI without claiming real money movement.
- Verified Prisma generation, API TypeScript build, direct web TypeScript, unit tests, direct PGlite invoice processing and populated upgrade/restore through all nine migrations.
- Full local verification could not rerun in the current runtime because `redis-server` is unavailable and S3Proxy/localhost listeners hit environment limits. GitHub Actions remained blocked by a private account-side startup gate at that time.

## 0.6.0 — 2026-09-27

- Added official Stripe SDK test/live configuration, hosted Checkout and Customer Portal routes with idempotency keys, strict Starter/Growth price mapping and server-owned return URLs.
- Added raw Stripe signature verification, event-mode enforcement and durable mapping for subscription created/updated/deleted and paid invoices; browser redirects cannot grant access.
- Added current-plan/Checkout/Portal controls to Credits & usage and verified roles, request payloads, metadata, customer binding, replay and one-time grants against an isolated Stripe-compatible fixture.
- Added no migration. Actual Stripe sandbox/live acceptance remained open; invoice views and explicit billing policy were added in 0.6.1.

## 0.5.0 — 2026-09-27

- Added database-backed plans, entitlements, subscriptions and a durable billing-event inbox in an eighth additive migration; preserved the original seven migrations.
- Added raw-body HMAC/timestamp verification, exact event replay, changed-payload conflict rejection and deterministic out-of-order subscription protection for the isolated test billing provider.
- Added signed one-time monthly plan grants plus refund/expiry ledger corrections without rewriting immutable credit rows or allowing negative balances.
- Added tenant billing summary, strict role/cross-tenant checks, upgrade documentation and a sixth broad HTTP scenario. Stripe Checkout/Portal/invoices and real sandbox verification remain open.
- Passed builds, 12 unit, 6 HTTP, 5 browser, 3 recovery/configuration scenarios, all eight migrations, PGlite populated restore and both npm audits with zero known advisories.

## 0.4.0 verified private source publication — 2026-09-26.6

- Uploaded all 150 checkpoint files to the user-supplied private repository with independent history and matched every Git blob hash/mode.
- Recorded Actions startup_failure before any job; retry rejected. Native verification remains open pending the detailed startup diagnostic.
- Updated continuation records only; no application/migration changes or new application-test results.

## 0.4.0 private repository initialization — 2026-09-26.5

- Verified the NEW user-supplied private organic-marketing-os repository and write access. Preparing independent source history and native CI; results remain pending until remotely verified.

## 0.4.0 repository target correction — 2026-09-26.4

- Recorded the user's correction: OrganicMarketing is a different project; use a NEW private repository.
- Removed the unrelated repository from the active target and abandoned the prepared commit with its unrelated ancestry. Await the new URL; no source upload/native CI is claimed.
- Updated continuation records only; no application or migration changes.

## 0.4.0 GitHub preparation — 2026-09-26.3

- Located the existing public OrganicMarketing repository, documented its different legacy architecture and prepared an isolated v0.4 review commit.
- Created only a remote branch at the legacy commit. Automatic approval review blocked public source disclosure; v0.4 upload/PR/native CI remain pending authorization.

## 0.4.0 — 2026-09-26

- Added additive immutable credit ledger, atomic text-job quotes/reservations/settlement, queued cancellation release and uncertain-provider review.
- Added verified allowlisted platform credit authority, audited idempotent adjustments/review and real Credits & usage UI/export records. Self-hosted mode remains the default; paid plans/Stripe remain missing.
- Removed S3rver; use checksum-pinned private SigV4 S3Proxy for verification. Production/full npm audits each report zero known advisories; Java audit is outside that result.
- Fixed invalid task-output failures disabling unrelated provider requests; retained service-outage cooldown and no-extra-call accounting guards.
- Passed 12 unit, 5 HTTP, 5 production-browser and 3 recovery/configuration scenarios, seven migrations and populated PGlite restore including ledger immutability.
- Updated portable checkpoint, remaining tasks, GitHub access facts, upgrade instructions and sanitized evidence. Native Docker/PostgreSQL, live providers, paid billing and full master acceptance remain open.

## 0.3.0 handoff update — 2026-09-20

- Added portable start/resume instructions, structured checkpoint, stable remaining-task IDs, access requirements and session log.
- Added an offline source snapshot packer with SHA-256 inventory checking and secret/runtime-data exclusions.
- Made checkpoint updates part of AGENTS.md so future sessions preserve decisions, evidence, blockers and the exact next task.
- Clarified the actual unconfigured OpenAI-compatible text adapter and corrected outdated provider-catalog verification counts.
- Application runtime/dependencies/migrations remain 0.3.0; this update does not claim additional native/live or product acceptance.

## 0.3.0 — 2026-09-20

- Fixed AI request-key collisions with changed input; validate scene requests and freeze new job brand context/revision.
- Reconcile all queued text records after Redis entry loss; heartbeat/ownership/deadline handling prevents obsolete completion. Interrupted provider calls fail without automatic replay.
- Prevent usage-persistence errors from triggering paid fallback; bound provider response size and token counts; abort suppresses fallback.
- Correct content approval clearing and stale revision checks; improve render scene-stage reporting.
- Patch runtime nodemailer/multer/deepmerge-ts dependencies: production audit 0 known advisories; retain disclosure of 4 development S3rver-chain advisories.
- Add OWNER/ADMIN Workspace health with actual service/job/storage information and private paginated NDJSON record export, bounded generation and completion digest.
- Add all-role, collaboration, export, malicious multipart, no-key and worker-interruption verification; guard integration/fault tests against accidental existing-service execution.
- Pass 11 unit, 4 HTTP, 4 production-browser and 3 recovery/configuration scenarios; apply six migrations and execute populated PGlite upgrade/fresh-database restore.
- Fix mobile operations-table overflow and validate generated test fixtures before upload tests. Add evidence, remaining-gate report and upgrade instructions.

Native PostgreSQL/Redis CI and Docker/MinIO execution, cloud/live providers, native database plus media restore and full product acceptance remain unverified. Missing master modules still require implementation.

## 0.2.0 — 2026-09-19

- Added private S3-compatible uploads with format/probe validation, rights acknowledgment, tenant deduplication, tags/search/preview/download and archive/restore.
- Added scene visual/narration attachments and actual FFmpeg rendering with private MP4/JPEG/SRT outputs, three aspect ratios, 720/1080 options and uploaded background music.
- Added immutable render jobs, dedicated worker, progress/cancel/retry, heartbeat/reconciliation, reusable scene cache and exact-revision approval invalidation.
- Added Asset library and Video studio, mobile/light/dark styling, playback and download workflows.
- Added an additive fifth migration, local MinIO/render-worker services and optional host-development Compose mappings. Removed default Postgres/Redis host ports to avoid the user's Windows conflicts.
- Increased the frontend proxy body buffer to carry the API's 25 MiB uploads; verified an upload above 10 MiB.
- Passed 8 unit tests, 2 HTTP scenarios and 3 browser scenarios on the production web build, including actual MP4/audio and landscape/square rendering. Added QA evidence and Windows upgrade instructions.

Local verification uses PGlite, Redis, S3rver and real FFmpeg. Native Docker/MinIO, live providers, populated native upgrades and restore are still pending; full OS completion is not claimed.

## 0.1.0 — 2026-09-19

- Established the specified Next.js/NestJS/PostgreSQL/Prisma/Redis architecture and four migrations.
- Added accounts, session security, tenancy/RBAC, email tokens and team invitations.
- Added persistent Brand Brain/Creative DNA, revision checks and restore.
- Added drafts, campaigns, structural checks, human review/approval, edit invalidation, comments, versions, archive and editorial calendar planning.
- Added queued text generation, a compatible primary/fallback router, output validation, cancellation and provider usage records.
- Added strategy/script/scene UI, internal reports and explicit unavailable states for missing capabilities.
- Added responsive light/dark styling, unsaved-edit protection, setup, deployment definitions, tests and requirements mapping.
- Fixed parser output typing, same-view navigation and a screen-reader table label escaping the mobile scroll container during QA.
- Verified the browser workflows against the built production web server; included desktop/mobile test screenshots.

Real-provider validation, native CI/Docker and the remaining master-spec modules are pending. This release is not production-ready.
