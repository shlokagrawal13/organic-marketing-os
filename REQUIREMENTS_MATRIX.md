## RECOVERY-01F populated application physical recovery — 2026-10-19

Local follow-up: locked install completed (269 packages; Fontkit patch verified). The broader recovery regression initially exposed a pre-existing Windows path literal mismatch in tests/native-upgrade-verification.test.ts; platform-resolved valid paths fix it while every rejection assertion remains. All 14 focused recovery/isolation tests now pass. Initial source 6bfca24/run39289498693 was published; this follow-up requires all three jobs on its own final commit.

Extended the existing no-network/tmpfs physical recovery fixture with all 24 unchanged SQL migrations and 19 synthetic rows in 11 of 37 application tables. Exact target row/column snapshots, later-change exclusion, source preservation, restored immutable-credit/FK/idempotency checks and tenant/role/revision predicates are implemented. Existing corrupt-base, missing-WAL, unreachable-target, promotion and retry assertions remain. Harness-only historical object/queue/external-effect prerequisites fail closed; this does not establish coordinated S3/Redis PITR or HTTP authorization.

Local four focused guards and PGlite SQL contract pass; syntax/editor checks pass. Windows Docker daemon is unavailable, so native acceptance requires all THREE jobs on the exact new published commit. The supplied predecessor receipt closes 22e0824/run39250074116, independently rechecked through GitHub API. Resume integrity passed after 464 CRLF-only files were restored exclusively when LF hashes matched the saved manifest; no other drift. No application, migration, dependency or CI workflow changes.

See docs/APPLICATION_PHYSICAL_RECOVERY.md and docs/qa/recovery01f-evidence.json for scope, changed paths and evidence. Next: publish and inspect/fix exact-source core, full 14-phase Compose and native-upgrade/physical jobs. Then RECOVERY-01G: historical private-object version retention/readback and external-effect reconciliation prerequisites in an isolated fixture. Production backup operations, live/deployed/full-master acceptance remain open. CI verifies fixtures and does not deploy.

# Requirements matrix

Authoritative mapping: [docs/REQUIREMENTS_MATRIX.md](docs/REQUIREMENTS_MATRIX.md).
