## Current fixture scope — RECOVERY-01E, 2026-10-19 IST

The native-upgrade job now also verifies actual physical PostgreSQL backup and named-target WAL replay, with a separate sanitized artifact. Every previous core/native/14-phase Compose assertion remains. Local283 unit/two new guards/actual native PITR/config passed; require all three exact-source jobs. Prior a41de48/run39242635642 passed all three. See [POSTGRES_PHYSICAL_PITR.md](POSTGRES_PHYSICAL_PITR.md). Synthetic-table PITR does not close application-schema/coordinated private-object recovery or production backup operations. CI verifies and does not deploy.

## Current fixture scope — RECOVERY-01D, 2026-10-19 IST

Complete Compose now requires fourteen phases, adding acknowledged-object-write failure, residual inspection, denied app startup, owned-bucket cleanup and identical-backup retry with a verified start gate. Every prior assertion and all three CI jobs remain. Local281 unit/13 focused guards/actual configuration passed; native acceptance requires own exact-source CI. Prior18f0b8f/run39237077202 passed all three. Older counts below are historical. See [PRIVATE_OBJECT_RESTORE_RECOVERY.md](PRIVATE_OBJECT_RESTORE_RECOVERY.md). CI verifies and does not deploy.

# Cross-store backup preflight and fresh-Redis recovery

RECOVERY-01C extends the existing disposable Compose verifier. Application code, all 24 migration SQL files, dependencies and the three CI jobs are preserved. The complete Compose job now requires thirteen phases, including backup rejection controls and recovery of queued/uncertain/private-output work. Run `MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:compose`; `--config-only` checks isolation and is not full acceptance.

## Validate before source removal or target writes

The verifier waits for all five application writers (API, web and three workers) to stop, then confirms their actual Compose state is `exited`. A single fixture seeder adds clearly synthetic recovery records and finishes before the native dump/object snapshot. No concurrent fixture writer runs during the snapshot.

The private manifest binds the matching generated source/restore projects, stopped-writer list, native custom dump bytes/hash, complete listed object set, bytes/hashes, content type, cache control and metadata. Database references from assets, render outputs/cache segments and retained generation outputs must exist in the object snapshot; available database lengths/hashes must match. Fixture objects are bounded to 1,000 objects and 64 MiB. The manifest and private bytes stay in ignored `.local/compose-verification/`, outside source and CI artifacts.

Before source-volume removal, target startup, each target reset, native retry and private-object restoration, the saved files are reread and validated. The object writer also validates every object's encoding/hash and duplicate keys before its first bucket/object write. The manifest is an integrity check for trusted generated fixtures, not a signed/authenticated production backup format.

Seven negative controls alter independent in-memory copies: truncated dump, changed dump byte, missing object, changed object byte, changed metadata, missing stopped-writer evidence and a wrong restore project. Each must reject before any destructive callback. Native source recovery rows/credit records and the entire private-object snapshot must remain identical after all rejections. Only the valid saved set permits removal of original fixture volumes. These checks establish preflight behavior; they do not make a later SQL/S3 operation atomic across stores.

## Restore work into fresh Redis

PostgreSQL and all private objects restore into a separate generated project after the source stack and volumes are removed. The restore Redis must have `DBSIZE=0` before applications start. Existing atomic/non-atomic native restore interruption controls remain required. API/web startup and exact row/object/session/tenant checks run before any restored worker consumes the queued records.

The additional records span all three worker queues:

| Saved state | Required behavior after native DB/private-object restore |
| --- | --- |
| Dispatched-but-QUEUED AI request | Reconstruct from PostgreSQL, complete once through the synthetic provider, settle its three reserved credits once |
| Stale RUNNING AI request | Fail for review, retain three reserved credits and make zero new provider calls |
| QUEUED render with saved asset input | Reconstruct and produce an actual 1280×720 one-second MP4 verified with ffprobe |
| OUTPUT_READY image generation | Ingest the restored private image into an authenticated tenant asset, make no new media-provider submission and settle two credits once |

The synthetic text provider is a harness-only Node service on the generated Docker network with no published host port. API provider keys stay empty, preserving the original no-key 503 assertion; only the fixture worker receives the synthetic text-provider configuration. The seeder records one synthetic uncertain-call acceptance before backup. A fresh provider after restore must observe exactly one queued request and zero uncertain-call replays. This uses seeded saved states; it is not a new demonstration of a worker crash during an actual provider call. The existing core tests still exercise actual killed workers/lost queue entries separately.

The four recovery records share a synthetic credit account with a 100-credit grant and reservations of 3+3+2. Successful recovery must leave available 92/reserved 3, exactly two appended CONSUME entries, the uncertain reservation in REVIEW, and every original ledger entry unchanged. UPDATE/DELETE must still fail through the native immutable trigger. All three BullMQ jobs must be completed and all pending/active/delayed/prioritized counts empty.

The verifier then actually restarts all three workers. It waits for new dispatcher heartbeat cycles from each worker and rechecks exact job/account/ledger/reservation state, provider counts and terminal queue counts. No duplicate settlement or provider call may appear. Original uploaded/rendered bytes and the recovered generated image remain authenticated and tenant-scoped. The original nine persistent services and the additional private fixture provider are all checked; generated stacks are cleaned up and real `.env` must remain unchanged.

## Evidence and limits

Four focused backup regression cases and actual Compose configuration are local checks; the full unit suite is recorded in `docs/qa/recovery01c-unit-receipts.json`. The provider HTTP contract also runs on a generated local loopback port and its output is validated against the existing compiled draft schema; the listener is closed afterward. This is not full container/runtime acceptance. See `docs/qa/recovery01c-provider-smoke-evidence.json` and `docs/qa/recovery01c-evidence.json`.

Local full MinIO remains blocked by the enforced network policy at `storage.googleapis.com`; no proxy/TLS/policy workaround is used. Full acceptance requires every existing core and native-upgrade step plus the expanded complete Compose report on the exact published commit. The source checkpoint cannot claim its future CI result; the final external receipt closes that exact run. Predecessor f99dba4/run39230879722 passed all three jobs and is retained in `docs/qa/recovery01b-native-ci-evidence.json`. CI verifies fixtures and does not deploy. Source ZIPs do not contain native database/media backups.

These are controlled quiesced synthetic snapshots and representative saved states. Concurrent/remote writers, interrupted object PUTs after valid preflight, server/network/container crashes, production capacity/retention/encryption, real provider reconciliation/charges, PITR/WAL replay and full master acceptance remain open. Next: RECOVERY-01D, controlled private-object restore failure and clean retry/application-start gating, followed by wider recovery acceptance.
