# Verification report — Organic Marketing OS 0.9.2

## EDITOR-01AB publication gate — 2026-10-08 UTC

The cumulative Z+AA+AB payload is exactly 28 changed paths against public Y `62eb9393dfc68d6b15e4f1da2dbe296c772dd5ee`. Public main was checked at Y. A local fast-forward commit was prepared, but Git over HTTPS has no credential. The GitHub connector's first blob creation was rejected by automatic approval review because the conversation does not contain explicit approval for this cumulative public payload. No blob, commit, ref update or public publication succeeded. The exact new 28-file public scope needs explicit user approval; local build/browser verification and device limitations recorded above remain unchanged.

## EDITOR-01AB Reels/Shorts preset selection — 2026-10-08 UTC

The composer now selects Device safe when a user actively chooses the Reels / Shorts preset from Standard placement. A previously explicit Extra margins or Device safe choice is preserved. Users can still explicitly select Standard afterward; the captured app-overlap warning remains visible. The browser test covers these transitions, production render/download, and saved render snapshot isolation. `npm run build:web` and the isolated production `media.spec.ts` (1/1, 12 fresh migrations) pass on the final source. API, renderer, schema, dependencies and previously saved render options are unchanged. Full unit/HTTP/recovery/audits were not rerun for this UI-only change. This is local and unpublished; Z+AA+AB are pending exact public-scope approval. Wider devices, actual content, app versions and language/font readability remain open; EDITOR-01 is Partial.

## EDITOR-01AA bounded real-app UI review — 2026-10-08 IST

Six user-provided WhatsApp-transcoded Android screen recordings show the exact Z portrait fixtures in YouTube Shorts and Instagram Reels viewing UI. Standard placement **fails** in both: the long lower caption overlaps account/action text, and Instagram also shows the opening title near/under account/audio UI. Extra margins and Device safe show no overlap in the sampled playback. This is one captured phone/account/UI state (386×850 transcodes); phone model, native capture size, app versions, real footage and other devices remain unverified. Only recording SHA-256, timestamps and account-free observations are in `docs/qa/editor01aa-platform-review-evidence.json`; raw account videos are not packaged. The composer now warns when Standard 9:16 is selected and recommends Device safe for new social exports, while preserving existing saved settings. API/backend/renderer/schema/dependencies are unchanged. Web production build and isolated focused browser `media.spec.ts` passed (1 case, 12 fresh migrations, real render/download); full unit/HTTP/recovery/audits were not rerun for this UI/docs increment. AA is local and unpublished; EDITOR-01 stays Partial.

## EDITOR-01Z review pack local verification — 2026-10-08 IST

Y own CI `37811287207` succeeded at public main `62eb9393dfc68d6b15e4f1da2dbe296c772dd5ee`. Local command `TEST_DEVANAGARI_FONT_PATH=<verified local Noto font> npm run prepare:device-review` completed. Three 720×1280 H.264 exports, each 3.021029s, have SHA-256 verified against the saved manifest; nine 320px decoded frame hashes also match. Nine frames were visually reviewed on a contact sheet without apparent clipping. A high-detail synthetic pattern produced additional OCR noise and a partial short Standard read; this diagnostic is not a pass for realistic content. Physical phone playback, official app UI, real-content contrast and human readability were not executed. No application runtime, schema or dependency change; Z unpublished.

## EDITOR-01Y bounded readability QA local verification — 2026-10-08 IST

EDITOR-01X's 10-file closure is published at `e104cbea16a1e29af64f903c2511d0573397929b` (tree `c60ca91fa42b5acf29890db081f8823f5e5a8132`); its own Actions run `37772767654` passed 187 unit, 7 HTTP, 7 browser, 5 recovery, 12 migrations and both audits. EDITOR-01Y adds independent decoded-frame containment/timing checks for `device-safe-v1` beside `inset-v1`, plus a reproducible small-screen English OCR check for Standard, Extra margins and Device safe. On the clean X source, 14/14 selected unit cases pass, including 72 timed frames from 12 placement exports; 18 OCR exports yield 36/36 exact reads with a blank-frame negative control. API and web production builds pass. Four representative frames and the full 36-sample hash/readout report are in `docs/qa/editor01y-*`.

The first interrupted scratch run failed an inherited Unicode subprocess case; it was not used as pass evidence. The same case passed on clean X before Y reconstruction and the final selected suite passed 14/14. The previous scratch checkout was absent at resume; source was recovered from public X commit and manifest verified before edits. Y is local, not published. OCR covers short English text on black at rescaled widths; mixed Hindi frames passed containment and representative visual inspection, not Hindi OCR. Physical phones, official platform app overlays, real-world backgrounds/content and broader font/language readability remain open. No runtime renderer, schema, dependency or migration change.

## EDITOR-01X public publication and native CI closure — 2026-10-08 IST

EDITOR-01X's approved 22 source/config/docs/evidence files are published on public main at `8fdb7efce7f866a0fafa6a9541a07f77d0372447`, tree `1086591e54ce63acecb073165c4d0037cd9f4fec`, matching the locally verified source tree. Own Actions run `37769888218`, job `113286580705`, attempt 1 completed successfully. Its logs confirm 187/187 unit cases with zero failed/cancelled/skipped/todo, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, 12 migrations, API/web builds, populated PGlite upgrade/restore and both zero-vulnerability npm audits. No runtime/source/schema change is made by this later closure record; it remains local and is not yet published. Earlier X publication/CI-pending text below is historical.

Next: bounded physical-device/OCR readability and official platform UI acceptance for saved standard, inset and device-safe placement; separately track ASR/audio, custom effects, full Compose/MinIO, native cross-store restore, live providers and full master acceptance. EDITOR-01 remains Partial; passing CI is not physical-device acceptance.

## EDITOR-01X device-safe placement local verification — 2026-10-08 IST

EDITOR-01W is published and own native CI verified at public main `51ec6015e79d5176699490e9968e115ec2766d27`; all 262 public blobs matched the verified source and Actions run 37738372169 completed successfully. EDITOR-01X adds optional `textPlacement: "device-safe-v1"` for stricter social-review text boxes while preserving legacy Standard placement and existing `inset-v1` Extra margins. The placement is saved in immutable render options/history, shown in selected/saved composition guides and included in rendered-text scene cache identity; no schema, dependency, provider or migration change is introduced.

Focused local verification passed API TypeScript build, Next.js production build, both production and full npm audits with zero vulnerabilities, 13 selected unit cases (`tests/media.test.ts`, `tests/render-placement.test.ts`) under the strict unit reporter, and the selected production browser UI spec `tests/ui/media.spec.ts` with 12 fresh migrations and a real render/download path. Render-placement verification used the recovered Noto Devanagari test font and real FFmpeg frames. An earlier UI attempt failed only because this scratch runtime advertised optional fallback fonts that were not present; it is excluded from pass evidence, and the final rerun used an explicit verified fallback-font list. Full application/native X CI and public publication are pending exact approval; broader physical-device/OCR readability, official platform UI acceptance, ASR, custom effects and full master acceptance remain open.

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

### Sharp follow-up checks actually run

- Original Q public commit `8c3267ac77fa6833aee1e6099cb042ff44fad345`, tree `36c2de112243b98234e8845310c33cd0af200db3`, all 203 remote blob paths/modes/SHAs match the approved local source. Actions run 37488801724: production builds and 63 unit passed; high sharp advisory failed production audit. Native HTTP/browser/recovery, full audit and populated upgrade were skipped. No native full-suite success claimed.
- Maintainer advisory [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) lists `<0.35.5` affected and `0.35.5` patched, with prebuilt librsvg `2.63.2`. Advisory Database publication/review date is 2026-10-06. [Sharp v0.35.5](https://github.com/lovell/sharp/releases/tag/v0.35.5) uses [sharp-libvips v1.3.4](https://github.com/lovell/sharp-libvips/releases/tag/v1.3.4). Current Next optional range `^0.35.4` permits the patch. Exact override ensures the lock cannot retain 0.35.4.
- `npm install --package-lock-only --ignore-scripts` then `npm ci` passed. Compared every lock record with approved Q: only 27 sharp/platform/prebuilt libvips records changed; all other locked packages remain identical. `package.json` adds only the sharp override.
- Actual installed sharp `0.35.5`, bundled rsvg `2.63.2`, vips `8.18.7`. An isolated sharp smoke check created/resized PNG (32 to 16 pixels) and rasterized a controlled SVG rectangle, asserting dimensions and decoded RGBA bytes. This verifies the prebuilt package; system FFmpeg/librsvg is separate.
- `npm audit --omit=dev --json` and `npm audit --json`: both total zero vulnerabilities after the clean install. No audit gate weakening or severity exclusion.
- `npm run build` passed API TypeScript/Next.js production builds. Font-configured serialized `npm test`: 63 passed, including 36 decoded mixed LTR frames across 12 exports.
- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none node scripts/verify-local.mjs --production-web`: 7 HTTP, 7 production-browser and 5 recovery/configuration cases passed, 12 fresh migrations. Actual mixed-script export/download, early mixed-RTL rejection, saved-render review/playback/approval/mobile and natural queue-lock recovery remain covered.
- `npm run verify:upgrade`: populated PGlite upgrade and captured archive restore passed, retaining earlier user/membership/draft/queued job, credit ledger and generated-media request/provider receipt. Native PostgreSQL/private-object restore remains unverified.
- Patch source verification is local; follow-up publication and its own native CI are pending. No known unresolved local patch failures.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01Q mixed LTR overlays — 2026-10-06

EDITOR-01Q bounded mixed LTR overlays are locally verified. With the existing Devanagari opt-in and covering fonts, Latin/Greek/Cyrillic/Hindi titles and burned cues use separate complete-grapheme script/font runs. API and worker now share the mixed-script boundary, rejecting Hindi combined with Arabic/Hebrew in one overlay before queueing. Passed API/web production builds, 63 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration scenarios, with 12 fresh migrations. Focused QA passed 36 decoded timed frames from 12 exports across six output geometries and standard/inset placement; portrait/landscape frames were visually reviewed. Q publication and own native CI are pending.

The isolated verifier uses serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers. Dependencies, schema/migrations, tenant/role/revision gates and ordinary non-Devanagari cache identity are unchanged. Devanagari outline runtime keys are bumped to v3. Audits and populated upgrade/archive restore were not rerun; dated P recovery Actions run 37484095477 at 981dd237c4a4d30bc7ed6b6a897c6617c09255f7 remains preceding native/full-audit evidence for P only. Bengali/other Indic/CJK, general bidirectional mixing, language semantics, physical-device legibility, ASR, broader audio/custom effects/platform acceptance, full Compose/native cross-store restore and master acceptance remain open.

### Q checks actually run

- `npm run build`: Prisma generation, API TypeScript and Next.js production build passed.
- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none npm test`: 63 passed.
- Focused `node --import tsx --test tests/render-ltr-mixed.test.ts` with the same font/environment and `MOS_LTR_QA_DIR=.local/editor01q-frames`: four passed, including 36 decoded frames across 12 real exports. Representative portrait/landscape frames visually inspected; Greek/Cyrillic diacritics, Hindi matras/conjuncts, intact baselines and bounded timed cues were checked as a smoke test, not a language-quality certification.
- Same font/environment with `node scripts/verify-local.mjs --production-web`: 7 HTTP, 7 browser, 5 recovery/configuration scenarios passed. HTTP creates and downloads a mixed Greek/Cyrillic/Hindi export and verifies source Unicode SRT; a Hindi/Hebrew mixed overlay returns 400 with unchanged render-job count. Existing tenant/role/approval/cache/playback/download checks pass. The P hardened natural Redis lock-expiry recovery regression also passed on Q code.
- 12 fresh migrations applied to disposable serialized PGlite. Real Redis, S3Proxy, FFmpeg and fixture providers used. No dependencies/migrations changed, live/paid provider, user business data or user runtime services used.
- No known unresolved Q failures. Q native CI, audits and upgrade/archive restore were not run; last dated P CI is retained separately.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01P recovery-follow-up publication closure — 2026-10-06

EDITOR-01P recovery-test hardening and its approved 16-file recovery-fix/evidence payload are published and CI-verified. Public main 981dd237c4a4d30bc7ed6b6a897c6617c09255f7, tree 312e5ce9efa1f78fef47a4a06d1037beb6eebbbb; Actions run 37484095477 attempt 1 completed successfully at 2026-10-06T15:10:34Z. Logs confirm 59 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated PGlite upgrade/archive restore and zero-vulnerability production/full npm audits. The deterministic interrupted poll left an active Redis queue job with 119834ms lock remaining; natural expiry/recovery completed the case in 158.4s with the same provider receipt, private output, completed queue job and exactly one video submission. All 200 remote blob paths/modes/SHAs match the approved local source.

Changes are confined to isolated tests/fixtures and evidence. Production API/UI/workers, dependencies and migrations are unchanged. Native CI uses PostgreSQL/Redis, S3Proxy, real FFmpeg and synthetic providers. This test budget does not establish a production recovery SLA. Wider-script/readability and device QA, ASR, broader audio/custom effects/platform acceptance, full Compose/MinIO, native cross-store restore and master acceptance remain open.

This publication closure is retained locally in the portable handoff. The exact approved public payload is the tree above; historical pending sections below describe earlier checkpoints. Next: bounded editor wider-script/readability QA.

## EDITOR-01P recovery-test hardening — 2026-10-06

EDITOR-01P recovery-test hardening is locally verified. A test-only first-poll barrier deterministically kills the real media worker with an accepted provider receipt and active BullMQ job. After confirmed process exit, the Redis lock/active state remains untouched and expires naturally. The scenario observes 119907ms lock remaining, completes in 128.2s, and verifies the same provider ID/private asset, completed queue job and exactly one video submission. The recovery completion wait is bounded at 210s and the whole case at 300s. Passed 7 HTTP and 5 recovery/configuration cases with 12 fresh migrations. Follow-up publication and its native CI are pending.

Changes are isolated test/fixture code and evidence. Application/API/UI/worker behavior, dependencies and migrations are unchanged. Builds, unit/browser, audit and populated-upgrade suites were not rerun for this follow-up. Dated P CI run 37479269861 attempt 2 at c2936113616522db099771684226276e91976957 remains prior full-suite evidence. Current local checks use serialized PGlite, real Redis/S3Proxy/FFmpeg and synthetic providers, not native PostgreSQL or paid services. This closes the reproduced test-deadline mismatch locally; it does not establish a production recovery SLA, physical-device/live-provider or full master acceptance.

### Recovery-hardening checks

- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none node scripts/verify-local.mjs --production-web --skip-ui`: 7 HTTP and 5 recovery/configuration cases passed; 12 migrations. The current production app/dist artifacts are the unchanged P application build; no new build is claimed.
- `/poll-stats` and `HOLD_POLL_ONCE:` exist only in the isolated provider fixture. First poll stays open until the worker is killed; polling the saved receipt after restart completes. Original submit counters remain distinct, and tests assert exactly one submission.
- Recovery test asserts active Redis state before/after SIGKILL, surviving lock TTL above the old 25s deadline, then native lock expiry/stalled handling without Redis lock/list changes. Only the DB heartbeat is backdated after awaited child exit. It checks SUCCEEDED, same provider ID, private asset ID, queue completion and no new paid-boundary submission. Existing ambiguous-image UNKNOWN/REVIEW and saved-private-output/no-submit assertions still pass.
- Observed TTL 119907ms; whole media-restart case 128237.518ms. A deterministic real-worker regression reproduces the earlier mechanism; the exact timing of the original CI failure remains historical evidence. No unresolved local failure. Native PostgreSQL verification of the follow-up remains pending its own CI.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01P publication closure — 2026-10-06

EDITOR-01P saved-render scene/caption review navigation and the approved 19-file source/docs/evidence payload are published and CI-verified. Public main c2936113616522db099771684226276e91976957, matching verified local source tree 1dc3dd5c2078ea93f9f7d863f48ed9791db0e6fa; Actions run 37479269861 completed successfully on 2026-10-06T14:41:45Z. Logs confirm 59 unit, 7 HTTP, 7 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 200 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Physical devices, ASR, wider-script/readability, full Compose/native cross-store restore and master acceptance remain open. Initial CI attempt failed the media-worker restart recovery wait after 25s; all 7 browser cases passed. The same approved source passed the later CI attempt. An isolated Redis/BullMQ reproduction left a killed worker job active with 119993ms lock remaining, beyond the 25s assertion. This queue mechanism supports a timing-race explanation; original application failure causality remains an inference, and recovery-test hardening is prioritized. No code fix is claimed.

This closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

## EDITOR-01P saved-render review navigation — 2026-10-06

EDITOR-01P saved-render scene/caption review navigation is locally verified. Scene starts and caption offsets come only from the immutable render snapshot, including stale renders. Native player seeks preserve play/pause, keyboard activation works, and half-open scene/cue highlights track playback. Buttons wait for metadata and disable on load failure; switching render IDs resets player state. Captions-off exports label SRT-only cues. API/web production builds passed; all 7 browser scenarios passed across the initial 6-case pass and corrected focused review-test rerun. Public P publication and native CI are pending.

This is a UI-only increment with no backend, schema, dependency, renderer/cache or API-contract changes. Unit, HTTP, recovery, audits and populated-upgrade suites were not rerun for P. Dated O Actions run 37473495143 at eb9c02338bc62ab38aadafd713586f4b80f35a79 remains the preceding full-suite evidence, not P verification. No live/paid provider or user runtime data was used. Physical-device playback, wider Indic/CJK/font/readability, ASR, broader audio/custom effects/platform acceptance and full master acceptance remain open.

### P checks and evidence

- `npm run build`: API TypeScript and Next.js production build passed.
- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf node scripts/verify-local.mjs --production-web --ui-only`: all six existing browser scenarios passed; new review scenario initially failed because a Playwright evaluation referenced a Node-side variable without passing it as an argument. Fixed only the test helper.
- Same isolated command with `--ui-spec=render-review.spec.ts`: the corrected review case passed. Three-scene, six-second real FFmpeg exports cover scene-wide fallback, timed cue absolute offset 2.5s, empty captions, exact half-open cue end at 3.5s, final-video end, keyboard, seek while playing/paused, changed draft order/durations, burned/SRT-only render switching, delayed metadata, failed load and 390px mobile overflow.
- Desktop/mobile review screenshots visually inspected: `docs/qa/render-review-desktop.png` and `docs/qa/render-review-mobile.png`. Existing export playback/approval/download and composition-guide browser checks passed on the same production build.
- Harness used disposable PGlite, Redis, S3Proxy, SMTP/provider fixtures and real FFmpeg, applying 12 fresh migrations. HTTP/recovery suites were explicitly skipped. Physical devices and live services were not exercised. No known unresolved P failures.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

## EDITOR-01O publication closure — 2026-10-06

EDITOR-01O responsive selected/saved composition guides and the approved 17-file source/docs payload are published and CI-verified. Public main eb9c02338bc62ab38aadafd713586f4b80f35a79, matching verified local source tree a90d05e29183ddeaa6b5be908b2d9656ae5abee8; Actions run 37473495143 completed successfully on 2026-10-06T13:51:31Z. Logs confirm 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 196 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Guides are review diagrams; complete Compose/MinIO, native cross-store restore, device/font/ASR and full master acceptance remain open.

This closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

The complete native job passed builds, 59 unit cases, both zero-advisory audits, populated PGlite upgrade/archive restore, configured PostgreSQL/Redis application flows (7 HTTP, 6 browser, 5 recovery), browser-evidence upload and cleanup. O browser controls and immutable saved guides passed in this native CI. Populated upgrade covers test records and a captured PGlite archive; native PostgreSQL/private-media cross-store restore remains unverified. Earlier O local evidence remains explicitly UI-only; this new dated CI evidence covers O source itself.

## EDITOR-01O composition guides — 2026-10-06

EDITOR-01O composition guides are locally verified. The selected-export diagram follows aspect, resolution, text placement, background and burned-caption controls; saved-render guides read immutable job options independently. Extra-margin boxes reuse the renderer geometry; standard positions are explicitly approximate. API/web builds and all 6 production-browser scenarios passed on final code, including real export playback/approval/download, guide controls, saved settings after navigation and mobile overflow. Public O publication and native CI are pending.

This is a UI-only increment. Unit, HTTP, recovery, audits and populated-upgrade checks were not rerun; dated EDITOR-01N CI run 37450673612 remains the last full-suite evidence for N. Backend rendering/options/cache behavior and dependencies/migrations are unchanged. Guides are review diagrams, not actual text/frame or font-overflow preflight, and are not added to exports. No paid/live provider or user runtime data was used. Full platform/device/ASR and master acceptance remain open.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

### O checks actually run

- `npm run build`: Prisma generation, API TypeScript and Next.js production build passed. Final `npm run build:web` passed after improving label contrast and caption accessibility text.
- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none node scripts/verify-local.mjs --production-web --ui-only`: 6 production-browser scenarios passed on final code; all 12 fresh migrations applied to the isolated PGlite harness. HTTP and recovery suites were explicitly skipped. No user runtime service or paid provider was used.
- Browser assertions cover portrait/landscape/square viewBox geometry, standard/inset selection, actual portrait inset box coordinates, burned-caption visibility, background reflection, immutable saved geometry/placement/background/captions, return-to-studio persistence, playable real MP4 approval/download and 390-pixel mobile overflow.
- Desktop/mobile/light/dark browser screenshots were visually reviewed. Guides remain diagrams, not scene text or official platform interface validation.
- An elevated-execution request was rejected by the environment's permission policy before execution. The ordinary unprivileged isolated harness succeeded. After final contrast/accessibility and independence assertions, it was rerun and all 6 browser cases passed.
- Unit/HTTP/recovery/upgrade/audit suites were not rerun for the UI-only change. The preceding N native CI at public commit c33dc6fd43ffed8e8ed85d78c5fa9b77972bca38 passed 59/7/6/5 and zero dependency audits; it does not automatically certify modified O source.

## EDITOR-01N publication closure — 2026-10-06

EDITOR-01N optional aspect-aware Extra margins and the approved 23-file source/docs payload are published and CI-verified. Public main c33dc6fd43ffed8e8ed85d78c5fa9b77972bca38, matching verified local source tree 1e404024f8f8c86d0b3a344c569552bf6711979d; Actions run 37450673612 completed successfully on 2026-10-06T10:38:56Z. Logs confirm 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. All 195 remote blob paths/modes/SHAs matched the approved local source. No live/paid provider or user runtime data was used. Product composition margins do not guarantee official platform UI exclusion; complete Compose/MinIO, native cross-store restore, wider scripts/device/ASR and full master acceptance remain open.

This publication closure is retained in the portable handoff; the exact approved public payload is the tree recorded above. Historical pending sections below describe earlier checkpoints.

The complete native job passed dependency installation, media setup, API/web build, 59 unit cases, both zero-advisory npm audits, populated PGlite upgrade/archive restore, the configured PostgreSQL/Redis application harness (7 HTTP, 6 browser, 5 recovery), browser-evidence upload and cleanup. Populated upgrade evidence covers test records and the captured PGlite data-directory archive; it does not certify native cross-store/PostgreSQL/private-media restore.

## EDITOR-01N optional extra text margins — 2026-10-06

EDITOR-01N optional Extra margins text placement is locally verified. The versioned inset-v1 option uses aspect-aware title/caption boxes; portrait leaves more room on the right and bottom. Omitted placement preserves legacy options, positions and cache keys. Immutable render options and preview/history retain the selection. Changing placement rebuilds text scenes while empty scenes reuse cache. Passed 59 unit, 7 HTTP, 6 production-browser and 5 recovery/configuration cases, API/web builds and all 12 fresh migrations. The new frame matrix covers 36 decoded Latin/mixed-Hindi frames across six output geometries. N public publication and native CI are pending.

These are controlled product composition margins, not official platform UI guarantees. Font/grapheme bounds, minimum size, caption timing and SRT content remain enforced. No dependency/schema/migration change, live/paid provider or user runtime-data change. Complete Compose/MinIO, native cross-store restore, wider scripts/device QA, ASR and full master acceptance remain open. Latest M native CI is historical evidence for M only.

Historical sections below describe earlier checkpoints; this section and PROJECT_CHECKPOINT.json define the current state.

### N verification commands and limits

- `npm run build`: API and Next.js production build passed.
- `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none npm test`: 59 passed.
- Isolated `npm run verify` with the same font/environment: 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios passed; 12 fresh migrations applied. Final verifier used elevated local-service permissions after two default attempts failed at S3Proxy startup before application checks.
- `tests/render-placement.test.ts`: three focused cases passed, including 36 decoded frames (Latin and mixed Latin/Devanagari, three aspects, 720/1080) with independent expected boxes, visible title/caption pixels and hidden captions outside cues. Scene-offset SRT, legacy serialization, strict placement values, minimum-size overflow on a worker-valid 300-character caption and actual cache reuse/rebuild were checked. The overflow assertion also confirms zero storage/cache/progress calls. An intermediate strengthened fixture used a title longer than the worker limit and failed before the intended layout assertion. Replaced it with a worker-valid 300-character caption; the focused assertion passed and the final 59-case unit suite was rerun. Application source was unchanged.
- Representative mixed-script 1080×1920 and 1280×720 exported frames were visually reviewed. Browser export remains playable/approvable and persisted placement is visible after navigation; API presets retain placement in immutable options.
- Dependencies and migrations are unchanged. Audit and populated-upgrade checks were not repeated; dated M Actions run 37444585056 covers the preceding source, not N. Physical-device/official platform interface guarantees are not verified.

## EDITOR-01M publication closure — 2026-10-06

EDITOR-01M mixed Latin/Devanagari font runs and the approved 18-file payload are published and CI-verified. Public main eb8196e594889984651e9b93eb3ffe1bd2e195c2, matching local source tree 2504d062d94c7691d05365353d2746659c1b9f14; Actions run 37444585056 completed successfully on 2026-10-06T09:45:36Z. Logs confirm 56 unit, 7 HTTP, 6 production-browser, 5 recovery/configuration scenarios, API/web build, 12 migrations, populated upgrade and zero-vulnerability production/full npm audits. No live/paid provider or user runtime data was used. Complete Compose/MinIO, native cross-store restore, broader language/device/ASR and master acceptance remain open.

This publication closure is retained in the portable handoff. Historical pending sections below describe earlier checkpoints.


Final commands: `npm run build`; `TEST_DEVANAGARI_FONT_PATH=.local/test-fonts/NotoSansDevanagari-Regular.ttf NODE_OPTIONS=--test-isolation=none npm test`; isolated `npm run verify` with the same font/environment. An initial verifier was intentionally stopped after adding explicit space-glyph coverage; API was rebuilt and full verification restarted on final code. No incomplete run is counted as a pass. Dependencies/migrations unchanged; latest dated native upgrade/audit evidence remains L CI run 37440418977.


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


## EDITOR-01K audio output QA - 2026-10-05 (IST)

- `node --import tsx --test tests/render-audio.test.ts`: initial two focused cases passed after correcting test asset IDs to valid UUIDs. The final embedded-video-sound fixture also passed in `npm test`.
- `npm test`: 49 cases passed (two new audio tests).
- `npm run build:api` and `npm run build:web`: production builds passed.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration cases passed; all 12 fresh migrations applied and final success was printed.
- `python3 scripts/package_handoff.py --check`: 189 included source/context/evidence files matched the refreshed manifest; `git diff --check` clean.
- The first redirected verifier stayed at the first migration and was stopped. It is not a pass; the foreground rerun completed. Local environment uses disposable PGlite, native Redis 7.2.11, S3Proxy and real FFmpeg.

Output validation now rejects nonfinite/missing/short stream durations, mono or
non-48-kHz AAC and displaced/nonfinite audio start times. These checks apply to
segments, cache reads and final MP4. A bad cached segment is rebuilt. No encoding
or cache-key change was required.

Real AAC output is decoded to PCM. 440/880 Hz tones separate short/long narration
and prove padding/trimming across three one-second scenes. A visual clip's 660 Hz
sound stays muted in the silent scene. A 0.2-second 220 Hz music fixture loops
across the timeline; zero music gain stays silent and selected gain stays bounded.
Inputs exercise mono/stereo and 32/44.1/48 kHz. A deliberately mono/44.1-kHz cache
entry is rebuilt while other scenes are reused; music-only edits reuse valid
segments. The authenticated HTTP export also passes the strict probe validation.

Subjective speech intelligibility, loudness/true-peak clipping, every input format,
ASR and physical-device playback are not certified. Indic/CJK/device/font QA stays
open. Schema, dependencies and architecture are unchanged; no paid/live provider
used. Populated restore and dependency audits were not rerun for this unchanged
schema/dependency set. Latest public CI is EDITOR-01J run `37353516609`; it does
not verify local EDITOR-01K. New source/docs publication needs current-payload
approval, followed by its own CI.

## EDITOR-01J font-aware bounded text layout - 2026-10-05 (IST)

- `node --import tsx --test --test-isolation=none tests/render-layout.test.ts`: 3 focused cases passed.
- `node --import tsx --test --test-isolation=none tests/*.test.ts`: 47 cases passed; the CI entrypoint `npm test` also passed 47 cases.
- Clean `npm run build`: Prisma client, API TypeScript and Next.js 16.3.8 production build passed.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration cases passed, with 12 migrations and explicit final success.
- `git diff --check`: clean. Dependencies, master specification and migration files unchanged.

The old 720px title layout allowed 25 letters at 40px using a 600px estimate;
DejaVu Serif's actual advance for 25 W glyphs is about 1028px. Selected-font
metrics now bound shaped/unpositioned widths, overhangs and rounding; wrapping
uses word and grapheme boundaries. Overfull titles/cues fail at the 16px minimum
before storage/cache/media work. Cache version 6 separates earlier layouts.

The matrix renders wide Latin, composed/decomposed accents, Greek/Cyrillic and
Arabic/Hebrew fallback text at 720/1080 in portrait, landscape and square output.
Eighteen real decoded frames verify title and caption presence independently,
horizontal margins and separate vertical bands. Representative portrait mixed,
landscape RTL and square wide-glyph frames were visually inspected. HTTP coverage
confirms safe overflow errors in FAILED history, null output and no new segment;
unit rendering preserves unburned SRT and explicit-cue overrides. Existing timing,
audio, cache, tenant, role, revision, browser and worker recovery checks pass.

Resolved attempts: the initial overflow fixture exceeded the existing 300-character
render limit; corrected it to a valid 300-W caption. After a session interruption,
Turbopack's generated cache was truncated; preserved it outside the source and
rebuilt cleanly. The Redis release installer returned 403, so disposable Redis
7.2.11 was built from its official GitHub tag d4c381df7a729c06a5207c4f18d804febe956dc4;
downloaded archive SHA-256: 95f9d5c0d44e1f21599a300f6a950fc9d128dfb12066e92886da9cd67c299d7b.
The cached S3Proxy file failed its pinned checksum and was replaced using the
unchanged official installer; the pinned checksum then passed. An escalation
request was rejected by the current execution policy, but the installer succeeded
under normal permissions. One verifier stalled at migrations and was stopped;
the final foreground run passed completely. Failed/incomplete runs are not passes.

No new dependencies, migrations, paid/live calls or user data changes. Populated
upgrade and npm audit were not rerun for unchanged schema/dependencies; dated
EDITOR-01I CI evidence remains separate. Physical-device testing, OCR-level
readability, every custom font and Indic/CJK support remain open. EDITOR-01J was subsequently published after exact 18-file approval as
`ffb398d34279898074765141048cb6955e198c53`; tree
`97fe4253f2e63dabd545a95481768210ea1009a2` matched the local verified tree.
Actions run `37353516609` completed success for build, unit tests, audits,
populated upgrade and native application flows.

## EDITOR-01I CI portability follow-up - 2026-10-05 (IST)

- `node --import tsx --test --test-isolation=none tests/render-font.test.ts`: 7 focused font/readability cases passed.
- `npm test`: passed the CI unit-test entrypoint.

EDITOR-01I was published to public `main` as split commits ending at
`27aaf5cd752ad3fb83c5127523eff01416ace53a`; the resulting tree matched the
verified local tree `59cc372fec1f759f2955985b0e84dfdb608b591b`. GitHub Actions
run `37315707338` then failed only at unit tests because three new fallback-font
tests used `/usr/share/fonts/opentype/urw-base35/NimbusRoman-Regular.otf`, which
exists in the local workspace but is not installed by the CI workflow. The build
step had passed before the unit failure.

The follow-up test fixture now uses CI-installed DejaVu fonts only:
`DejaVuSerif.ttf` as the intentionally limited primary font and `DejaVuSans.ttf`
as the fallback. This preserves the same primary-miss/fallback-hit Arabic/Hebrew
coverage without adding packages or weakening the renderer behavior. No runtime
code, schema, dependency or product behavior changed in this follow-up.

After exact approval, the follow-up was published as
`56702de088f2e8d2198e3ea858dd96efe6b9d200`, with tree
`d4e6cf0c0d93defb64e391a0a1496dae5d5f1534` matching the verified local tree.
GitHub Actions run `37317283904` completed successfully: build, unit tests,
production/development audits, populated upgrade, native application flows and
artifact cleanup passed.

## EDITOR-01I fallback font/readability QA - 2026-10-05 (IST)

- `node --import tsx --test --test-isolation=none tests/render-font.test.ts`: 7 focused font/readability cases passed.
- `node --import tsx --test --test-isolation=none tests/*.test.ts`: 44 cases passed.
- `npm run build:api`: API TypeScript build passed.
- `npm run build:web`: Next.js 16.3.8 production build passed.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios passed, with all 12 migrations and explicit final success.

The new coverage adds trusted worker-side fallback font configuration through
`RENDER_FONT_FALLBACK_PATHS`. Each title or burned caption cue must be fully
covered by one configured single-face TTF/OTF. The renderer copies the selected
controlled font file into the FFmpeg workspace, preserves explicit
`text_shaping=1`, and includes the full configured font-set hashes in the scene
cache key. Tests verify an Arabic/Hebrew render where the primary font lacks
those glyphs and the fallback supplies them, then decode a real frame and assert
visible overlay pixels.

Initial focused readability coverage used `execFileSync` for FFmpeg frame decode
and hit sandbox `EPERM` despite output; the test was switched to the project
`runProcess` helper and rerun successfully. Fresh dependency install required
network escalation. The Redis installer download later returned HTTP 403 even
after escalation, so the verifier used an existing checksum-pinned Redis 7.2.11
build from a prior scratch workspace. The S3Proxy artifact was copied from prior
scratch and verified by `scripts/install_test_storage.py`. A sandboxed full
verifier attempt reached S3Proxy startup but exited before readiness; the
elevated rerun passed. No live/paid provider, schema/migration or user runtime
data changed.

This is fallback/readability smoke coverage for already-allowed scripts, not
browser font uploads, per-glyph mixed-font fallback, OCR-level readability,
font licensing review, Indic/CJK support or universal complex shaping.

## EDITOR-01H RTL text shaping - 2026-10-05 (IST)

- `node --import tsx --test --test-isolation=none tests/*.test.ts`: 42 cases passed.
- `npm run build`: Prisma client, API TypeScript and Next.js production build passed.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios passed, with all 12 migrations and explicit final success.

The new coverage accepts Arabic titles and Hebrew burned captions through the API,
worker and real FFmpeg renderer, with `text_shaping=1` pinned in the drawtext
filter. It preserves the Devanagari burn-in rejection path and captions-off Unicode
SRT behavior. Direct integration invocation was intentionally blocked by the test
harness; the full verifier is the valid integration path. A first verifier attempt
hit S3Proxy readiness under sandbox and the first elevated rerun exposed stale
`dist`; rebuilding before the final elevated verifier resolved both. No live/paid
provider, dependency, migration or user runtime data changed.

This is bounded Arabic/Hebrew RTL support, not universal multilingual rendering.
Broader fallback-font, Indic/CJK shaping and decoded readability remain open.

## EDITOR-01G configured-font glyph coverage - 2026-10-05 (IST)

- `node --import tsx --test --test-isolation=none tests/*.test.ts`: 41 cases passed.
- `npm run build:api` and `npm run build:web`: passed.
- `npm audit --json`: zero advisories across all npm dependencies after adding pinned Fontkit 2.0.4 and types 2.0.9.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios passed, with all 12 migrations and explicit final success. No escalation needed in this completed run.

Unit checks use actual installed DejaVu Sans to cover Latin/Greek/Cyrillic,
composed/decomposed accents, whitespace and a script-policy-accepted character
(U+1DF00) missing from that font. They reject missing burned glyphs while allowing
captions-off SRT and unused fallback text; malformed/unsupported/oversized/missing
font files fail with controlled messages. A renderer test proves rejection occurs
before storage, cache or media work.

The HTTP/worker test queues a missing-glyph render and verifies FAILED history
with a useful U+1DF00 message, no server font paths, no output and no new cached
segment. The real successful media flow includes accented Latin, Greek and
Cyrillic titles. Existing frame/audio/cache, tenant/role/revision, browser and
recovery scenarios all pass. No new browser UI was introduced.

No schema/migration change; populated upgrade/fresh restore was not rerun and its
prior EDITOR-01F evidence remains below. Font mapping coverage does not prove
correct complex shaping or decoded multilingual readability. Full Compose/MinIO,
native/cross-store restore, live providers and master acceptance remain open.
Published EDITOR-01G to public `main` as `d9a205799e69725bd4642014f8aaeeea710e1b3f`;
tree `79c3d129f6c824e12163ef66b22c705d1ecfc0c3` matched all 187 local blob paths,
modes and SHAs. Actions run `37277131959` completed successfully with configured
native PostgreSQL/Redis application verification. No paid provider or user runtime
data was used.

## EDITOR-01F rendered-text preflight - 2026-10-05 (IST)

Local verification passed on the final application source:

- `node --import tsx --test --test-isolation=none tests/*.test.ts`: 37 cases.
- `npm run build:api` and `npm run build:web`: passed.
- `NODE_OPTIONS=--test-isolation=none npm run verify`: 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios; 12 migrations; explicit final success. The local-service permission escalation was approved.
- `npm run verify:upgrade`: populated PGlite upgrade/fresh restore passed; archive 4865777 bytes, SHA-256 `2ac1129f79474a4d98d13e4ae2554d9a9cfc39282ec2decd017e6f641f0d9b4d`.

New unit cases exercise named unsupported scripts, unknown scripts, emoji, controls,
common punctuation, composed/decomposed accents, explicit cue overrides and
captions-off behavior. HTTP coverage rejects unsupported titles before job creation,
rejects Hindi burned captions, then successfully renders the same caption as
SRT-only text and downloads the intact Unicode SRT. Existing real FFmpeg frame,
audio, caching, tenant/role/revision and browser/recovery checks pass.

The first default runner invocation reported test files rather than cases; only
explicit case-level reruns support the 37 count. Initial S3Proxy startup was
blocked by local-service permission. The first authorized full run found a
middle-dot punctuation regression; the policy/test were corrected and the full
run repeated successfully. No known failing check remains for this increment.

No live/paid provider or native PostgreSQL restore was exercised. This is a
conservative script/character policy, not actual font glyph coverage, multilingual
shaping or decoded multilingual readability certification. Published EDITOR-01F to public `main` as `72b796d6d93ae5f5da475e3c33d021858131df1e`;
tree `97e227fa6352de563f6e3d018704960f8e34264d` matched all 185 local blob paths,
modes and SHAs. Actions run `37228966502` completed successfully.
Decoded CI job logs independently confirm 37 unit, 7 HTTP, 6 browser and 5 recovery
cases and native PostgreSQL/Redis verification. All build/audit/upgrade/artifact
steps passed. These post-publication records are local evidence.

## EDITOR-01E named export presets — 2026-10-04 (IST)

EDITOR-01E adds named Reels / Shorts (1080×1920), Landscape video (1920×1080) and Square feed (1080×1080) export presets plus Custom. Preset-only requests normalize into immutable job options; conflicting dimensions are rejected. Source drafts/approval stay unchanged; history shows saved settings and identical geometry reuses scene caches.

Passed 36 unit tests, 7 HTTP, 6 production-browser and 5 recovery/configuration scenarios, API/web production builds, all 12 migrations and populated PGlite upgrade/fresh restore. Real FFmpeg outputs passed dimension probes for every preset, and equivalent Custom jobs reused the cached scene. HTTP coverage verifies normalized replay, rejected mismatches/unknown IDs, tenant/role/revision denial and unchanged source approval. Browser coverage selects every preset, checks Custom reset, renders 1080×1080, and preserves saved history labels after changing the composer.

Published to public main as application commit `06e5da96ec4e811b0a95510247db25c3d54ac669`; tree `092b502cca399cfe732d9743202f310b0c80d994` matched 185/185 local blobs. Actions run `37207895511` completed successfully. No live/paid provider was used. Presets cover geometry only; automatic platform text/composition changes, policy/safe-area validation and publishing remain open.

Initial new HTTP assertion read the content wrapper incorrectly; fixed to use `body.item`. The new browser test also needed an accessible-role locator for nested select options. The completed full rerun passed. Upgrade archive SHA-256: `88d02061556908c3ac7f7c4d26ac69102c91418c2c6a112e2d08ebdb0bc7ccde` (4865653 bytes); this is isolated PGlite restore evidence, not a user backup.

## EDITOR-01D bounded image motion — 2026-10-04 (IST)

`npm test`: 35 passed. API and Next.js production builds passed. The full isolated verifier passed 7 HTTP, 6 browser and 5 recovery/configuration scenarios with all 12 migrations. `node scripts/verify-upgrade.mjs` passed populated upgrade/fresh restore.

Real FFmpeg decoded frames show centered image enlargement from 1× to at most 1.08×, stationary static output and expected Fit border movement. Motion-only edits reuse video and no-asset scenes. Browser editing saves/reopens/reorders the preset and renders it alongside timed captions. Generated attachment preserves the preset; extreme aspect inputs remain bounded. No live provider was used. Published to public main as application commit `9334411055f63f33333044b2b4ce079420fa2596`; tree `8be7bfe6976d21a7db3411627548ebd8af7bd8c4` matched 184/184 local blobs. Actions run `37191164246` completed successfully.

Verified locally on 2026-10-04 (Asia/Kolkata). The generated-media implementation advances the
supplied V3 specification; it does not complete or certify the entire product.

| Check                           | Completed result                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                      | 36 passed across 6 test files                                                                                                    |
| HTTP integration                | 7 broad scenarios passed                                                                                                         |
| Production-browser tests        | 6 scenarios passed                                                                                                               |
| Recovery/configuration          | 5 scenarios passed                                                                                                               |
| Prisma/API/Next.js              | Client generation and both production builds passed                                                                              |
| Fresh migrations                | All 12 applied through Prisma deploy in the isolated harness                                                                     |
| Populated upgrade/fresh restore | PGlite passed; old draft/user/membership/queued AI record, immutable credit ledger and saved media request/provider ID preserved |
| Npm audit                       | 2026-10-04 CI: production/full moderate-severity gates passed; exact zero counts last recorded 2026-09-29                                   |

The full local verifier reached its explicit final success message. A later
selected browser rerun checks the final media layout/capture adjustments; its
output explicitly says that HTTP/recovery suites were skipped. It is not counted
as an additional full-suite pass.

## EDITOR-01C visual fit/fill — 2026-10-04 (IST)

`visualFit` accepts only `contain` (default) or `cover` in the existing scene JSON.
The editor exposes Fit/Fill for attached visuals and explains that its source
preview is unchanged. Center cropping precedes scaling to avoid huge intermediate
frames for extreme aspect ratios. The cache records the effective mode only for
attached visuals; the mode survives applying a scene rewrite.

`npm test` passed all six unit files; an explicit `node --import tsx --test
--test-isolation=none tests/*.test.ts` run reported all 34 cases passing.
API and Next.js 16.3.8 production builds passed. Final full `npm run verify`
passed 7 HTTP, 6 browser and 5 recovery/configuration scenarios with 12 migrations.
Decoded RGB samples distinguish preserved red/blue edges and black borders in
Fit from centered green crops in Fill, for wide still/video and tall still
fixtures. Valid 8192×2 and 2×8192 images also render successfully in Fill.
Mode-only edits reuse exactly the other scene. Browser coverage changes framing,
reorders, saves/reopens and renders the selected mode; existing mobile overflow,
caption, approval, cross-tenant and recovery checks pass.

The first sandboxed harness could not bind S3Proxy (`Operation not permitted`).
The authorized isolated rerun passed. A code review then identified potentially
unbounded pre-crop scaling; the guard and extreme-aspect fixtures were added and
the full verifier passed again on that final source. `npm run verify:upgrade`
also passed populated PGlite upgrade/fresh restore. No dependency, migration,
paid provider, user database or originals changed. Published as application commit `177936421b896737ed6ea424f7520c32651ee596` and tree
`aa368ff82aaca7d29fef10da26dcc4c12ccee51b`; Actions run `37189446835` passed every workflow step. Custom focal points, camera motion and full language/asset QA remain open.

## EDITOR-01B manual timed captions — 2026-10-03

Bounded scene-relative cues now replace the fallback caption, including blank
gaps, and use half-open intervals. Legacy missing/empty cues retain the old
full-scene caption. The scene JSON change needs no migration. SRT uses cumulative
scene offsets regardless of whether burn-in is enabled; the cache uses effective
cue timing/text only when captions are burned in.

`npm test` passed 33 tests; API and Next.js 16.3.8 production builds passed.
Full `npm run verify` passed 7 HTTP, 6 browser and 5 recovery/configuration
scenarios with all 12 migrations. Tests reject invalid/out-of-bounds/overlapping
cues, preserve a second scene's cues during generated-media attachment, reopen
saved/reordered captions and exercise mobile validation without horizontal
overflow. Real decoded frame bands at 0.25, 0.75, 1.0 and 1.5 seconds verify a
0.5–1.0 cue appears only inside its interval; burn-off frames stay blank.
Changing only cue timing invalidates that scene while reusing the other scene.
`npm run verify:upgrade` passed the populated PGlite upgrade/fresh restore.

Earlier attempts exposed an outdated fixture expectation for normalized
`captionCues: []` and an exact-label selector that could not find a prefilled
textarea. The fixture now explicitly verifies preservation of nonempty cues;
the browser assertion uses the textbox role and accessible name. The complete
rerun passed; no failed attempt is counted as a pass. No live/paid provider was
used. Application commit `4611fb0170d4851be6bc6d805009c42a0ba5dd63` and tree
`54e29ec0a2d0fa15921be62ccd0282de9e135c07` match all 184 local blob paths/modes/SHAs.
Actions run `37143980421` passed every step, including PostgreSQL 17/Redis 7
application flows and browser-evidence upload. A targeted browser screenshot
rerun also passed and its desktop/mobile caption captures were inspected;
it does not replace the earlier full run. Automatic transcription, word
highlighting, full language/font QA and production acceptance remain open.

## EDITOR-01A scene timeline editing — 2026-10-03

The storyboard now exposes cumulative start/end timing and accessible controls to
move a scene earlier or later, duplicate it with a fresh stable ID, or remove it.
Scene content and uploaded/generated asset references move together. The same
deterministic timeline function drives SRT scene boundaries, preventing UI/order
calculations from changing the render contract.

`npm test` passed 31 unit tests, including fractional cumulative timing. API and
Next.js 16.3.8 production builds passed. Full `npm run verify` applied all 12
migrations and passed 7 HTTP, 6 production-browser and 5 recovery/configuration
scenarios. The browser flow reordered two scenes, duplicated and removed a copy,
saved the resulting order, then produced and approved a real FFmpeg MP4. This is
local and public-CI evidence. Application commit
`97381d1f620eb5f30ec095522c7057c99ac8c1c6` points to the exact verified tree
`dbf2bf8dca90b3b6612a72960d37b5d5b010702f`; Actions run `37126029720` passed
every workflow step, including native application flows and browser evidence.

## MEDIA-01D ordered multi-image editing — 2026-10-03

The separately quoted image-edit path now accepts one to four ordered, unique
tenant-owned image assets. Every private object is checked independently for
tenant key prefix, an 8 MiB bound, saved length, SHA-256, image kind and PNG/JPEG/
WebP MIME before SUBMITTING. The provider receives repeated `image[]` parts in
the saved request order. A fifth, duplicate, missing, archived, cross-tenant or
corrupt reference fails before the paid boundary.

API and Next.js 16.3.8 production builds and 31 unit tests passed. Full
`npm run verify` passed 7 HTTP, 6 production-browser and 5 recovery/configuration
scenarios plus all 12 migrations. The HTTP flow uploaded two distinct image
assets, saved their ordered IDs, sent two multipart fields, ingested the private
result and preserved the separate edit quote. No live provider call was made.

## MEDIA-01D single-image editing — 2026-10-03

An opt-in image-edit preset has its own USD estimate and credit quote. The
tenant-scoped source must be active, at most 8 MiB, and match private bytes by
length, SHA-256 and MIME before the worker submits. The adapter sends multipart
image bytes to the fixed OpenAI edit endpoint; no arbitrary source URL is fetched.
Unit tests cover pricing, plan gates, multipart shape and integrity failures.
The HTTP fixture verifies the saved edit request, provider receipt, private
ingestion and separate quote. `npm test`, API build and full `npm run verify`
passed: 7 HTTP, 6 browser, 5 recovery scenarios and 12 migrations. The initial
sandboxed verifier attempt could not start local S3Proxy; the elevated isolated
rerun passed. Live model/billing acceptance and this slice's GitHub CI are open.

The same dated verifier covers bounded option selection: image size, quality and
opaque/transparent background; built-in voice, WAV/MP3 and speed. Unit contracts
assert the exact provider payload and reject cross-kind or out-of-range options.
The HTTP fixture verifies the option catalog and exact saved multipart edit
preset. API and clean Next.js 16.3.8 production builds, 31 unit tests and the
complete 7/6/5 local harness passed.

## MEDIA-01D retained output reconciliation — 2026-10-02

Added explicit reconciliation for the ambiguous case where provider bytes were
written to private storage but the worker lost its database claim before private
ingestion. The worker now retains the private output pointer on the generation,
moves the job to UNKNOWN, keeps the credit reservation in REVIEW and records a
`media_generation.output_reconciliation_needed` audit marker. This makes the
paid-boundary uncertainty visible for platform review without automatically
retrying or silently deleting the output.

Checks completed: `npm run build:api`, `npm test` and the full
`npm run verify` harness all passed. The full harness applied all 12 migrations,
passed 7 HTTP scenarios, 6 production-browser scenarios and 5 recovery/
configuration scenarios. The first sandboxed verifier attempt stopped at S3Proxy
with `Operation not permitted`; the required elevated verifier rerun completed
successfully.

## MEDIA-01D credit reconciliation guard — 2026-10-02

Added a platform-credit resolver guard for media-generation reservations: REVIEW
credits linked to a media job cannot be consumed or released while the generation
is still QUEUED, SUBMITTING, PENDING or OUTPUT_READY. This prevents a platform
operator from resolving credits before provider/output evidence reaches a terminal
state. Integration coverage was extended to create a REVIEW media reservation,
assert 409 while active, then allow release after the job becomes UNKNOWN.

Checks completed: `npm test` passed all 6 unit files and `npm run build:api`
passed TypeScript compilation. `node scripts/verify-local.mjs` was retried and
again stopped before integration at S3Proxy readiness with `Operation not
permitted`; Redis 7.2.11 was reachable. No fresh HTTP/browser/recovery pass is
claimed for this slice.

## MEDIA-01D local slice — 2026-10-02

Added generated-media plan allowlists (`MEDIA_IMAGE_PLANS`, `MEDIA_VIDEO_PLANS`,
`MEDIA_VOICE_PLANS`) and server-side workspace plan resolution before queueing.
The status endpoint returns only models available to the current plan, and queued
jobs freeze the allowed plan policy in their configuration/audit trail. Source
asset IDs are now checked for uniqueness, same-tenant ownership and active image
kind before the current OpenAI preset rejects unsupported source-byte editing.

Checks completed: `npm test` passed all 6 unit files, including the updated media
plan/source contracts, and `npm run build:api` passed TypeScript compilation. A
full `node scripts/verify-local.mjs` attempt reached Redis 7.2.11 but S3Proxy
exited before readiness with `Operation not permitted`, so no fresh HTTP/browser
or recovery pass is claimed for this slice.

## Generated-media evidence

- Concurrent identical request keys return one job/reservation. Changed payloads
  conflict. Role, membership, source/cost consent and stale target gates reject
  requests before provider submission.
- Real HTTP image/base64, WAV speech and asynchronous video fixtures deliver bytes
  into private S3Proxy. Magic checks plus real ffprobe validate assets. Provider
  URLs are not accepted as output; reads are bounded and redirects fail closed.
- Successful delivery settles the accepted fixed credit price once; missing USD
  cost stays null. Queued cancellation releases credits. In-flight cancellation
  retains its uncertainty and may complete. Invalid output/ambiguous acceptance
  keeps credits under review. Provider counters confirm no duplicate submission.
- Explicit attachment preserves other scenes/components, writes a version and
  clears content approval; stale content conflicts and repeat attachment is
  idempotent. Tenant downloads and sanitized record exports are covered.
- Actual worker SIGKILL/restart tests preserve video provider IDs and resume private
  output ingestion. A killed submit becomes UNKNOWN with REVIEW credits and no
  second provider call. Tests age heartbeats after the kill to accelerate the
  normal 60-second lease threshold.
- The browser accepts rights/cost, generates image and voice fixtures, previews
  their private files, attaches them to the saved scene, produces an actual MP4
  and reloads saved history. Desktop/light/dark/mobile screenshots are synthetic.
- Disabled provider configuration returns no models and rejects generation without
  creating a job; manual drafting and rendering still work.

## Findings fixed during this increment

The first integration assertion expected 403 for a non-member. Existing tenant
policy deliberately returns 404; the test now verifies that policy. The first
browser selector used an exact label lookup on a select whose label also contains
option text; the test now uses its accessible combobox name. Final visual review
corrected media-panel design tokens and waits for the mobile navigation transition
before capturing evidence. Earlier failed runs are not counted as successful.

Existing account/team/brand/content/text/agent/billing/credit/upload/render/export
scenarios were rerun. No business analytics were invented; no paid AI or real
Stripe transaction was made. User Windows services/database/media were not used.

## Environment and remaining gates

Node 24; production Next.js 16.3.5; compiled NestJS API/workers; PGlite WASM
PostgreSQL socket bridge; native Redis 7.2.11; private SigV4 S3Proxy 4.1.1; real
FFmpeg/ffprobe 6.1.1; isolated SMTP/text/media/billing/Stripe HTTP fixtures.
PGlite serializes requests, so these concurrency assertions do not establish native
PostgreSQL locking behavior. The PGlite archive is not native pg_dump/PITR or a
private-object backup. Java/S3Proxy dependencies are outside the npm audit.

Native PostgreSQL/Compose/MinIO, live image/video/voice/text quality/cost, signed
provider redirects, actual Stripe sandbox, real SMTP/cloud/TLS, media source edits,
full security/load/accessibility and full master acceptance remain open. Fixed
operator USD estimates are not provider-enforced spend caps. Automatic aged
staging cleanup and provider billing reconciliation after UNKNOWN remain open.

Remote publication was completed after explicit user approval. Public `main`
application commit `97381d1f620eb5f30ec095522c7057c99ac8c1c6` points to the exact
locally verified tree `dbf2bf8dca90b3b6612a72960d37b5d5b010702f`. Public Actions run
`37126029720` completed successfully. Its sole
`Native application verification` job passed setup, service initialization,
dependency installation, build, 31 unit tests, production/development dependency
audits, populated upgrade verification, native application flows, browser-evidence
upload and cleanup. This closes the current source-publication/CI gate, not the
separate live-provider, native Compose/MinIO or full-product acceptance gates.
