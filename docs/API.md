# API reference

Prefix: `/api`. JSON mutations use `X-Requested-With: MarketingOS`. Session cookie: `mos_session`. API responses never return password hashes/session tokens. Error envelope: `{error:{message,issues?,requestId?}}`. Validation rejects unrecognized mutation fields. Most creates/actions return 201, reads/updates 200, invalid input 400, unauthenticated 401, forbidden role 403, absent/inaccessible resource 404, stale state 409, rate limit 429, unavailable dependency 503.

| Domain | Endpoints |
|---|---|
| Health | GET /health |
| Auth | POST /auth/register, /login, /forgot-password, /reset-password, /verify-email; GET /auth/me; POST /auth/renew, /logout, /logout-all, /request-verification |
| Organizations | GET/POST /organizations; POST /organizations/accept-invitation |
| Workspace | GET/PATCH /workspaces/:organizationId |
| Team | GET /workspaces/:id/team; POST /team/invite; DELETE /team/:userId |
| Activity | GET /workspaces/:id/activity (latest 100) |
| Brand | GET/PUT /workspaces/:id/brand; GET /brand/versions; POST /brand/restore/:revision |
| Content | GET/POST /workspaces/:id/content; GET/PUT /content/:contentId |
| Review | POST /content/:id/review, /approve, /reject, /archive, /comments, /restore/:version |
| Campaigns | GET/POST /workspaces/:id/campaigns |
| AI | GET /workspaces/:id/ai/status, /ai/jobs, /ai/jobs/:jobId/trace; POST /ai/jobs, /ai/jobs/:jobId/cancel, /ai/jobs/:jobId/review |
| Operations (OWNER/ADMIN) | GET /workspaces/:id/operations/status, /operations/export |

Abbreviated paths in a domain retain the shown workspace prefix. Content list accepts `q`, `status`, `skip`, and `take` (1–100) and returns `{items,total}`. SQL full text search indexes title/body/hook. Other collections use documented recent-record limits.

Schemas are authoritative in `packages/core` and each controller. Brand/content mutations include the current `revision`. `factsAndRightsReviewed: true` is required for approval. AI creates include a UUID `requestKey`, task (`strategy`, `content`, `scene`), prompt and a valid scene only for `task=scene` (required for that task). The request key deduplicates within an organization: identical task/input returns the same job; changed task/input returns 409. New jobs capture brand context/revision and up to ten recent approved content examples at creation; later edits do not change that job. Public job data omits internal run tokens and full frozen context, and exposes the captured brand revision plus an agent-run summary.

`GET /ai/jobs/:jobId/trace` returns the tenant-scoped durable graph, step inputs/outputs/dependencies and linked usage. `POST /ai/jobs/:jobId/review` requires OWNER/ADMIN/EDITOR and `{decision:"approve"|"reject",note?}`. Only `AWAITING_REVIEW` runs are reviewable; a compliance-blocked result cannot be approved. This is not yet a comprehensive OpenAPI specification.

## Media API (0.2.0)

All paths below retain `/api/workspaces/:organizationId`. File GETs need the current session and membership; mutations also need `X-Requested-With: MarketingOS`.

| Path | Method | Behavior |
|---|---|---|
| /assets/status | GET | Storage availability, upload limit, render heartbeat |
| /assets | GET | `q`, `kind`, `archived`, `skip`, `take` (1–100); returns items/total |
| /assets | POST | Multipart `file`, `rightsConfirmed=true`, comma-separated `tags`, `rightsNote`; returns asset/deduplicated |
| /assets/:id | PATCH | Rename, tags or `archived` boolean; no file replacement |
| /assets/:id/file | GET | Private original; single byte range, optional `download=1` |
| /renders | GET | Latest 50; optional `contentId` |
| /renders | POST | `contentId`, current `revision`, UUID `requestKey`, optional `options` |
| /renders/:id | GET | Snapshot/status/progress/stage/output metadata and stale flag |
| /renders/:id/cancel | POST | Cancel queued/running job |
| /renders/:id/retry | POST | UUID `requestKey`; creates a new job from failed/canceled snapshot |
| /renders/:id/approve | POST | `reviewed:true`; requires matching approved content revision |
| /renders/:id/file/:kind | GET | `video`, `thumbnail` or `captions`; optional `download=1` |

Writers (OWNER, ADMIN, EDITOR, CREATOR) can mutate assets and queue/cancel/retry renders; approver roles exclude CREATOR. ANALYST and CLIENT have read access. Render options: `aspect` (9:16/16:9/1:1), `resolution` (720/1080 strings), `captions` boolean, `background` hex colour, nullable `musicAssetId`, `musicVolume` 0–0.5, and optional `textPlacement: "inset-v1"` (Extra margins). Omit `textPlacement` for legacy Standard placement; other values are rejected. Placement persists in immutable render options/history and does not change draft text or SRT timing. See VIDEO_PIPELINE.md for the versioned composition boxes. Scene records accept nullable `visualAssetId` and `audioAssetId`. Server schemas remain authoritative.

Uploads above the 25 MiB limit return 413; input validation returns 400. Invalid byte ranges return 416. Workspace render-count/source-storage limits return 400 with a user-facing explanation. See ASSETS.md and VIDEO_PIPELINE.md for bounds and lifecycle.

## Workspace operations (0.3.0)

Both routes require OWNER/ADMIN membership. `/operations/status` returns current database/Redis/private-storage checks, text/render heartbeat freshness, provider/email configuration, tenant job status counts, tracked source/render/cache bytes and explicit missing capabilities. Configuration is not live-provider verification; byte totals exclude thumbnails, SRTs and orphan objects.

`/operations/export` downloads `application/x-ndjson` with private/no-store headers. It reads all pages of the implemented workspace records, including archived content, in a RepeatableRead snapshot. Secrets and internal storage/worker keys are excluded; media has authenticated download paths. The final `complete` line contains counts and SHA-256 of all preceding lines including newlines. A private temporary file is built before headers; limits are 64 MiB, a 120-second transaction and one request/user/workspace/minute (429). Oversized exports fail with 413. There is no import/restore endpoint. See DATA_GOVERNANCE.md for exact coverage/exclusions.

## Credit and billing API (0.6.1)

| Method and path | Authorization and behavior |
|---|---|
| GET /workspaces/:id/credits | OWNER/ADMIN/ANALYST; mode, prices, real available/reserved balances, newest 100 open reservations and explicit payment availability |
| GET /workspaces/:id/credits/entries?before=:sequence | Same roles; descending sequence, 50 records and nextBefore; omits operation keys/request hashes |
| GET /platform/access | Authenticated session; whether verified deployment-allowlisted platform authority is present |
| POST /platform/credits/:organizationId/adjust | Verified platform admin; UUID requestKey, nonzero integer amount within ±1000000, reason 10–1000 characters; idempotent and audited |
| POST /platform/credits/reservations/:id/resolve | Verified platform admin; consumed 0–quote and reason; REVIEW only, terminal identical replay allowed; running/queued/conflicting resolution rejected |
| GET /workspaces/:id/billing | OWNER/ADMIN/ANALYST; current provider, plan, period, entitlements and Checkout/Portal availability; external customer/subscription identifiers omitted |
| GET /workspaces/:id/billing/invoices?before=:periodEnd | OWNER/ADMIN/ANALYST; latest verified invoices, 50 records and nextBefore; scoped to the workspace |
| GET /workspaces/:id/billing/invoices/:invoiceId | OWNER/ADMIN/ANALYST; tenant-scoped invoice detail with source billing event and subscription snapshot |
| POST /workspaces/:id/billing/checkout | OWNER/ADMIN; Starter/Growth planId and UUID requestKey; creates an idempotent Stripe-hosted subscription Checkout session when configured |
| POST /workspaces/:id/billing/portal | OWNER/ADMIN; UUID requestKey; creates an idempotent Stripe Portal session for the workspace's bound Stripe customer |
| POST /billing/webhooks/test | No session; exact raw-body HMAC, timestamp within five minutes and strict event schema required; exact replay idempotent, changed payload conflict rejected |
| POST /billing/webhooks/stripe | No session; official Stripe raw-body signature required; test/live mode must match configuration; recognized subscription and paid-invoice events enter the same durable inbox |

AI status includes prices/balances. A new job in credit mode also requires integer maxCredits at least the current quote; rejected credit requests create no job. Same task/input/requestKey replays the original job without a new reservation even after a price change. The credit balance is not a provider-currency balance. Supported provider-neutral test events cover subscription upsert/cancel, paid-invoice monthly grant, refund and expiry. Stripe mapping covers created/updated/deleted subscriptions and paid invoices; paid invoices persist invoice metadata when supplied. Unrelated account events are acknowledged without granting access. See BILLING.md for signature details, event ordering, invoice fields and remaining commercial features.


## Generated media (0.9)

All routes below are under `/api/workspaces/:organizationId/media-generations`
and require current tenant membership. Writes require OWNER/ADMIN/EDITOR/CREATOR.

| Method/path | Behavior |
| --- | --- |
| GET `/status` | Configured presets, explicit operator estimates, credit mode, worker/storage availability |
| GET `/` | Tenant history, take 1–100 / nonnegative skip; private pointers and worker tokens excluded |
| POST `/` | Strict requestKey UUID, request, maxCredits; rights/estimate validation, transactionally reserved credits and idempotent durable job |
| GET `/:id` | Saved state, receipt IDs, asset link, cancellation and cost uncertainty |
| POST `/:id/cancel` | Release before submission; otherwise record request without inventing provider cancellation/refund |
| POST `/:id/attach` | Saved target/revision only; preserve other components, invalidate approval and save version; stale targets return 409 |

See GENERATED_MEDIA.md for exact provider presets, recovery and live-verification limits.
