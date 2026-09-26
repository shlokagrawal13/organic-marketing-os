# Deployment

**Production deployment is pending.** The provided Compose stack is for local development. This release's Docker/MinIO images and startup were not exercised here; local verification used separate processes, PGlite, native Redis and S3rver.

## Staging gates

1. Run native database/Redis CI, then the actual Compose/MinIO stack. Verify populated upgrades, concurrency, cancellation and recovery.
2. Build lockfile-based images with immutable release tags. Provision PostgreSQL, persistent Redis (`noeviction`), SMTP and private S3-compatible storage. Use restricted service identities and secret-manager credentials; local MinIO root credentials are not a production identity design.
3. Run `npm run db:migrate` from the build image once before upgrading API/workers; never use `db push` against production.
4. Deploy web, API, text worker and render worker separately on private networking. Build Next.js with `API_INTERNAL_URL` reachable from web; a runtime-only variable change does not update already-built rewrites.
5. Install supported FFmpeg/ffprobe and fonts in API (upload probing) and render-worker runtimes. Set CPU/memory/temp-disk limits and monitor worker capacity. Compose limits render-worker to 2 CPUs/1536 MiB and one job at a time; production sizing is not benchmarked.
6. Configure HTTPS ingress, HTTPS WEB_ORIGIN, COOKIE_SECURE=true and NODE_ENV=production. API startup checks these settings. Restrict direct API access if configuring trusted proxy hops. Allow at least 27 MiB request bodies through ingress for a 25 MiB upload plus multipart metadata, with appropriate rate/time limits.
7. Precreate a private bucket and validate read/write/range behavior with least-privilege credentials. Keep public access disabled; configure encryption and backup/retention. Compose auto-creation is a development convenience.
8. Through the deployed origin verify API/storage/worker health, auth/email/tenant isolation, large upload, render, playback/download and approval invalidation. Run authorized live text-provider tests with agreed spend limits.
9. Finish remaining modules and full master acceptance before claiming product production readiness.

## Rollback and data

Keep the previous images, environment configuration and database/object backups. The 0.2 media and 0.3 recovery migrations are additive, but schema compatibility is not an executed rollback guarantee. Prefer forward fixes; validate any restore in a separate environment before switching traffic. An isolated populated upgrade and fresh-database restore were executed on PGlite. Native PostgreSQL/PITR, private-object restore and application rollback were not executed.

Do not expose PostgreSQL/Redis/object-store administration publicly. Mailpit is only a local mail capture. Define backup/PITR, private bucket protection, log retention, output/cache cleanup, budgets and incident ownership. See UPGRADE_0.3.md for the local Windows upgrade.

## Verification and export capacity

Native test services must be disposable and set `MOS_ALLOW_NATIVE_TESTS=isolated-test-services`; the checked-in CI supplies this flag. Never point the harness at a real workspace database or Redis. The supplied workflow is configured but was not run remotely in this review.

Workspace health does not certify live providers. Export uses a database RepeatableRead transaction up to 120 seconds and temporary disk up to 64 MiB plus metadata, per active request. Allow appropriate request timeouts and monitor database/disk use; large exports fail explicitly. Data exports exclude media bytes and cannot replace database/object backups.

Runtime dependencies passed the release audit. The S3rver development test chain retains 4 advisories; do not ship the test harness/development dependency installation as a public service. Actual runtime container builds/starts still require the Docker gate above.
