# Verification report — Organic Marketing OS 0.9.2

Verified locally on 2026-10-03. The generated-media implementation advances the
supplied V3 specification; it does not complete or certify the entire product.

| Check | Completed result |
| --- | --- |
| Unit tests | 31 passed across 6 test files |
| HTTP integration | 7 broad scenarios passed |
| Production-browser tests | 6 scenarios passed |
| Recovery/configuration | 5 scenarios passed |
| Prisma/API/Next.js | Client generation and both production builds passed |
| Fresh migrations | All 12 applied through Prisma deploy in the isolated harness |
| Populated upgrade/fresh restore | PGlite passed; old draft/user/membership/queued AI record, immutable credit ledger and saved media request/provider ID preserved |
| Npm audit | Last audited 2026-09-29: production 0/full 0; not rerun for 0.9, dependency versions unchanged |

The full local verifier reached its explicit final success message. A later
selected browser rerun checks the final media layout/capture adjustments; its
output explicitly says that HTTP/recovery suites were skipped. It is not counted
as an additional full-suite pass.



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

Remote publication was completed after explicit user approval. Public `main` now
contains the 0.9.2 source, and recursive verification matched remote blob paths,
modes and SHAs to the local checkpoint with zero mismatches. The earlier
push-created Actions run `37022495097` reported an account-side startup gate before
runner steps could start, but a later public run `37049004398` for commit
`b2ac0ee74247ad8b9478bf82516161ea4211e69f` completed the native application
verification workflow successfully. The current retained-output and image-edit slices still
needs its own publish and remote CI check.
