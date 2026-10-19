## Current fixture scope — RECOVERY-01E, 2026-10-19 IST

The native-upgrade job now also verifies actual physical PostgreSQL backup and named-target WAL replay, with a separate sanitized artifact. Every previous core/native/14-phase Compose assertion remains. Local283 unit/two new guards/actual native PITR/config passed; require all three exact-source jobs. Prior a41de48/run39242635642 passed all three. See [POSTGRES_PHYSICAL_PITR.md](POSTGRES_PHYSICAL_PITR.md). Synthetic-table PITR does not close application-schema/coordinated private-object recovery or production backup operations. CI verifies and does not deploy.

## Current fixture scope — RECOVERY-01D, 2026-10-19 IST

Complete Compose now requires fourteen phases, adding acknowledged-object-write failure, residual inspection, denied app startup, owned-bucket cleanup and identical-backup retry with a verified start gate. Every prior assertion and all three CI jobs remain. Local281 unit/13 focused guards/actual configuration passed; native acceptance requires own exact-source CI. Prior18f0b8f/run39237077202 passed all three. Older counts below are historical. See [PRIVATE_OBJECT_RESTORE_RECOVERY.md](PRIVATE_OBJECT_RESTORE_RECOVERY.md). CI verifies and does not deploy.

## Recovery verification scope — RECOVERY-01C

All three CI jobs remain verification-only. The expanded Compose harness validates saved private backups before source deletion/target mutation and runs restored queued work only after exact database/media baseline checks. Its synthetic provider, seeded data and hash manifest are fixture tooling; no production backup scheduler, signed backup format, automatic repair or deployment was added. See [CROSS_STORE_BACKUP_QUEUE_RECOVERY.md](CROSS_STORE_BACKUP_QUEUE_RECOVERY.md).

## Current verification pipeline — RECOVERY-01B

GitHub Actions now runs three verification jobs: core application checks; complete disposable Compose/atomic native DB/private-media restore; and native populated Prisma predecessor/interrupted migration recovery. Require all three on the exact published source. The migration fault SQL exists only in ignored private fixture packages and never enters application migration deployment. No production repair automation/deployment was added. See [NATIVE_PRISMA_UPGRADE_RECOVERY.md](NATIVE_PRISMA_UPGRADE_RECOVERY.md).

# Deployment

**Production deployment is pending.** The provided Compose stack is for local development. Application Docker stages and isolated configuration are locally verified. Full Compose/MinIO and quiesced native cross-store acceptance require the exact-source dedicated CI report; see COMPOSE_NATIVE_VERIFICATION.md for the local network block and acceptance conditions.

## Staging gates

1. Run native database/Redis CI, then the actual Compose/MinIO stack. Verify populated upgrades, concurrency, cancellation and recovery.
2. Build lockfile-based images with immutable release tags. Provision PostgreSQL, persistent Redis (`noeviction`), SMTP and private S3-compatible storage. Use restricted service identities and secret-manager credentials; local MinIO root credentials are not a production identity design.
3. Run `npm run db:migrate` from the build image once before upgrading API/workers; never use `db push` against production.
4. Deploy web, API, text worker and render worker separately on private networking. Build Next.js with `API_INTERNAL_URL` reachable from web; a runtime-only variable change does not update already-built rewrites.
5. Install supported FFmpeg/ffprobe and fonts in API (upload probing) and render-worker runtimes. Set CPU/memory/temp-disk limits and monitor worker capacity. Compose limits render-worker to 2 CPUs/1536 MiB and one job at a time; production sizing is not benchmarked.
6. Configure HTTPS ingress, HTTPS WEB_ORIGIN, COOKIE_SECURE=true and NODE_ENV=production. API startup checks these settings. Restrict direct API access if configuring trusted proxy hops. Allow at least 27 MiB request bodies through ingress for a 25 MiB upload plus multipart metadata, with appropriate rate/time limits.
7. Precreate a private bucket and validate read/write/range behavior with least-privilege credentials. Keep public access disabled; configure encryption and backup/retention. Compose auto-creation is a development convenience.
8. Through the deployed origin verify API/storage/worker health, auth/email/tenant isolation, large upload, render, playback/download and approval invalidation. Run `npm run verify:youtube-live-readiness` before any authorized live YouTube upload test; it must pass with the deployed secret configuration and current operator policy receipt. Run authorized live text-provider tests with agreed spend limits.
9. Finish remaining modules and full master acceptance before claiming product production readiness.

## Rollback and data

Keep the previous images, environment configuration and database/object backups. The 0.2 media and 0.3 recovery migrations are additive, but schema compatibility is not an executed rollback guarantee. Prefer forward fixes; validate any restore in a separate environment before switching traffic. An isolated populated upgrade and fresh-database restore were executed on PGlite. The NATIVE-01A disposable Compose job verifies quiesced native PostgreSQL/private-object restore when its full report passes on the exact source. RECOVERY-01A locally verifies controlled native backend-interruption rollback and clean retry; its newer full application/private-media flow requires both exact-source CI jobs. PITR, other interruption boundaries, native populated predecessor upgrades and application rollback remain open.

Do not expose PostgreSQL/Redis/object-store administration publicly. Mailpit is only a local mail capture. Define backup/PITR, private bucket protection, log retention, output/cache cleanup, budgets and incident ownership. See UPGRADE_0.3.md for the local Windows upgrade.

## Verification and export capacity

Native test services must be disposable and set `MOS_ALLOW_NATIVE_TESTS=isolated-test-services`; the checked-in CI supplies this flag. Never point the harness at a real workspace database or Redis. Both jobs ran successfully on prior main060a7d1 (run39177109393). New increments require their own exact-source core and Compose reports.

Workspace health does not certify live providers. Export uses a database RepeatableRead transaction up to 120 seconds and temporary disk up to 64 MiB plus metadata, per active request. Allow appropriate request timeouts and monitor database/disk use; large exports fail explicitly. Data exports exclude media bytes and cannot replace database/object backups.

The prior exact-source run passed both full and production dependency audits with zero vulnerabilities and exercised actual runtime container builds/startup. New source must pass both verification jobs; these development fixtures do not establish deployment or production readiness.

## Capture a deployed YouTube readiness receipt

`npm run capture:youtube-deployed-readiness` sends only an authenticated GET to the deployed API's existing OWNER/ADMIN endpoint. Supply `MOS_DEPLOYED_API_ORIGIN` (HTTPS origin with no credentials/path/query/fragment), `MOS_DEPLOYED_ORGANIZATION_ID` (workspace UUID), and `MOS_DEPLOYED_SESSION_COOKIE` (the 64-character lowercase hex token, optionally prefixed with `mos_session=`) through a private environment or secret injection. Do not paste the session into chat, source control or shell history. The runner does not create a session; use an authorized owner/admin session from that deployment.

Optional `MOS_DEPLOYED_RECEIPT_OUTPUT` chooses a new JSON file; the default is a timestamped `.local/youtube-deployed-readiness-*.json`. Optional `MOS_DEPLOYED_RECEIPT_TIMEOUT_MS` is an integer from 100 to 120000 (default 15000). HTTP is accepted only on localhost, 127.0.0.1 or ::1 for isolated tests. All redirects are rejected so a cookie is not forwarded to another endpoint. The response must be JSON within 64 KiB and match the current policy version, all nine check IDs, overall readiness and no-secret/no-live-call receipt markers.

A valid receipt is saved privately (mode 0600 on supported filesystems), with a captured timestamp, API origin, organization UUID and canonical sanitized readiness fields. The cookie and arbitrary server extensions/messages are excluded. Existing files are never overwritten. Exit 0 means a valid receipt with readiness passing; exit 1 means either a saved valid failed-readiness receipt or a capture/validation/write failure, in which case no valid new receipt is available. Inspect the selected output and stderr to distinguish these cases. A filesystem failure after file creation may leave an incomplete file; choose a fresh path for retry and do not treat an incomplete JSON file as evidence.

Local mock/loopback receipts are test evidence only. Capturing a receipt does not send a post or perform a live Google request, and configuration readiness does not prove actual provider acceptance, deployment health or full master acceptance. Keep actual deployment receipts private until their disclosure is reviewed.
