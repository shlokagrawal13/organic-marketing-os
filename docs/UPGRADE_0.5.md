# Upgrade to 0.5.0

Preserve the current `.env`, Compose project identity, PostgreSQL volume and private media volume. Back up the database and private objects before upgrading. Never use `docker compose down -v`; a source ZIP or Git checkout is not a runtime backup.

Deploy the new source and run the normal migration flow. Migration `202609270001_billing_entitlements` is additive and creates plan, subscription and event-inbox tables plus Free/Starter/Growth configuration records. The original seven migrations are byte-preserved. The local PGlite populated-upgrade/restore exercise passed across all eight migrations; native PostgreSQL/Compose and cross-store restore remain open gates.

Existing installations remain in `BILLING_MODE=self_hosted` unless explicitly changed. Existing workspaces do not receive a subscription automatically. To exercise the signed test-provider lifecycle, configure the API with a random `BILLING_WEBHOOK_SECRET` of at least 32 characters and restart it. Do not reuse `ENCRYPTION_KEY`, database passwords or provider API keys as this secret. The text worker does not need the webhook secret.

This release does not create Stripe products, prices, customers or payments. Do not send real Stripe webhooks to `/api/billing/webhooks/test`; its schema/signature are intentionally provider-neutral test contracts. A future Stripe adapter must map verified provider events into the same idempotent state transitions and be sandbox-tested before commercial use.

The new financial foreign keys continue to restrict workspace deletion. Refund/expiry events append corrections and fail rather than make an available balance negative. Investigate failed inbox records; never edit immutable `CreditEntry` rows or delete migrations to force a retry.
