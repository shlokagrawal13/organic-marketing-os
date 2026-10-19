## RECOVERY-01F populated application physical recovery — 2026-10-19

Extended the existing no-network/tmpfs physical recovery fixture with all 24 unchanged SQL migrations and 19 synthetic rows in 11 of 37 application tables. Exact target row/column snapshots, later-change exclusion, source preservation, restored immutable-credit/FK/idempotency checks and tenant/role/revision predicates are implemented. Existing corrupt-base, missing-WAL, unreachable-target, promotion and retry assertions remain. Harness-only historical object/queue/external-effect prerequisites fail closed; this does not establish coordinated S3/Redis PITR or HTTP authorization.

Local four focused guards and PGlite SQL contract pass; syntax/editor checks pass. Windows Docker daemon is unavailable, so native acceptance requires all THREE jobs on the exact new published commit. The supplied predecessor receipt closes 22e0824/run39250074116, independently rechecked through GitHub API. Resume integrity passed after 464 CRLF-only files were restored exclusively when LF hashes matched the saved manifest; no other drift. No application, migration, dependency or CI workflow changes.

See docs/APPLICATION_PHYSICAL_RECOVERY.md and docs/qa/recovery01f-evidence.json for scope, changed paths and evidence. Next: publish and inspect/fix exact-source core, full 14-phase Compose and native-upgrade/physical jobs. Then RECOVERY-01G: historical private-object version retention/readback and external-effect reconciliation prerequisites in an isolated fixture. Production backup operations, live/deployed/full-master acceptance remain open. CI verifies fixtures and does not deploy.

# Physical PostgreSQL backup and named-target WAL recovery

RECOVERY-01E verifies an actual PostgreSQL physical base backup and archive recovery to a named restore point. Run `MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:postgres-pitr`. The existing native-upgrade CI job now runs it after populated Prisma/migration recovery and uploads a separate sanitized `postgres-pitr-evidence` report. All three existing jobs and their previous steps remain required.

The harness creates one random `omos-pitr-verify-<16 hex>` container, validates its ownership label, uses `--network none`, publishes no ports and attaches only tmpfs mounts. PostgreSQL instances use private Unix sockets with TCP listening disabled. No real `.env`, application database, user service, named volume or external storage is loaded. Container removal destroys the generated clusters, backup and WAL archive; this is an acceptance experiment, not retained production backup storage.

## Executed sequence

1. Initialize a checksummed PostgreSQL17 cluster and enable replica-level WAL plus local archive copying. Create one clearly synthetic baseline row.
2. Run actual `pg_basebackup -Fp -X stream -c fast --manifest-checksums=SHA256` and require `pg_verifybackup` success. Record only manifest hash and file count in evidence.
3. Force a WAL segment switch after backup, insert a second row and create a named restore point. Capture the exact two-row state. Then delete the first row and insert a third row; the source state must differ. Switch WAL again and wait for the target segment to reach the archive.
4. Corrupt `PG_VERSION` in a separate base copy. Actual `pg_verifybackup` must fail before any recovery-start callback runs.
5. Start valid-base recovery with an empty WAL archive, then separately with the real archive and a nonexistent target name. Each actual `pg_ctl` start must exit nonzero, its log must contain PostgreSQL's target-not-reached fatal error, and SQL connections must fail. Source rows must remain unchanged.
6. Copy the same unchanged verified base into a guarded fresh retry directory and recover with the complete archive and correct target. Exact target rows must return: the later insert is absent and later deletion is undone. Native replay LSN must reach the target; recovery ends and PostgreSQL promotes from timeline1 to a new timeline.
7. Write independently to the promoted cluster, prove source rows/timeline remain unchanged and reverify the original base/hash. Remove only the owned generated container and check real `.env` unchanged.

`hot_standby=off` keeps failed/partial recovery from accepting SQL connections. `recovery_target_action=promote` is deliberate for the successful isolated retry; it is not a production traffic-switch command. Recovery-directory cleanup accepts only four fixed generated case paths, rejecting source/base/archive paths and traversal. Unit regressions also require native backup verification to succeed before recovery startup.

Local native PostgreSQL17.11 completed this sequence, including 972 physical backup files and promotion to timeline2. See [native receipt](qa/recovery01e-postgres-pitr-evidence.json), [local verification](qa/recovery01e-evidence.json) and [previous exact-source CI](qa/recovery01d-native-ci-evidence.json). This source capsule records local checks; its own all-three-job published CI result is saved in a final external receipt after execution. CI verifies and does not deploy.

## Operating prerequisites still open

This covers a small synthetic table and named restore-point recovery. It does not establish application-schema physical PITR, arbitrary time/LSN targets, timeline branching, remote archive interruption/corruption, archive durability, retention/encryption, production scheduling/monitoring or measured production RPO/RTO. It does not coordinate historical S3 object versions or Redis queues with the recovered database point. The retained fourteen-phase logical cross-store/queue restore proves a separate quiesced fixture procedure; the two experiments are not combined cross-store PITR acceptance.

Production readiness still needs a retained full/base backup and continuous protected WAL archive, verified recoverability and supported PostgreSQL versions, documented retention/encryption/access controls and incident ownership, a consistent private-object recovery point, secret/configuration recovery, restore isolation and a tested traffic-switch/runbook. Live-provider/deployed and full master acceptance remain open. Source ZIPs do not contain native backups, WAL or media.

Next: RECOVERY-01F, assess populated application-schema physical restore and cross-store point-in-time prerequisites, preserving existing recovery/tenant/credit/media checks and user resources.
