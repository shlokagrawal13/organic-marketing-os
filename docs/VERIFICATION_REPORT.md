# Verification report — Organic Marketing OS 0.9.0

Verified locally on 2026-10-01. The generated-media implementation advances the
supplied V3 specification; it does not complete or certify the entire product.

| Check | Completed result |
| --- | --- |
| Unit tests | 28 passed |
| HTTP integration | 7 broad scenarios passed |
| Production-browser tests | 6 scenarios passed |
| Recovery/configuration | 4 scenarios passed |
| Prisma/API/Next.js | Client generation and both production builds passed |
| Fresh migrations | All 12 applied through Prisma deploy in the isolated harness |
| Populated upgrade/fresh restore | PGlite passed; old draft/user/membership/queued AI record, immutable credit ledger and saved media request/provider ID preserved |
| Npm audit | Last audited 2026-09-29: production 0/full 0; not rerun for 0.9, dependency versions unchanged |

The full local verifier reached its explicit final success message. A later
selected browser rerun checks the final media layout/capture adjustments; its
output explicitly says that HTTP/recovery suites were skipped. It is not counted
as an additional full-suite pass.

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
operator USD estimates are not provider-enforced spend caps. Automatic staging/
orphan cleanup and UNKNOWN output reconciliation require further engineering.

Remote Actions was not rerun. Its last observed run `36623211633` failed before
jobs; prior authenticated evidence named a billing gate. v0.9 upload was rejected
by automatic approval review for missing explicit source-export authorization.
No remote publication or native CI success is claimed.
