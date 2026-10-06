# Verification and remaining gates — 0.9.2

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

Latest full-suite evidence is recovery follow-up native Actions run 37484095477 attempt 1 at 981dd237c4a4d30bc7ed6b6a897c6617c09255f7: 59 unit, 7 HTTP, 7 production-browser, 5 recovery/configuration cases, builds, zero-advisory audits, populated PGlite upgrade/archive restore and 12 migrations. The active-poll case waited for natural Redis lock expiry. See VERIFICATION_REPORT.md for dated scope and remaining gates. A scenario contains multiple assertions and does not imply exhaustive coverage.

## Reproduce with disposable services

```bash
npm ci
npm run build
npm test
npm run verify:upgrade
python3 scripts/install_test_storage.py
python3 scripts/install_test_redis.py # optional, compiler and make required
npm run verify
```

Requirements: Node 24, Java 17+, Python 3.9+, Redis, FFmpeg/ffprobe and DejaVu Sans.
`TEST_REDIS_BINARY` can select a native Redis executable; the harness also finds
the checksum-pinned `.local/test-tools/redis-7.2.11/src/redis-server` build.
Ports 3000, 4000–4003, 4555, 4569, 4998–4999, 5433, 6379 and 1025 must be free.
The harness creates isolated PGlite/private storage, random storage credentials,
SMTP capture and synthetic provider outputs. It sets test-only provider values
before starting workers. These fixtures are never application fallbacks.

`--skip-ui` runs HTTP and recovery suites without browsers. For a specific UI
change, `--ui-only --ui-spec=generated-media.spec.ts` runs that browser spec against
fresh test services and reports the narrower scope. It does not certify the
skipped suites. `npm audit --omit=dev` and `npm audit` are separate dated checks.

Native mode is for **dedicated disposable** PostgreSQL/Redis only:

```bash
MOS_ALLOW_NATIVE_TESTS=isolated-test-services node scripts/verify-local.mjs --native --production-web
```

Set test-only DATABASE_URL/REDIS_URL first. This migrates and mutates the selected
services. Never target the user's existing workspace. Native mode still uses
isolated S3Proxy/SMTP/provider fixtures. Actual Docker/MinIO has a separate gate.

## Coverage boundaries

Provider unit tests enforce configured presets, estimate/model/source gates,
bounded responses, official-origin credentials and rejection of URL/malformed
outputs. Durable HTTP/worker scenarios test credits, tenant roles, idempotency,
private validated files, cancellation races, ambiguous acceptance, saved video-ID
polling, output recovery and revision-checked attachment. Browser scenarios cover
the real Next proxy, generated/uploaded media, rendering, approval and saved state.

Fault tests kill actual isolated workers; stale database heartbeat timestamps are advanced
after confirmed child exit instead of waiting a minute. The media-restart case holds the first accepted-video poll, verifies an active Redis job and a surviving lock above 25 seconds, then allows the real 120-second queue lock and 30-second stalled checks to recover naturally. Redis locks/lists are not edited. The completion deadline is 210 seconds (lock + up to two scans + ingestion margin), within a 300-second case budget. Same provider ID, private output, completed queue state and one submission are required. This verifies local restart behavior,
not full host power loss or provider-billing reconciliation. The PGlite bridge
serializes SQL: native lock/race correctness remains unverified. The populated
upgrade fixture applies SQL directly, restores a fresh PGlite data-directory
archive and checks data/ledger trigger/provider receipt preservation; it does not
exercise native migration bookkeeping, pg_dump/PITR or object-store restoration.

Open gates include live provider quality and billing, extended media adapters,
source references, native concurrency/restore, cloud/TLS/mail, full parser/font/
device/security/load/accessibility audits, data deletion/retention and all remaining
master modules. Keep those gates separate from a successful local suite.
