## Cross-store fixture manifests — RECOVERY-01C

Saved native dumps, object bodies/internal keys, reference manifests, session/private state and provider prompt counters stay in ignored private fixture directories. CI uploads only sanitized phase/boolean/count/hash evidence. Generated data never populates runtime business analytics. All user services/volumes/.env and 24 existing migrations are preserved. Quiesced synthetic recovery does not establish production retention/encryption/PITR/provider reconciliation. See [CROSS_STORE_BACKUP_QUEUE_RECOVERY.md](CROSS_STORE_BACKUP_QUEUE_RECOVERY.md).

## Native upgrade fixture evidence — RECOVERY-01B

Generated synthetic legacy rows and migration probes run only in a random labelled tmpfs PostgreSQL container with a dedicated network and a random loopback port. Real .env and all prior migrations are preserved. Credentials, generated private packages, source row snapshots and raw subprocess logs stay outside source/CI artifacts; only sanitized checks/counts are uploaded. Source handoffs carry no database/media backup. See [NATIVE_PRISMA_UPGRADE_RECOVERY.md](NATIVE_PRISMA_UPGRADE_RECOVERY.md).

## RECOVERY-01A interrupted native restore — 2026-10-19 IST

Native PostgreSQL17.11 negative control retained two tables after interrupted non-atomic restore; the atomic case rolled back to zero and clean retry restored all synthetic rows. Full Compose now uses the same COPY-barrier interruption probes and final `pg_restore --single-transaction`, retaining all prior cross-store/application checks. Five fixture guards/config passed; 25 protected hashes unchanged. Require own exact-source BOTH CI jobs for current populated acceptance. Prior NATIVE-01A final060a7d1/run39177109393 passed270/38/28/5 and full Compose/five-object restore. Wider native upgrade/migration interruption, PITR/live/full-master acceptance remain open. See `docs/POSTGRES_RESTORE_INTERRUPTION.md`.

## NATIVE-01A initial complete fixture acceptance — 2026-10-19 IST

Initial source `7c624d5` passed complete Compose/native cross-store job `117820808071` (run `39176723245`): source volumes removed; native DB/five private objects restored and app records/media/access/cleanup verified. Follow-up removes inherited shell fixture overrides and corrects MinIO release metadata; four guard tests and actual conflicting-parent configuration passed. Read newer exact-source BOTH jobs before final acceptance. Core job was still running at capture. Wider interrupted restore/upgrade, PITR and full live/master acceptance remain open. See `docs/qa/native01a-initial-compose-ci-evidence.json`.

## NATIVE-01A Compose/native restore — 2026-10-19 IST

Added an isolated full-stack verifier, pinned-source MinIO build, optional trusted build-CA secret and a separate verification-only CI job. Local application images, four ownership/env/port/redaction tests and actual Compose configuration passed. Full local MinIO is network-blocked; exact published CI must prove all services, real media/SMTP and separate native PostgreSQL/private-object restore after deleting source fixture volumes. Require full-mode sanitized report and every core/Compose CI step. Quiesced fixtures do not close interrupted upgrades/restores, PITR, live/deployed acceptance or the full master. See `docs/COMPOSE_NATIVE_VERIFICATION.md` and `docs/qa/native01a-evidence.json`.

# Data governance

Stored records include account identity and hashed authentication data, memberships, brand/creative revisions, content/scripts/campaigns/comments, prompts/results/usage, audit events, private media metadata and render snapshots. Tenant access requires current membership; roles constrain mutations and administration.

## Workspace export

OWNER/ADMIN can use Workspace health → Export workspace data or `GET /api/workspaces/:organizationId/operations/export`. The NDJSON export reads all pages of the implemented workspace records in one RepeatableRead database snapshot: workspace, brand/versions, safe member profiles, campaigns, content including archived items, versions/comments, asset metadata, render jobs, AI jobs/usage, activity, invitations with token hashes removed, credit account balances, immutable credit entries and reservations. Credit operation keys/request hashes are omitted.

Agent graph traces are available per job through the authenticated tenant-scoped AI trace route. The consolidated NDJSON export predates the 0.8 graph tables and does not yet include those rows; DATA-01 must add them before claiming a complete account export.

The final `complete` record contains per-type counts and SHA-256 over every preceding line including newlines. Exports are assembled in a private temporary file before download headers, limited to 64 MiB and a 120-second transaction; an excessive export fails explicitly instead of silently returning a partial page. There is a one-request-per-minute limit per user/workspace, private/no-store delivery and an export audit event. Temporary files are removed after completion/failure/disconnection. No schedule/background export job is implemented.

Password hashes, sessions, auth/invitation tokens, provider credentials, internal object keys and worker run tokens are excluded. Metadata contains authenticated original/render download references; the export does not embed binary media, scene-cache bytes or internal render-input index rows. It is a workspace record export, not an all-account export or a database/media restore backup. There is no import route. Existing page-specific JSON exports still represent their labelled loaded/recent records.

## Retention and deletion

Assets hold originals, hashes/tags/rights notes. Renders hold immutable content snapshots, MP4/JPEG/SRT files, caches and approvals. Asset/content archiving retains historical work and access for current members; it does not delete bytes or free source allowance. Session and team access revocation are implemented.

Temporary processing files and incomplete final outputs are cleaned up when possible. Automatic expiration, output/cache/orphan collection, account/organization erasure, complete cross-store deletion and integration revocation remain unimplemented. Back up native PostgreSQL and media storage consistently. A fresh-database PGlite restore and the bounded native PostgreSQL/private-media fixture restore passed (NATIVE-01A main060a7d1/run39177109393). RECOVERY-01A adds local native backend-interruption/rollback/retry proof and requires its own full Compose CI; see POSTGRES_RESTORE_INTERRUPTION.md. Production/PITR and broader recovery remain open. Technical features do not establish regulatory compliance.

Credit entries reject SQL UPDATE/DELETE and financial foreign keys prevent deleting credited organizations. Corrections append entries. Retention/anonymization and legal erasure behavior are still unimplemented; do not remove this protection for an account-deletion shortcut.
