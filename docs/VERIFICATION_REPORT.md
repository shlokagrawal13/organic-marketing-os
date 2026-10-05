# Verification report — Organic Marketing OS 0.9.2

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
