# Product operations

## Daily checks

- Open Workspace health as OWNER/ADMIN: check database/queue/private storage, both fresh worker heartbeats, job state counts and tracked source/render/cache usage. Provider/email configuration still needs separate live verification.
- Review failed text jobs and provider usage; timeouts may still cost money. Credits & usage exposes held reservations; failed attempted or interrupted calls remain REVIEW until a verified platform administrator checks provider usage and records a settlement.
- Review failed/stale renders and their error/stage. Cancel unwanted work through the API/UI rather than deleting database rows or objects.
- Monitor database, Redis persistence, source bucket, render/cache growth and temporary disk. The 2 GiB source quota does not bound output/cache storage.
- Check backups, SMTP and provider rates/account budgets. Test real restores into separate environments.

## Incidents

Detect → classify → contain → recover → verify → document. Preserve logs, immutable snapshots and job IDs. Disable further expensive generation during provider incidents; inspect provider acceptance before deliberate retries. For account incidents revoke sessions and confirm media access is denied. Stop mutations during database incidents and restore to a separate instance before switching traffic.

Both dispatchers reconcile queued database records with Redis, including previously dispatched text jobs. A stale RUNNING AI call is failed without automatic replay because provider acceptance/charges may be unknown. Actual AI process-kill/queue-loss and running render cancellation/graceful interruption passed locally; native concurrency, complete host loss and load exercises remain open. A render retry creates a new job; successful old output remains immutable. Avoid manually deleting assets used by snapshots; RenderInput references protect database relationships, not external bucket deletion.

Keep PostgreSQL backups and private media objects consistent. MinIO data lives in the named `media_data` volume; `docker compose down -v` removes named data volumes. A populated upgrade and isolated fresh-database restore passed on PGlite; native PostgreSQL plus media restore remains unverified. No automatic cache/orphan retention or complete deletion tooling is provided.

Workspace data export is available in Workspace health, with record pagination, a digest footer and private media references. It excludes binary media and is not an infrastructure backup or import format. See DATA_GOVERNANCE.md for limits.

## Missing operations

Full platform administration beyond credit adjustment/review, automated alerts, paid billing/refunds, full storage reconciliation and retention remain unimplemented. Audit records are application-protected, not externally immutable. Do not share raw logs containing private content or secrets.
