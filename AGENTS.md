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
