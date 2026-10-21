<!-- RECOVERY01G_CURRENT_START -->
## RECOVERY-01G current verification — 2026-10-22

Preserved Windows G edits; current focused recovery suite24/24 and actual Compose isolation configuration passed. Native suite now requires15 phases, retaining all14 previous phases. Current local full Compose status: running; not yet accepted. All THREE own-source CI jobs remain required before G acceptance. F40b936f/run39289873313 is separately closed by docs/qa/recovery01f-native-ci-evidence.json.

G reads exact historical object versions after overwrite/delete-marker, denies missing/wrong versions and unreconciled effects, observes provider submission attempts, checks private access, and cleans only its owned version inventory. The sampled LSN is only a fixture correlation label; coordinated DB/object/Redis PITR and production retention/reconciliation remain open. See docs/HISTORICAL_OBJECT_RECOVERY.md, docs/qa/recovery01g-evidence.json and docs/qa/recovery01g-unit-receipts.json. Exact changed paths are recorded in G evidence/checkpoint. Windows named-pipe execution and Python build-context exclusions preserve the existing architecture and all migrations.

Next: normal commit/push, inspect/fix all three exact-final-commit jobs, and retain final CI/package receipt outside the source capsule. Then RECOVERY-01H application-reference/historical-version manifest binding prerequisites. CI verifies fixtures and does not deploy.
<!-- RECOVERY01G_CURRENT_END -->

## Current recovery state — reconciled 2026-10-22

RECOVERY-01F is verified at 40b936fdd29cb2d3754c84602ab3bc10ff4ff03c, Actions run39289873313: all three jobs and required steps passed (285 unit,38 HTTP,28 browser,5 recovery,24 migrations,44 readability,zero audit vulnerabilities). Final receipt: docs/qa/recovery01f-native-ci-evidence.json. Earlier pending-F/E notes below are historical. F compared exact application rows and captured column metadata; it did not compare every schema property.

RECOVERY-01G Windows changes are preserved and undergoing their own verification. The prior local Compose log ended during MinIO build without a final report; it is not a pass. G adds historical version readback and external-effect reconciliation prerequisites to the full Compose verifier while retaining all 14 existing phases. G requires its own exact final commit and all THREE CI jobs. F's green CI does not verify G. Next: finish local/native G checks, refresh continuity and portable source ZIP, push normally and inspect/fix all three exact-source jobs. Coordinated DB/object/Redis PITR, production operations, live/deployed and full-master acceptance remain open. CI verifies fixtures and does not deploy.

## RECOVERY-01F populated application physical recovery — 2026-10-19

Local follow-up: locked install completed (269 packages; Fontkit patch verified). The broader recovery regression initially exposed a pre-existing Windows path literal mismatch in tests/native-upgrade-verification.test.ts; platform-resolved valid paths fix it while every rejection assertion remains. All 14 focused recovery/isolation tests now pass. Initial source 6bfca24/run39289498693 was published; this follow-up requires all three jobs on its own final commit.

Extended the existing no-network/tmpfs physical recovery fixture with all 24 unchanged SQL migrations and 19 synthetic rows in 11 of 37 application tables. Exact target row/column snapshots, later-change exclusion, source preservation, restored immutable-credit/FK/idempotency checks and tenant/role/revision predicates are implemented. Existing corrupt-base, missing-WAL, unreachable-target, promotion and retry assertions remain. Harness-only historical object/queue/external-effect prerequisites fail closed; this does not establish coordinated S3/Redis PITR or HTTP authorization.

Local four focused guards and PGlite SQL contract pass; syntax/editor checks pass. Windows Docker daemon is unavailable, so native acceptance requires all THREE jobs on the exact new published commit. The supplied predecessor receipt closes 22e0824/run39250074116, independently rechecked through GitHub API. Resume integrity passed after 464 CRLF-only files were restored exclusively when LF hashes matched the saved manifest; no other drift. No application, migration, dependency or CI workflow changes.

See docs/APPLICATION_PHYSICAL_RECOVERY.md and docs/qa/recovery01f-evidence.json for scope, changed paths and evidence. Next: publish and inspect/fix exact-source core, full 14-phase Compose and native-upgrade/physical jobs. Then RECOVERY-01G: historical private-object version retention/readback and external-effect reconciliation prerequisites in an isolated fixture. Production backup operations, live/deployed/full-master acceptance remain open. CI verifies fixtures and does not deploy.

# Requirements matrix

Authoritative mapping: [docs/REQUIREMENTS_MATRIX.md](docs/REQUIREMENTS_MATRIX.md).
