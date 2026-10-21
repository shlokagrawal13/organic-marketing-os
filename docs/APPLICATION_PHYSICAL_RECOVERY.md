# Populated application-schema physical recovery

RECOVERY-01F extends the owned, no-network, tmpfs-only PostgreSQL experiment in `scripts/verify-postgres-pitr.mjs`. Run `MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:postgres-pitr` on the Linux Docker runner. All prior synthetic-table, corrupt-base, missing-WAL, unreachable-target, clean-retry, promotion and source-preservation assertions remain. The existing three CI jobs are unchanged.

The fixture applies all 24 unchanged application SQL migrations through native psql before the physical base backup. This is schema construction, not a new Prisma deploy/history test; the separate native-upgrade job still verifies actual Prisma migration history. Representative synthetic rows populate two tenants, owner/client memberships, drafts, credit account and immutable grant/reservation entries, reserved queued work, an uncertain running request, a private asset reference and research history. No application/runtime provider receives fixture data.

After the base backup, the fixture saves an approved revision before the named restore point. Later transactions edit and invalidate that approval, fail queued work, delete the asset reference and insert later research. The restored database must match every public application table's target rows and captured column metadata exactly, including empty tables, and exclude all later changes. Captured metadata includes table/column name, data type, nullability and default; it does not explicitly compare column order, precision or enum identity. Source rows must remain at the later state during failed recovery attempts and after independent restored writes. All source migration hashes must remain unchanged.

On the restored cluster, native UPDATE and DELETE against immutable credits must fail, foreign-key and duplicate request-key violations must fail, tenant/role SQL predicates must exclude unrelated membership, and an independent content edit must reject a stale revision predicate. These are database constraints and representative application predicates, not HTTP authorization verification. Existing HTTP/browser and full Compose tenant/role/approval checks remain required on the exact published commit.

## Cross-store prerequisites

Database promotion alone cannot authorize application startup. The harness-only historical recovery gate rejects missing or overwritten object bytes, mismatched content type/recovery point, duplicate object keys, incomplete reference coverage, reused Redis, non-isolated writers, unreviewed queue reconstruction and unreconciled external effects. Its positive unit case is a synthetic contract test. The native experiment supplies no historical object bytes and proves its startup callback remains uncalled. It does not start S3, Redis or application services and cannot claim coordinated PITR.

Before a real historical application recovery, operators still need:

- A complete inventory of assets, render outputs/cache segments and retained generated outputs at the database target, with protected historical object bytes or immutable versions and metadata. Current bucket contents cannot stand in for historical versions.
- An isolated restore target and fresh Redis. Reconstruct work from recovered durable rows only after review; do not attach current queue state to an older database.
- Reconciliation of provider calls, publications and financial effects that occurred after the database point. Database rollback cannot undo remote effects, and replay can duplicate charges or publication.
- Durable remote base/WAL/object retention, encryption/access controls, monitored schedules, supported versions, restore ownership, secret/configuration recovery and measured production RPO/RTO.

The existing fourteen-phase Compose test independently verifies a quiesced logical database/object snapshot and fresh-Redis reconstruction. It is not combined with this physical experiment. Production operations, live/deployed behavior and full master acceptance remain open.

## Evidence

RECOVERY-01F final source `40b936fdd29cb2d3754c84602ab3bc10ff4ff03c` passed all three jobs and required steps in run `39289873313`: 285 unit, 38 HTTP, 28 browser, 5 recovery, 24 migrations, 44 readability samples and zero audit vulnerabilities. Its [final exact-source receipt](qa/recovery01f-native-ci-evidence.json) closes the source ZIP's pending own-CI status. The native report verified 37 application tables, 11 populated tables, 19 fixture rows and 1,196 physical base files. [RECOVERY-01F evidence](qa/recovery01f-evidence.json) retains local checks and publication closure. The newer [RECOVERY-01G prerequisites](HISTORICAL_OBJECT_RECOVERY.md) require separate source verification and CI. CI verifies fixtures and does not deploy.
