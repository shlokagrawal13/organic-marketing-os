# Verification and remaining gates — 0.5.0

## Executed locally

| Suite | Result | Coverage |
|---|---|---|
| Unit | 12 passed | Password/session/roles, router schemas/fallback/accounting, abort/response bounds, content/media options, deterministic captions and actual child-process cancellation |
| HTTP integration | 6 broad scenarios passed | Account/email/tenant/content/text; private uploads and real renders; collaboration/invitations/restore; all-role guards, concurrency requests, quotas, hostile multipart and full export; platform credit authority/ledger lifecycle; signed idempotent billing events, ordered subscriptions, monthly grants and refund/expiry reversals |
| Playwright | 5 scenarios passed | Core workflow, mobile registration, upload/render/play/download/approve, workspace health/export, credit balances/history, light/dark/mobile layouts |
| Recovery/configuration | 3 scenarios passed | No-key manual MP4 and startup config; AI process kill/no replay/queue repair; running render cancellation, interruption and new-job retry |
| Migrations | 8 applied | Original seven migrations retained; billing plan/subscription/event models added |
| Populated upgrade/restore | Passed on PGlite | v0.1 data retained through v0.5; immutable ledger restored; fresh database loaded from archive after deleting the original test workspace |
| Builds | Passed | Prisma client generation, API TypeScript, Next.js production build |
| Production dependency audit | 0 known advisories | Full npm tree also 0; S3Proxy Java dependencies outside npm scope |

The scenarios contain multiple assertions and are not a claim of exhaustive coverage. See `VERIFICATION_REPORT.md` for findings, evidence and open acceptance gates.

Actual FFmpeg/ffprobe checks include H.264/AAC portrait 720×1280, landscape 1920×1080 and square 720×720 output, durations, decoded non-silent audio, SRT timing, thumbnail generation and scene reuse. A browser upload above 10 MiB verifies the proxy path. Synthetic fixtures are generated and probed before upload tests. Automated signal/codec checks do not replace subjective media quality or broad font/device testing.

## Environment and fault scope

Node.js 24; PGlite WASM PostgreSQL socket bridge; native Redis 6.2; signed S3Proxy 4.1.1; actual FFmpeg 6.1.1; local SMTP capture; isolated compatible-text and signed-billing fixtures. Compose uses native PostgreSQL 17, Redis 7 and private MinIO, which were not executable here. Application runtime does not fall back to these test fixtures.

PGlite uses `pgbouncer=true` to avoid multiplexed prepared-statement collisions and serializes database access. Concurrent HTTP requests exercise application guards but do not validate native lock races. The default application connection string does not use that test workaround.

Fault tests kill the harness's AI worker after the fixture acknowledges a request, then age its heartbeat to accelerate the 60-second stale threshold. The restarted worker fails that job without another accepted provider call and retains its credit reservation in REVIEW. They also repair a QUEUED database record missing from Redis. Render tests cancel after the real Rendering stage begins, interrupt a running worker with SIGTERM, restart and produce a successful immutable retry. They do not establish recovery during a full host power loss, render SIGKILL orphan cleanup or high-load operation. A separate unit test verifies child-process abort.

The no-key test starts a real second API process with all provider URL/key/model settings blank. AI requests return 503 without a job; manual content and an actual MP4 still succeed. A separate startup with HTTP origin/insecure cookies under production mode exits with failure.

The upgrade test captures a PGlite data-directory archive and restores it into a fresh database, including credit balances and the immutable ledger trigger. Deliberate ledger trigger rejection uses direct PGlite SQL because the socket bridge may disconnect after trigger errors; native-mode HTTP tests retain Prisma UPDATE/DELETE rejection checks. It is not native `pg_dump`/PITR verification, does not exercise Prisma's deployment bookkeeping for the populated upgrade, and does not restore private object bytes. Workspace NDJSON export is not a database restore backup.

## Reproduce

```bash
npm ci
npm run build
npm test
npm audit --omit=dev --audit-level=moderate
npm audit --audit-level=moderate
npm run verify:upgrade
python3 scripts/install_test_storage.py
npm run verify
```

Install Java 17+, Python 3.9+, `redis-server`, FFmpeg/ffprobe and DejaVu Sans; `TEST_REDIS_BINARY` selects a Redis binary. All local services start and stop inside `scripts/verify-local.mjs`. Ports 3000, 4000, 4001, 4002, 5433, 6379, 4569, 4999 and 1025 must be free. `--skip-ui` skips only browser tests; HTTP and recovery suites still run. Scripts and integration/fault tests refuse unsupported standalone execution without the harness marker.

For dedicated, disposable native PostgreSQL/Redis only:

```bash
MOS_ALLOW_NATIVE_TESTS=isolated-test-services node scripts/verify-local.mjs --native --production-web
```

Set isolated test-only `DATABASE_URL`/`REDIS_URL` first. Native mode migrates and mutates those services. Never aim it at an existing workspace. The supplied GitHub workflow sets this opt-in, but two remote runs ended `startup_failure` before any job began; no native result exists. Native mode still uses local signed S3Proxy 4.1.1 and text/SMTP/billing fixtures.

## Open gates

Native database locking/quotas/upgrade/restore; Docker/MinIO pull/start; private cloud S3/R2 compatibility; deployed HTTPS/proxy; actual SMTP inbox delivery; live AI quality/cost; financial controls; full media/parser/font matrix; complete account deletion/retention; penetration/load/accessibility audits; social/billing/missing master modules. A passing production dependency audit is time-specific and does not establish security of the app or development tooling.
