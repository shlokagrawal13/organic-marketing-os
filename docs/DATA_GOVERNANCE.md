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

Agent graph traces are available per job through the authenticated tenant-scoped AI trace route. Under DATA-01A, the consolidated NDJSON export adds the previously omitted tenant-owned tables: `socialConnection` (with encrypted access/refresh token ciphertexts securely stripped), `contentClaimReview`, `publicationIntent` (with internal idempotency request keys/hashes stripped), `publicationSchedule` (with request keys stripped), `publicationAttempt` (with upload session ciphertexts and request keys/hashes stripped), `publicationPolicyReview`, `billingSubscription`, `billingEvent`, and `billingInvoice`.

The final `complete` record contains per-type counts and SHA-256 over every preceding line including newlines. Exports are assembled in a private temporary file before download headers, limited to 64 MiB and a 120-second transaction; an excessive export fails explicitly instead of silently returning a partial page. There is a one-request-per-minute limit per user/workspace, private/no-store delivery and an export audit event. Temporary files are removed after completion/failure/disconnection. No schedule/background export job is implemented.

Password hashes, sessions, auth/invitation tokens, provider credentials, internal object keys and worker run tokens are excluded. Metadata contains authenticated original/render download references; the export does not embed binary media, scene-cache bytes or internal render-input index rows. It is a workspace record export, not an all-account export or a database/media restore backup. There is no import route. Existing page-specific JSON exports still represent their labelled loaded/recent records.

## Retention and deletion

Assets hold originals, hashes/tags/rights notes. Renders hold immutable content snapshots, MP4/JPEG/SRT files, caches and approvals. Asset/content archiving retains historical work and access for current members; it does not delete bytes or free source allowance. Session and team access revocation are implemented.

DATA-01A implements safe member-data revocation (`DELETE /api/workspaces/:organizationId/operations/members/:targetUserId`):
- Authorized to OWNER and ADMIN roles only; non-privileged roles receive 403.
- Self-revocation is explicitly prohibited (returns 403; members must use the separate workspace-leave flow).
- OWNER memberships cannot be revoked through this endpoint, including by an ADMIN; the mutation rechecks the role so a concurrent promotion cannot bypass this rule.
- Deletes the workspace membership and terminates all active sessions for the target user.
- Leaves immutable financial records (`CreditEntry`, `CreditReservation`) intact.
- Preserves the full workspace audit trail and appends a `member.revoked` audit event recording the actor and prior role.

### Connected social account disconnect & credential scrubbing — DATA-01B

DATA-01B implements the social account disconnect endpoint (`DELETE /api/workspaces/:organizationId/social-connections/:id`):
- **Role Authorization**: Accessible exclusively to `OWNER` and `ADMIN` roles. Non-privileged roles (`EDITOR`, `CREATOR`, `ANALYST`, `CLIENT`) receive 403 Forbidden.
- **Credential Erasure**: Atomically zeros and clears secret credential fields: `accessTokenCiphertext = ""` (scrubbed), `refreshTokenCiphertext = null`, `tokenExpiresAt = null`, `refreshTokenExpiresAt = null`, `refreshPendingAt = null`, and sets `revokedAt = now()`.
- **In-flight Publication Cancellation**: Any queued or due `PublicationSchedule` on the connection is transitioned from `SCHEDULED` to `CANCELED` with `outcomeCode: "CONNECTION_DISCONNECTED"`. Reserved attempts are transitioned to `BLOCKED` with `outcomeCode: "AUTH_REVOKED"`, and submitting attempts are marked `UNKNOWN` with `outcomeCode: "REVOKED_DURING_SUBMISSION"`.
- **Referential Integrity & Clean Removal**: If no child records (`PublicationAttempt`, `PublicationPolicyReview`, `PublicationSchedule`) reference the connection, the row is hard-deleted from the database. If references exist, it is retained in soft-disconnected status with scrubbed credentials to uphold historical publication auditability without violating `onDelete: Restrict` foreign key constraints.
- **Audit Logging**: Appends an immutable `social_connection.disconnected` event to `AuditLog` recording actor, provider, external account identity, and whether the record was hard-deleted.

### Tenant Data Retention & Expired Record Pruning — DATA-01C

DATA-01C implements workspace retention pruning per `MASTER_SPEC §71 & §147` via `POST /api/workspaces/:organizationId/operations/retention-prune`:
- **Role Authorization**: Accessible strictly to `OWNER` and `ADMIN` roles. Non-privileged roles (`EDITOR`, `CREATOR`, `ANALYST`, `CLIENT`) receive 403 Forbidden. Non-members receive 404 Not Found.
- **Dry-Run Capability (`?dryRun=true`)**: Provides a non-destructive inspection mode returning candidate record counts across all prunable categories without mutating any database records.
- **Pruning Scope & Conditions**:
  - **Expired Invitations**: Workspace invitations where `expiresAt < now()`.
  - **Invalidated / Canceled Publication Intents**: Publication intents with `status IN ['INVALIDATED', 'CANCELED']` that have zero active/historical child publication schedules and attempts.
  - **Canceled Publication Schedules**: Publication schedules with `status = 'CANCELED'` that have zero associated publication attempts.
  - **Stale Render Jobs**: Failed or canceled scratch render rows older than 24 hours (`status IN ['FAILED', 'CANCELED']` and `createdAt < now() - 24 hours`) only when `outputKey`, `thumbnailKey` and `captionsKey` are all null. Rows that reference private media stay in place until an object-store reconciliation job can delete database rows and bytes together.
- **Immutable Financial & Audit Protection**:
  - Financial records (`CreditEntry`, `CreditReservation`, `BillingSubscription`, `BillingInvoice`) and compliance logs (`AuditLog`) are strictly protected from deletion or mutation.
  - Core creative content (`Campaign`, `ContentItem`, `Asset`, `BrandProfile`, `BrandVersion`) is preserved unconditionally.
- **Audit Logging**:
  - In non-dry-run mode, appends an immutable `retention.pruned` event to `AuditLog` containing exact deleted counts (`expiredInvitations`, `invalidatedPublicationIntents`, `canceledPublicationSchedules`, `staleRenderJobs`), total pruned records, actor ID, and timestamp.
- Candidate counts and deletes run under the workspace row lock in one transaction, so a dry-run or execution cannot report a candidate set that was changed by another retention call midway through the operation.

### Tenant Audit Log Querying & Tamper-Evident Compliance Export — DATA-01D

DATA-01D implements structured tenant audit log querying and tamper-evident compliance export per `MASTER_SPEC §58, §71, & §84`:
- **Filtered Querying (`GET /api/workspaces/:organizationId/operations/audit`)**:
  - **Role Authorization**: Restricted strictly to `OWNER` and `ADMIN` roles. Non-privileged roles (`EDITOR`, `CREATOR`, `ANALYST`, `CLIENT`) receive 403 Forbidden. Non-members receive 404 Not Found.
  - **Multi-Attribute Filters**: Supports filtering by `action` prefix (e.g. `team.`, `workspace.`, `retention.`, `social_connection.`), `actorId`, `startDate`, and `endDate`.
  - **Deterministic Cursor-Based Pagination**: Employs `cursor` ID and bounded `take` (default 50, maximum 100), returning `{ items, nextCursor, totalCount }`.
- **Compliance Audit Export (`GET /api/workspaces/:organizationId/operations/audit-export`)**:
  - **Role Authorization**: Accessible only to `OWNER` and `ADMIN` roles.
  - **NDJSON Streaming**: Delivers a manifest line (`type: "manifest"`), followed by serialized audit entries (`type: "auditLog"`), concluded by an immutable checksum footer (`type: "complete"`).
  - **Tamper-Evident SHA-256**: Terminal complete record verifies SHA-256 hash over all preceding lines including newlines.
  - **Audit Logging**: Appends an immutable `audit.exported` event to `AuditLog` recording the actor, exported entry count, filters, and SHA-256 checksum.

### Workspace Legal Hold & Data Freeze Management — DATA-01E

DATA-01E implements enterprise legal discovery, dispute preservation, and regulatory data freeze controls per `MASTER_SPEC §56 & §97`:
- **Role Authorization**: Restricted strictly to `OWNER` and `ADMIN` roles. Non-privileged roles (`EDITOR`, `CREATOR`, `ANALYST`, `CLIENT`) receive 403 Forbidden. Non-members receive 404 Not Found.
- **Enable Legal Hold (`POST /api/workspaces/:organizationId/operations/legal-hold`)**:
  - Places the workspace under an active data freeze.
  - Accepts a mandatory `reason` (string, 3–500 chars) and optional `caseReference` (string, max 100 chars).
  - Emits an immutable `data.legal_hold.enabled` event to `AuditLog` containing reason, case reference, timestamp, and actor identity.
  - Duplicate enable requests when a hold is already active return 409 Conflict.
- **Inspect Legal Hold (`GET /api/workspaces/:organizationId/operations/legal-hold`)**:
  - Returns current hold status: `{ organizationId, active: boolean, hold: { id, reason, caseReference, enabledAt, enabledBy } | null }`.
- **Release Legal Hold (`DELETE /api/workspaces/:organizationId/operations/legal-hold`)**:
  - Lifts the data freeze on the workspace.
  - Requires a mandatory `releaseReason` (string, 3–500 chars).
  - Emits an immutable `data.legal_hold.released` event to `AuditLog`.
  - Releasing when no hold is active returns 409 Conflict.
- **Enforcement on Destructive Mutations**:
  - **Retention Pruning**: `POST /api/workspaces/:organizationId/operations/retention-prune` is rejected with `HTTP 423 Locked`, returning active hold metadata to prevent routine record destruction during legal proceedings.
  - **Member Data Revocation**: `DELETE /api/workspaces/:organizationId/operations/members/:userId` is rejected with `HTTP 423 Locked`, preserving user-linked evidence and sessions until the hold is formally released.
  - **Asset Reconciliation**: `POST /api/workspaces/:organizationId/operations/reconcile-assets` is rejected with `HTTP 423 Locked`.
  - **Workspace Erasure**: `POST /api/workspaces/:organizationId/operations/erasure` is rejected with `HTTP 423 Locked`.
  - Lifts cleanly once the legal hold is released by an authorized administrator.

## Asset Reconciliation & Orphan Pruning (DATA-01F)
- `POST /api/workspaces/:organizationId/operations/reconcile-assets`:
  - Detects unattached/archived assets (assets where `archivedAt` is set or that possess zero render inputs and zero media generations).
  - Supports dry-run inspection via `?dryRun=true`, reporting candidate asset count, estimated bytes, and asset metadata without deleting.
  - In non-dry-run mode, purges candidate asset records, frees storage allowances, and appends an immutable `data.assets.reconciled` audit entry.
  - Rejects with `HTTP 423 Locked` if the workspace is under an active legal hold.

## Workspace Account Anonymization & Safe Erasure (DATA-01F)
- `POST /api/workspaces/:organizationId/operations/erasure`:
  - Enforces OWNER-only role authorization and strict confirmation phrase (`confirmText: "ERASE_WORKSPACE_DATA"`).
  - In-flight safety check: Rejects with `HTTP 409 Conflict` if active video render or publishing jobs are running.
  - Legal hold lock: Rejects with `HTTP 423 Locked` if legal hold is active.
  - **Financial Record Invariance**: Respects PostgreSQL foreign keys and ledger immutability (`CreditEntry`, `CreditReservation`, `BillingSubscription`, `BillingInvoice` remain strictly protected and unmodified).
  - Purges child content, campaigns, comments, reviews, renders, assets, agent runs/steps, invitations, and social connections.
  - Scrambles BrandBrain profile/DNA and anonymizes Organization name to `[ERASED WORKSPACE]`.
  - Revokes all tenant memberships and appends an immutable `data.workspace.erased` audit record.

Temporary processing files and incomplete final outputs are cleaned up when possible. Automatic expiration, output/cache/orphan collection, account/organization erasure, complete cross-store deletion and integration revocation remain unimplemented. Back up native PostgreSQL and media storage consistently. A fresh-database PGlite restore and the bounded native PostgreSQL/private-media fixture restore passed (NATIVE-01A main060a7d1/run39177109393). RECOVERY-01A adds local native backend-interruption/rollback/retry proof and requires its own full Compose CI; see POSTGRES_RESTORE_INTERRUPTION.md. Production/PITR and broader recovery remain open. Technical features do not establish regulatory compliance.

Credit entries reject SQL UPDATE/DELETE and financial foreign keys prevent deleting credited organizations. Corrections append entries. Retention/anonymization and legal erasure behavior are still unimplemented; do not remove this protection for an account-deletion shortcut.
