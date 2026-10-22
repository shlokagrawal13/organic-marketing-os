<!-- RECOVERY01H_CURRENT_START -->
## RECOVERY-01H verified implementation and final continuity — 2026-10-22

H implementation f33276cbe55d6363e3f44abea1278b81d247881e/run39702680294 passed ALL THREE jobs and every required step:300 unit,38 HTTP,28 browser,5 recovery,24 migrations,44 readability and zero production/full audit vulnerabilities. All16 Compose phases passed, binding6 restored application references to6 historical versions; fresh-Redis/immutable-credit/restart/no-replay assertions remain. All four artifact ZIP digests/CRCs, decoded job receipts and300 unique unit receipts were inspected. See docs/qa/recovery01h-native-ci-evidence.json. Local31 focused tests and separate cached-image Windows16-phase runtime verification passed, with fixture cleanup and .env unchanged. No local rebuild is claimed.

This final documentation/evidence payload requires ALL THREE jobs on its own exact final commit. Carry the external recovery01h-final-ci-receipt.json with the source ZIP to close this capsule’s own-CI status. The source ZIP is portable source/context, not a database/media backup. G final dd2b34e/run39698034764 is reconciled in docs/qa/recovery01g-final-ci-receipt.json; its original Windows cold queued-AI failure remains distinct from its successful diagnostic, without an invented cause. Previous pending notes below are historical.

H is bounded logical-restore reference/manifest verification; historical copies are created after restore. Physical DB/S3/Redis PITR, production backup/retention operations, real-provider reconciliation and live/deployed/full-master acceptance remain open. CI verifies fixtures and does not deploy. Next after final closure CI: RECOVERY-01I pre-target historical application manifest/physical snapshot binding.21 broad task tracks remain open. See docs/APPLICATION_OBJECT_BINDING.md.
<!-- RECOVERY01H_CURRENT_END -->

<!-- RECOVERY01G_CURRENT_START -->
## RECOVERY-01G verified implementation and evidence closure — 2026-10-22

G implementation f6ac3ecb59bcc26ae03bc402636a197a1367b1b8 passed ALL THREE jobs and required steps in Actions run39695812351:295 unit,38 HTTP,28 browser,5 recovery,24 migrations,44 readability samples and zero production/full audit vulnerabilities. The full Compose fixture passed15 phases, retaining every old phase and verifying historical versions, native missing-version rejection, denied anonymous access, exact provider receipt/one submission, owned version cleanup and original source preservation. Current artifacts downloaded through the normal route and ZIP digests/CRC were inspected. Receipt: docs/qa/recovery01g-native-ci-evidence.json. F40b936f/run39289873313 remains separate historical acceptance.

Current payload persists that verified G receipt and reconciles active checkpoint/current-verification/changed-path/publication/handoff fields. It requires ALL THREE CI jobs on its own exact final closure commit; the final external receipt closes this capsule's pending closure-CI status. Current source and portable ZIP must match; no previous green commit substitutes for the final run. See docs/HISTORICAL_OBJECT_RECOVERY.md and docs/qa/recovery01g-evidence.json.

Next after final closure CI: RECOVERY-01H bounded binding of recovered application object references to a historical version manifest, preserving fresh-Redis and reviewed external-effect prerequisites. The sampled LSN remains only a correlation label. Coordinated DB/S3/Redis PITR, production backup operations, real-provider reconciliation, live/deployed and full-master acceptance remain open. CI verifies fixtures and does not deploy.
<!-- RECOVERY01G_CURRENT_END -->

## Current recovery state — reconciled 2026-10-22

RECOVERY-01F is verified at 40b936fdd29cb2d3754c84602ab3bc10ff4ff03c, Actions run39289873313: all three jobs and required steps passed (285 unit,38 HTTP,28 browser,5 recovery,24 migrations,44 readability,zero audit vulnerabilities). Final receipt: docs/qa/recovery01f-native-ci-evidence.json. Earlier pending-F/E notes below are historical. F compared exact application rows and captured column metadata; it did not compare every schema property.

RECOVERY-01G Windows changes are preserved and undergoing their own verification. The prior local Compose log ended during MinIO build without a final report; it is not a pass. G adds historical version readback and external-effect reconciliation prerequisites to the full Compose verifier while retaining all 14 existing phases. G requires its own exact final commit and all THREE CI jobs. F's green CI does not verify G. Next: finish local/native G checks, refresh continuity and portable source ZIP, push normally and inspect/fix all three exact-source jobs. Coordinated DB/object/Redis PITR, production operations, live/deployed and full-master acceptance remain open. CI verifies fixtures and does not deploy.

## RECOVERY-01F populated application physical recovery — 2026-10-19

Local follow-up: locked install completed (269 packages; Fontkit patch verified). The broader recovery regression initially exposed a pre-existing Windows path literal mismatch in tests/native-upgrade-verification.test.ts; platform-resolved valid paths fix it while every rejection assertion remains. All 14 focused recovery/isolation tests now pass. Initial source 6bfca24/run39289498693 was published; this follow-up requires all three jobs on its own final commit.

Extended the existing no-network/tmpfs physical recovery fixture with all 24 unchanged SQL migrations and 19 synthetic rows in 11 of 37 application tables. Exact target row/column snapshots, later-change exclusion, source preservation, restored immutable-credit/FK/idempotency checks and tenant/role/revision predicates are implemented. Existing corrupt-base, missing-WAL, unreachable-target, promotion and retry assertions remain. Harness-only historical object/queue/external-effect prerequisites fail closed; this does not establish coordinated S3/Redis PITR or HTTP authorization.

Local four focused guards and PGlite SQL contract pass; syntax/editor checks pass. Windows Docker daemon is unavailable, so native acceptance requires all THREE jobs on the exact new published commit. The supplied predecessor receipt closes 22e0824/run39250074116, independently rechecked through GitHub API. Resume integrity passed after 464 CRLF-only files were restored exclusively when LF hashes matched the saved manifest; no other drift. No application, migration, dependency or CI workflow changes.

See docs/APPLICATION_PHYSICAL_RECOVERY.md and docs/qa/recovery01f-evidence.json for scope, changed paths and evidence. Next: publish and inspect/fix exact-source core, full 14-phase Compose and native-upgrade/physical jobs. Then RECOVERY-01G: historical private-object version retention/readback and external-effect reconciliation prerequisites in an isolated fixture. Production backup operations, live/deployed/full-master acceptance remain open. CI verifies fixtures and does not deploy.

# Project instructions

Start with `START_HERE.md`, `PROJECT_CHECKPOINT.json`, `PROJECT_STATUS.md` and `docs/TASK_BOARD.md`. Then read the relevant domain document and related code before editing. The supplied master specification is preserved in `docs/MASTER_SPEC.md`. These files carry project context across chats, accounts and development environments; do not depend on previous chat memory.

Keep Next.js for the UI and NestJS for application APIs. Preserve PostgreSQL/Prisma and Redis/BullMQ. Do not substitute localStorage, SQLite, static dashboards or a Next.js-only backend for the prescribed architecture.

Never populate business analytics with invented data. Test fixtures belong only in tests/harnesses and must remain visibly separate from runtime providers. Never commit secrets or `.env`.

Every tenant route must validate session membership and constrain resource access by organization. Test cross-tenant access and role failures. Content edits invalidate approval; critical changes require optimistic revision checks.

Implement in verifiable increments. Update status, requirement mappings and changelog. A successful build is not production verification. Do not label the full product complete until the master acceptance flow, live-provider tests and restore verification pass.

For frontend code also follow `apps/web/AGENTS.md` and the installed Next.js docs.

## Continuity contract

The user wants the agent to continue implementation and perform verification independently, without repeatedly asking them to test or resupply the project history. Resolve routine local work autonomously. Ask only for an essential missing decision, external capability or authorization that is not already present. The user clarified that missing API keys meant product AI-provider keys.

Before a large change, set the active task and a concrete next action in `PROJECT_CHECKPOINT.json`. At each completed increment, and before returning a deliverable, update it together with `docs/TASK_BOARD.md`, `docs/SESSION_LOG.md`, both status copies and relevant requirement/changelog entries. Record exact changed paths, checks actually run, known failures, and externally blocked work. If interrupted, preserve the working tree and clearly record incomplete work; never mark it verified from a previous build.

On resume, check the source against `CHECKPOINT_MANIFEST.json` using `python scripts/package_handoff.py --check` when Python 3 is available. A mismatch means inspect and retain intervening edits, reconcile the checkpoint and then continue; do not silently overwrite user changes. If the tool is unavailable, compare the recorded files and evidence manually and say that integrity was not automatically checked.

Create a fresh portable source checkpoint using `python scripts/package_handoff.py` after updating the records. It includes the code, specification, progress and evidence. Keep real `.env`, credentials, user databases/media volumes and raw test logs separate. A source ZIP or workspace record export is not a native database/media backup. When a private Git repository is available, preserve the same continuity files there and record the commit/branch; do not claim a push that did not succeed.

Current native/live verification limits are evidence gaps, not permanent bans. Recheck the actual environment and newly authorized connections on resume. Do not assume a GitHub connector supplies terminal execution or that a previous account's connections carry into a new account. Never use the user's populated services as disposable test fixtures. Preserve existing `.env`, named volumes and prior migrations.

## Authorized verification and publication workflow

On 2026-10-18 the user explicitly requested the previous complete workflow: implement, verify, push code to GitHub and inspect the CI/CD pipeline on the published commit. This is standing authorization for routine project commits/pushes and CI verification; do not stop at local-only changes or repeatedly ask for push approval. Preserve unrelated work, check the exact changed scope, never force-push over intervening commits, and inspect/fix CI failures before claiming completion. The existing pipeline is verification-only; do not claim a deployment or live-provider acceptance from a green CI run. Keep publication/CI receipts and continuity records aligned with exact source commits.
