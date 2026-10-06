# Changelog

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
