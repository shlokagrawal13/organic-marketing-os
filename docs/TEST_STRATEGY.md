# Verification and remaining gates — 0.9.2

Latest full-suite evidence is P native Actions run 37479269861 attempt 2 at c2936113616522db099771684226276e91976957: 59 unit, 7 HTTP, 7 production-browser, 5 recovery/configuration cases, builds, audits, populated upgrade and 12 migrations. The recovery-hardening follow-up separately passed 7 HTTP and 5 recovery cases locally; other suites were not rerun. See VERIFICATION_REPORT.md for dated scope and remaining gates. A scenario contains multiple assertions and does not imply exhaustive coverage.

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
