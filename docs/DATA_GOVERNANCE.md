# Data governance

Stored records include account identity and hashed authentication data, memberships, brand/creative revisions, content/scripts/campaigns/comments, prompts/results/usage, audit events, private media metadata and render snapshots. Tenant access requires current membership; roles constrain mutations and administration.

## Workspace export

OWNER/ADMIN can use Workspace health → Export workspace data or `GET /api/workspaces/:organizationId/operations/export`. The NDJSON export reads all pages of the implemented workspace records in one RepeatableRead database snapshot: workspace, brand/versions, safe member profiles, campaigns, content including archived items, versions/comments, asset metadata, render jobs, AI jobs/usage, activity, invitations with token hashes removed, credit account balances, immutable credit entries and reservations. Credit operation keys/request hashes are omitted.

The final `complete` record contains per-type counts and SHA-256 over every preceding line including newlines. Exports are assembled in a private temporary file before download headers, limited to 64 MiB and a 120-second transaction; an excessive export fails explicitly instead of silently returning a partial page. There is a one-request-per-minute limit per user/workspace, private/no-store delivery and an export audit event. Temporary files are removed after completion/failure/disconnection. No schedule/background export job is implemented.

Password hashes, sessions, auth/invitation tokens, provider credentials, internal object keys and worker run tokens are excluded. Metadata contains authenticated original/render download references; the export does not embed binary media, scene-cache bytes or internal render-input index rows. It is a workspace record export, not an all-account export or a database/media restore backup. There is no import route. Existing page-specific JSON exports still represent their labelled loaded/recent records.

## Retention and deletion

Assets hold originals, hashes/tags/rights notes. Renders hold immutable content snapshots, MP4/JPEG/SRT files, caches and approvals. Asset/content archiving retains historical work and access for current members; it does not delete bytes or free source allowance. Session and team access revocation are implemented.

Temporary processing files and incomplete final outputs are cleaned up when possible. Automatic expiration, output/cache/orphan collection, account/organization erasure, complete cross-store deletion and integration revocation remain unimplemented. Back up native PostgreSQL and media storage consistently. A fresh-database restore passed for isolated PGlite test data; native database plus private-media restore remains unverified. Technical features do not establish regulatory compliance.

Credit entries reject SQL UPDATE/DELETE and financial foreign keys prevent deleting credited organizations. Corrections append entries. Retention/anonymization and legal erasure behavior are still unimplemented; do not remove this protection for an account-deletion shortcut.
