# Observability

Implemented: request IDs, normalized errors, bounded structured API/job logs, tenant audit events, lifecycle timestamps, provider usage/latency/outcomes, and text/render worker heartbeats.

`GET /api/health` probes database and Redis. Tenant AI status reports provider configuration and worker heartbeat; asset status checks private storage. OWNER/ADMIN Workspace health consolidates database/Redis/storage checks, fresh worker heartbeats, provider/email configuration, tenant job status counts and database-tracked source/render/cache sizes. It explicitly identifies excluded bytes and unimplemented capabilities. Provider configuration is not a live provider check.

Video studio exposes stage/progress/errors/reuse counts and recent history. Progress is approximate work-stage progress, not a time forecast. Upload validation errors have bounded internal details and request IDs; public errors omit sensitive paths/details.

Both dispatchers reconcile queued database records with BullMQ. AI jobs with expired ownership heartbeats fail with a possible-charge warning instead of invoking a provider again. Render cancellation/interruption cannot commit success. Actual process-kill/queue-loss tests and running render cancellation/graceful interruption passed in the local harness; native concurrency, host-loss and load recovery remain open.

Inspect `docker compose logs --tail=100 api worker render-worker storage`; do not publish credentials, reset links or private content from logs. Missing: OpenTelemetry, latency histograms, central errors/platform-admin dashboards, delivered alerts, object inventory reconciliation and SLOs. General API health is not proof every service or external provider is healthy.
