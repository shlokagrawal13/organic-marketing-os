## Current fixture scope — RECOVERY-01D, 2026-10-19 IST

Complete Compose now requires fourteen phases, adding acknowledged-object-write failure, residual inspection, denied app startup, owned-bucket cleanup and identical-backup retry with a verified start gate. Every prior assertion and all three CI jobs remain. Local281 unit/13 focused guards/actual configuration passed; native acceptance requires own exact-source CI. Prior18f0b8f/run39237077202 passed all three. Older counts below are historical. See [PRIVATE_OBJECT_RESTORE_RECOVERY.md](PRIVATE_OBJECT_RESTORE_RECOVERY.md). CI verifies and does not deploy.

## Current fixture scope — RECOVERY-01C, 2026-10-19 IST

The full Compose verifier now has thirteen phases, a private synthetic provider, seven backup-preflight rejection controls and fresh-Redis queued/uncertain/private-output recovery followed by three-worker restart. Existing native interruption/atomic retry/media/tenant/SMTP checks remain. Current source requires all THREE exact-commit jobs; predecessor f99dba4/run39230879722 passed all three. Older ten-phase/two-job counts below are historical. See [CROSS_STORE_BACKUP_QUEUE_RECOVERY.md](CROSS_STORE_BACKUP_QUEUE_RECOVERY.md).

## Current verification scope — 2026-10-19 IST

RECOVERY-01A final ba2d4f1/run39179489223 passed both core and complete Compose/atomic restore jobs; retained receipt: `docs/qa/recovery01a-native-ci-evidence.json`. RECOVERY-01B adds a separate native populated Prisma upgrade/interrupted migration job; all THREE current-source jobs are required. Earlier two-job/pending-B notes below are historical. See [NATIVE_PRISMA_UPGRADE_RECOVERY.md](NATIVE_PRISMA_UPGRADE_RECOVERY.md) for the new bounded scope and remaining recovery gaps.

# Native PostgreSQL interrupted restore

RECOVERY-01A fixes the Compose verifier's native restore command to use `pg_restore --exit-on-error --single-transaction` for a fresh disposable target. `--exit-on-error` alone stops after a failure but can leave earlier restored schema/data committed. This is verification tooling for synthetic isolated fixtures; no production restore endpoint, backup scheduler or deployment is introduced.

The native test creates a fixture-only `omos_restore_fixture` schema with a volatile CHECK function. A per-target custom setting enables a pause during actual `pg_restore` COPY. The harness waits for exactly one named restore backend in `pg_stat_activity` with `wait_event='PgSleep'`, then calls `pg_terminate_backend` for only that backend in the generated restore database. It does not guess a kill delay or replace the restore with a mock.

The non-atomic negative control must exit non-zero and retain partially restored relations. After recreating only that disposable target database, the same interruption under `--single-transaction` must expose no restored relations before commit and leave zero fixture/application tables after rollback. A clean empty target is prepared, the pause is disabled, and the final atomic retry must succeed. The source database is never reset.

Run the local native probe with Node24 and a local Docker socket:

```bash
MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:postgres-recovery
```

It creates one unpredictable, labelled PostgreSQL17 tmpfs container with no host ports or network access. Separate source/restore databases contain three clearly synthetic rows and the COPY barrier. Container ID/ownership and strict restore-project identity are checked before database reset/cleanup. The module rejects a source project, ordinary project or malformed identity before invoking any SQL callback. It does not load `.env`; its checksum must remain unchanged. Only sanitized `.local/postgres-recovery-evidence.json` is emitted; no credentials, raw dump, session cookies or object bytes are published.

Fresh local PostgreSQL17.11 evidence: normal interrupted restore retained two visible tables; interrupted atomic restore retained zero. The clean atomic retry restored all three synthetic rows and the barrier row; source rows, real `.env` and fixture cleanup checks passed. Five focused ownership/env/port/redaction guards and actual Compose configuration passed. The full core suite and current full-Compose CI are recorded separately. See `docs/qa/recovery01a-postgres-interruption-evidence.json` and `docs/qa/recovery01a-evidence.json`.

The existing full Compose verifier now installs the barrier only after app writers stop and before its native custom dump. It checks that dump's SHA-256 before restore, runs both interruption controls against the separate restore project, checks the target volume's Compose ownership before recreating its database, then performs the final atomic restore. The existing original/rendered media, object hashes/metadata, sessions, tenant isolation, SMTP, all nine services and cleanup assertions remain. Its sanitized report includes both interruption observations and the successful atomic retry; the usual exact-source Compose CI job exercises this populated application schema and private-media recovery. All prior core build/unit/HTTP/browser/recovery/readability/upgrade/audit checks also remain required.

Full local MinIO remains network-blocked: the current normal-proxy probe of its Go dependency redirect host returns CONNECT403. Full current-source Compose acceptance runs as an ordinary independent GitHub Actions fixture job; no blocked dependency is fetched back into this workspace. Read the exact current run before treating this newer source as full-Compose verified. The preceding main `060a7d1` passed both jobs in run `39177109393`; its receipt is retained in `docs/qa/native01a-native-ci-evidence.json`.

This covers backend termination at a controlled COPY boundary and a quiesced synthetic restore. It does not close client/network loss, server/container crash at other boundaries, interrupted migrations, populated native predecessor upgrades, PITR/WAL replay, in-flight queue restore, encrypted provider credential recovery, production capacity/retention, live providers or full master acceptance. Next: RECOVERY-01B populated native predecessor upgrade and interrupted migration/retry audit. Source ZIPs carry code/context and are not SQL/media backups.
