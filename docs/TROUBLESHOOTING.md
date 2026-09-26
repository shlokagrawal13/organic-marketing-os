# Troubleshooting

- **Docker unavailable:** start Docker Desktop in Linux-container mode. The build environment itself had no Docker.
- **POSTGRES_PASSWORD/S3_SECRET_KEY missing:** for a new install run `npm run setup`; for an upgrade preserve the original `.env`. Do not change an existing database password to match a fresh file.
- **Windows ports 5432/6379 already allocated:** v0.2 and later remove both host mappings in normal Compose. Check that you replaced `compose.yaml` and are running in the correct folder. Host source development uses the optional override on 5433/6380.
- **Only Mailpit appears running:** `docker compose ps -a`, then `docker compose logs --tail=80 migrate postgres api web`. Resolve the first startup error; do not delete volumes.
- **Migration container exited:** exit 0 is expected. Other exits require reviewing its logs. Run checked-in migrations; never rewrite old ones to silence a failure.
- **API unreachable:** inspect API health, the web image's build-time API_INTERNAL_URL, port conflicts and WEB_ORIGIN. Rebuild web after changing its proxy target.
- **403 mutation / 409 save:** verify role/header/origin or reload the newer revision. Do not bypass guards or optimistic checks.
- **No reset email:** local mail is http://localhost:8025; real delivery requires SMTP/sender configuration.
- **Text generation disabled/stuck:** configure URL/key/model; inspect worker heartbeat/Redis and provider compatibility. An invalid schema is rejected, not saved as successful content. Check provider usage before retrying costly work.
- **Storage unavailable:** inspect `docker compose logs --tail=80 storage api`; verify the private endpoint, bucket and matching credentials. Local Compose creates the bucket when needed; external production storage should be provisioned explicitly.
- **Upload rejected:** use actual JPEG/PNG/WebP/H.264 MP4/MP3/WAV, at most 25 MiB and 180 seconds for audio/video; confirm rights. A renamed extension is insufficient. Archived originals still count against the 2 GiB source quota.
- **Large uploads fail only through a reverse proxy:** the app's Next.js buffer is 27 MiB; configure external ingress accordingly. The API still enforces 25 MiB for the file.
- **Rendering paused / stuck queued:** start `render-worker`, confirm storage/Redis, inspect `docker compose logs --tail=80 render-worker`. The text `worker` service does not render videos.
- **Render failed:** read its recorded error. Use 1–12 scenes, total at most 180 seconds, Cut/Fade transitions, short on-screen/caption text and valid active attachments. On host development install FFmpeg/ffprobe and the configured font. Retry creates a new snapshot job; it does not overwrite the old output.
- **No spoken voice:** voiceover is script text, not TTS. Attach uploaded narration. Video-source sound is muted; background music is a separate uploaded audio selection.
- **Cannot approve render:** approve its matching content revision first and confirm video review. Changed content needs a new render; old approval is invalidated.
- **Calendar empty / no social or Stripe:** save an editorial date for calendar planning. Publishing, billing and AI-generated image/video/voice remain unimplemented.
- **PGlite prepared-statement conflicts:** use the verification harness's test URL/pgbouncer option; native PostgreSQL does not need this workaround.

- **AI request returns 409:** a request key was reused with changed task/input. Keep the original request for retries; use a new key for deliberate new generation. Later brand edits do not change a queued job's stored context.
- **AI interrupted after a worker restart:** the call may already have reached the provider. It is marked failed without automatic regeneration; inspect provider records before a deliberate new request. No credit refund or no-charge guarantee is implied.
- **No API keys yet:** manual brand/content work, uploads and FFmpeg renders remain usable. AI generation returns an explicit unavailable error and does not create a paid job. This path was tested with provider configuration blank.
- **Workspace health missing:** it is available only to OWNER/ADMIN. Its configured-provider label is not a successful live request.
- **Export 429 / too large:** wait one minute between requests for the same user/workspace. The record export has a 64 MiB limit; larger workspaces require a separately prepared offline export. Media bytes are downloaded separately and the NDJSON file cannot restore the database.
- **Standalone integration tests refuse startup:** use the isolated verification harness in TEST_STRATEGY.md; do not disable its guard or target existing workspace services.

Never use `docker compose down -v` as a troubleshooting shortcut: it removes named volumes containing your data.
