# Upgrade to 0.9.0

This source release adds generated-media jobs, private ingestion and UI. It has
local fixture evidence; live AI providers and native Compose are not certified.

1. Back up the existing PostgreSQL database and private media store together;
   verify the backup using your deployment procedure. The source ZIP is not a
   database or media backup.
2. Keep the existing `.env`, credentials and named Docker volumes. Apply the new
   source to the existing project, without replacing populated volumes.
3. Review `.env.example` and `docs/GENERATED_MEDIA.md`. Generation stays disabled
   until an administrator explicitly enables a compatible model, key and prices.
4. With the existing Compose setup, run `docker compose build` and
   `docker compose up -d`. The migrate service applies the additive twelfth
   migration before API/workers start. The new `media-worker` service needs the
   same database, Redis and private-store configuration as the API/render worker.
   Do not run `docker compose down -v`.
5. For a host-managed deployment, run `npm ci`, `npm run build`,
   `npm run db:migrate`, and restart API/web/text/render workers plus
   `npm run start:media` under the existing process supervisor.
6. Check Workspace health. Existing manual drafting/uploads/rendering work with
   generation disabled. When enabled, Asset library → Generate with AI shows
   configured presets, estimated provider cost, rights consent and saved history.
7. Perform live acceptance only with authorized provider access and approved
   spending. Verify output quality, provider billing and private delivery before
   treating the feature as production-ready.

Jobs at an uncertain paid boundary remain UNKNOWN and reserved credits remain
under review. Never reset such jobs to QUEUED as a recovery shortcut. Preserve
provider receipts and reconcile evidence first. See `GENERATED_MEDIA.md`.
