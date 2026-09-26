# Setup

## Requirements and first run

Use Node.js 24, Docker Desktop/Engine with Compose, Linux containers on Windows, and internet access for packages/images. Video rendering uses CPU and temporary disk; allocate enough memory for the stack, including the render worker's 1.5 GiB container limit.

```bash
npm run setup
docker compose up -d --build
```

Setup creates unique development secrets in `.env` and refuses to overwrite an existing file. For an existing 0.1 or 0.2 installation, use `UPGRADE_0.3.md` instead. Open http://localhost:3000; local development emails are at http://localhost:8025. Only host ports 3000, 4000, 1025 and 8025 are published, all on loopback. PostgreSQL, Redis and MinIO use private Compose networking. The web build proxies to `http://api:4000`.

The stack includes web, API, text worker, render worker, PostgreSQL, Redis, local MinIO storage, Mailpit and a one-time migration service. `migrate` exiting 0 is expected. This is a local development configuration, not a public production deployment. This release's Docker/MinIO stack has not been executed in the build environment.

## Source development on the host

Install FFmpeg/ffprobe with H.264/AAC, drawtext and DejaVu Sans support, in addition to Node. Docker includes these dependencies; host development requires installing them separately. The default font path is `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`; set `RENDER_FONT_PATH` to an appropriate local font if necessary. `FFMPEG_PATH` and `FFPROBE_PATH` can point to your binaries.

```bash
npm ci
npm run setup
docker compose -f compose.yaml -f compose.host.yaml up -d postgres redis mailpit storage
```

In `.env`, change the host `DATABASE_URL` port to **5433** (preserve the password), set `REDIS_URL=redis://localhost:6380`, `S3_ENDPOINT=http://localhost:9000` and `S3_AUTO_CREATE_BUCKET=true`. These are the optional override's host mappings; containers keep using their internal service ports.

```bash
npm run db:generate
npm run db:migrate
npm run dev:api
```

In separate terminals run `npm run dev:web`, `node --env-file=.env dist/apps/api/src/worker.js`, and `node --env-file=.env dist/apps/api/src/render-worker.js`. Rebuild with `npm run build:api` and restart those processes after backend changes. Next.js development reloads frontend changes.

## Providers and storage

Text providers must support compatible `POST /chat/completions`, JSON object output and `max_completion_tokens`. Configure primary URL/key/model, optionally fallback, and current input/output token rates. `AI_DAILY_JOB_LIMIT` defaults to 50 and at most 5 pending text jobs per organization. These are count limits, not dollar budgets.

Compose overrides `S3_ENDPOINT` to its internal MinIO service and enables bucket creation. Existing setup-generated S3 credentials work for the new service. For an external private S3-compatible bucket configure endpoint/region/bucket/credentials (or an operator-managed AWS credential chain); provision appropriate permissions. Auto-creation defaults off outside Compose. Cloud-provider behavior is not live-verified. Do not make the bucket public.

Rendering uploaded media needs no AI key. Generated image/video/voice, social and Stripe adapters are not implemented; providing keys cannot activate them.

## Email and Windows

Compose uses Mailpit. Real email requires SMTP configuration and a verified sender, with links based on `WEB_ORIGIN`; real inbox delivery is not verified here. On Windows run commands in PowerShell from the extracted project folder, with Docker Desktop running. See `TROUBLESHOOTING.md` for logs and port conflicts.
