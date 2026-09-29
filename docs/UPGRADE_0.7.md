# Upgrade to 0.7

Version 0.7 adds the tenth migration, `202609290001_model_routing`, which extends `AIUsage` with durable routing, quality, retry, provider-request and unknown-outcome evidence. It is additive and preserves existing usage rows with safe defaults.

1. Back up the native PostgreSQL database and private media using the existing operational process. A source ZIP or workspace export is not a restore backup.
2. Preserve `.env`, the Compose project name and all named volumes. Never use `docker compose down -v` during an upgrade.
3. Review `UPGRADE_0.6.md` and `UPGRADE_0.5.md` when upgrading from an older version.
4. Configure each text provider's verified `AI_*_QUALITY`, `AI_*_CAPABILITIES`, `AI_*_PLANS` and priority. An undeclared model defaults to standard and cannot serve premium strategy/scene routes.
5. Configure both per-million token rates before enabling `AI_MAX_REQUEST_USD` or a plan-specific `AI_MAX_REQUEST_USD_<PLAN>` cap. A capped request with unknown cost is rejected before any provider call.
6. Apply migrations with `npm run db:migrate` (or the deployment's `prisma migrate deploy`) before starting the updated API and worker.
7. Recreate API and text-worker containers together so route configuration and the Redis shared-health contract remain consistent.
8. Verify `/health`, Workspace operations, AI status, one authorized bounded text request and the Credits & usage route evidence. Do not use an unreviewed live request merely as an upgrade probe.

Definitive provider HTTP failures can use an eligible comparable fallback. Transport ambiguity, an invalid successful envelope or schema-invalid output stops without a second potentially billable call and is marked for review. Existing queued jobs remain compatible; product-credit reservation behavior is unchanged.

Rollback deploys the prior application image without deleting the new nullable/defaulted columns. Test the rollback against a disposable restored backup before production use. Native PostgreSQL/Redis and actual Compose acceptance remain open until NATIVE-01 runs successfully.
