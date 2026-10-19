# Native populated Prisma upgrade and migration recovery

RECOVERY-01B adds an independent native PostgreSQL17/Prisma6.19.3 verification job. It exercises actual `prisma migrate deploy`, the `_prisma_migrations` ledger, `migrate resolve --rolled-back` and an unchanged-SQL retry. Application behavior, dependencies and all 24 existing migration SQL files are preserved. This is an isolated fixture harness, not an automatic production repair command.

Run with installed project dependencies, Node24 and the local Docker socket:

```bash
MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:native-upgrade
```

The harness creates a random labelled PostgreSQL tmpfs container and a dedicated labelled Docker network. PostgreSQL publishes a randomly allocated port on `127.0.0.1` only. It attaches no persistent or existing volumes. Actual container ownership, the registered port, fixture database names and private package path are checked before launching Prisma; SQL/reset/cleanup operations are restricted to the generated container. Only its owned resources are removed. It preserves Docker authentication/proxy settings while removing inherited connection selectors and fixture overrides.

Each Prisma invocation runs in its own generated `.local/native-upgrade/<nonce>/...` package with a copied schema and no `.env`. The generated database URL overrides the parent value; the harness rejects Prisma output indicating dotenv discovery and verifies the real `.env` hash remains unchanged. Fixture SQL, database credentials, source row snapshots and raw subprocess logs are excluded from tracked evidence and CI artifacts. Only `.local/native-upgrade-evidence.json` is uploaded.

## Populated predecessor boundaries

The four deployments copy original application migrations without edits:

| Applied migrations | Populated fixture before the next deployment |
| --- | --- |
| 4 | User, organization, owner membership, saved draft and queued AI request |
| 7 | The same rows plus credit account and immutable grant entry |
| 23 | The same rows plus a legacy research observation without `insight` |
| 24 | All old columns/values survive; new AI context and research insight defaults remain null |

Every deployment checks actual successful Prisma ledger rows and SHA-256 checksums against the original SQL. All old values are compared, allowing new columns. UPDATE and DELETE against the synthetic credit entry must still fail with the immutable-ledger trigger. The final upgraded database stays untouched while fault tests run against separate database clones.

## Actual interrupted migration and recovery

Two private fixture packages add one future, fixture-only migration: a default multi-statement batch and a batch wrapped in explicit `BEGIN`/`COMMIT`. Neither probe is placed in `prisma/migrations` or shipped to application deployments. Each creates a synthetic prefix table, pauses in actual PostgreSQL SQL, then would create a tail table.

The harness waits for exactly one fixture migration backend at the `PgSleep` barrier in its own fault database and terminates that backend. It checks a failed unfinished Prisma ledger attempt, unchanged legacy data/history and an ordinary `migrate deploy` retry rejected with **P3009**. The blocked retry must not mutate the ledger. Recovery removes only the synthetic probe schema, disables its pause, uses actual `migrate resolve --rolled-back`, then retries the exact same SQL bytes. Both the rolled-back failed attempt and the new successful attempt must remain, with matching checksums. Prefix/tail rows, legacy values, immutable credit enforcement and the original upgraded source database/history are verified again.

Observed locally on PostgreSQL17.11/Prisma6.19.3: **both** interrupted batches exposed zero probe tables during the pause and after termination. PostgreSQL's handling of this single batch did not reproduce partial committed DDL. The failed Prisma ledger still prevented ordinary retry. This does not establish that arbitrary Prisma migrations are atomic: explicit commits, concurrent/index operations, multiple batches and external effects need separate review. The earlier `pg_restore` negative control did reproduce committed partial schema; its result is a different operation.

Never treat `resolve --rolled-back` alone as repair for a real partially applied migration. An operator must inspect the exact database state, migration SQL/history, backup/restore options and effects before choosing a repair. This harness has complete ownership of a synthetic probe schema; it supplies no general repair recipe for user databases.

## Evidence and remaining scope

The local native receipt is `docs/qa/recovery01b-native-upgrade-evidence.json`; the increment summary is `docs/qa/recovery01b-evidence.json`. Two focused regressions verify fixture target/path restrictions and detection of lost/changed old data. The full existing core suite and Compose/atomic PostgreSQL/private-media restore job remain required, alongside the new native-upgrade job, on the exact published commit. CI verifies fixtures and does not deploy. The predecessor RECOVERY-01A final native CI receipt is retained as `docs/qa/recovery01a-native-ci-evidence.json`.

Representative legacy rows across these three predecessor intervals are verified; this does not certify every historical dataset/version, production migration capacity/downtime, arbitrary migration interruption boundaries, server/container/network failures, live provider/credential recovery, PITR/WAL replay, in-flight queue/cross-store backup consistency or full master acceptance. Next is RECOVERY-01C: audit and verify backup failure/quiescence and queue consistency with bounded disposable fixtures. Portable source ZIPs are not database/media backups.
