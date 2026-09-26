# Upgrade to 0.4.0

Preserve the current `.env`, Compose project identity, PostgreSQL volume and private media volume. Back up existing database/media before a schema upgrade. A source ZIP is not that backup. Never use `docker compose down -v` to update.

Replace the source with this checkpoint while retaining private runtime configuration and data. From the existing project directory, use the normal `docker compose up -d --build` flow: the migration service applies the new seventh migration before the API/workers start. The first six SQL migrations are unchanged. The actual Docker/MinIO flow remains an execution gate; the agent verified additive SQL and populated restore on PGlite only.

For a host-development install, run `npm ci`, `npm run db:generate`, `npm run db:migrate` and `npm run build`, then restart API, text worker, render worker and frontend using your existing service setup. `db:migrate` applies to your configured database, so take the backup first. Earlier setup details remain in UPGRADE_0.3.md and SETUP.md.

Existing `.env` files need no billing change: missing `BILLING_MODE` defaults to `self_hosted`. Existing queued jobs have no credit reservation and keep that behavior. To enable product credits intentionally, configure `BILLING_MODE=credits` and matching prices on API/text worker, grant credits through the guarded platform API, and confirm the displayed quote. This does not enable paid subscriptions. Never copy the complete example over an existing `.env`.

The optional isolated test harness now requires Java 17+ and Python 3.9+ in addition to Node/Redis/FFmpeg. Run `python3 scripts/install_test_storage.py` before `npm run verify`. It downloads checksum-pinned S3Proxy into `.local/test-tools`; the jar and transient data are excluded from source archives. Production Compose still uses MinIO and does not require Java/Python.

Ledger rows cannot be edited/deleted through ordinary SQL, and credited organizations cannot be deleted while financial references remain. Future erasure/retention work must respect this boundary. Rolling source back below 0.4 while credit-mode jobs exist is not verified; do not drop tables or rewrite migrations as a rollback method.
