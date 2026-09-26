# Architecture

A modular application with separate text and render worker processes. Browser → Next.js UI/proxy → NestJS API → Prisma/PostgreSQL. Redis/BullMQ schedules work; a private S3-compatible store holds media bytes. Next.js owns frontend code, not application domain APIs.

Text jobs persist an outbox record before dispatch. New requests capture tenant Brand Brain/Creative DNA and revision. The worker claims a run token, maintains a heartbeat, invokes ModelRouter with an abort signal and conditionally stores validated output/usage/audit events. All QUEUED records are reconciled against BullMQ, even if previously dispatched. Stale RUNNING requests fail instead of replaying a possibly paid call. Legacy queued jobs without captured context use the current brand. Browser polling reads tenant-scoped state.

Media uploads are validated/probed before private storage and metadata persistence. Render jobs store immutable content revisions/options and referenced assets. The dedicated renderer downloads/hash-checks inputs, reuses matching tenant scene segments, executes FFmpeg with bounded local-file inputs, verifies output and saves MP4/thumbnail/SRT objects. API file endpoints authenticate current membership on every request and support byte ranges; the bucket stays private.

## Code boundaries

`apps/web` contains UI and `/api` rewrites to NestJS. Its request-body buffer is set to 27 MiB to carry a 25 MiB upload plus multipart metadata. `apps/api/src/common.ts` owns database/guards/errors/limits. Domain controllers include auth, organizations, brand, content, AI, assets, renders and operations. `worker.ts` and `render-worker.ts` are separate processes. `packages/core` holds schemas, router, storage adapter, media validation and rendering.

Organization is the tenancy/workspace boundary; nested workspaces are absent. Membership and roles are checked per tenant request, then resource lookups are scoped to that organization. IDs never establish access. Media credentials and object keys remain server-side.

## Deployment and remaining modules

Local Compose uses PostgreSQL, Redis, MinIO and Mailpit; only web/API/development-mail ports are exposed on localhost. The prescribed multi-process stack does not fit Sites' Worker runtime, so delivery is portable Docker source. No hosted instance has been deployed.

Generated media/voice providers, social adapters, Stripe, CDN/signed sharing, full telemetry, retention and complete recovery remain future modules. Six additive migrations preserve the existing core schema; full native deployment and restore are pending gates.

## Workspace operations

The OWNER/ADMIN operations controller uses the same tenant guards. Health aggregates actual dependency checks, heartbeat timestamps, job groups and database-tracked storage. Export pages through implemented tenant record tables under RepeatableRead, removes credentials/internal keys, writes a bounded private NDJSON file with a digest footer and streams it after completion. This is a portability export with private media references, not a database restore format. See DATA_GOVERNANCE.md.
