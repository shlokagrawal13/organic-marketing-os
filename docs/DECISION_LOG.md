# Decisions

## 0.6.0 Stripe contract decisions

- Stripe is disabled by default. Test and live modes require matching key prefixes and event `livemode`; partial configuration fails startup.
- Checkout/Portal sessions are server-created, role-gated and idempotent. Only expected Stripe-hosted redirect domains are returned to the browser.
- Workspace/plan metadata and configured recurring price IDs are authoritative mapping inputs. A subscription must contain exactly one configured product price.
- Entitlements and monthly credits change only through verified webhook processing, never through a Checkout success redirect.
- Local fixture evidence validates the integration contract, not a real Stripe account, card, charge, invoice or sandbox lifecycle.

## 0.5.0 billing foundation decisions

- Keep provider billing events separate from immutable product-credit entries. A processed signed event may append ledger corrections but cannot update or delete financial history.
- Verify the exact raw request body with a dedicated HMAC secret and five-minute timestamp window. Never treat browser redirects or unsigned JSON as entitlement authority.
- Store every provider/event ID with its payload hash. Exact replay is safe; reusing an ID for different content is a conflict. Lock event rows so business effects and processed state commit atomically.
- Order subscription state by provider timestamp with event ID as a deterministic tie-breaker. Paid invoices grant only an ACTIVE/TRIALING plan's database-configured credits; refund/expiry cannot make available balance negative.
- The test provider proves contracts only. Stripe requires official signature/event mapping and a real sandbox lifecycle before commercial claims.

- Retain Next.js, NestJS, Prisma/PostgreSQL, Redis/BullMQ and server-side FFmpeg as requested.
- Use a modular application with a separate worker process. Next.js only serves the frontend and proxies `/api` to NestJS.
- Use high-entropy opaque sessions stored as hashes, HttpOnly cookies, explicit renewal, server-side revocation, and CSRF origin checks.
- Resolve organization membership on every tenant request. Never accept an organization id as proof of access.
- Package as Docker Compose. Sites' Worker runtime cannot host this prescribed multi-process architecture; no substitute SQLite backend or misleading hosted shell will be supplied.
- Keep production provider calls unavailable until configured. Development tests may use explicitly named test fixtures; never populate dashboard metrics with fabricated performance.


## 0.2.0 media decisions

- Ship uploaded-media rendering as the next usable increment; generated visuals and voice remain explicit future adapters.
- Store immutable content snapshots and input references for every render. Keep prior outputs; content changes invalidate approvals and scene cache keys decide what can be reused.
- Use current-session API streaming with byte ranges for private preview/download. Signed public sharing and CDN access are deferred.
- Keep source upload quotas and render-count limits distinct from financial credits. Do not imply that they cover provider charges or all stored output bytes.
- Run FFmpeg in a dedicated worker with local inputs, resource/time bounds, cancellation and validation. Test real media while S3 is emulated locally.
- Remove Postgres/Redis host bindings from the normal Compose stack after Windows port conflicts. Offer explicit alternate ports only in the host-development override.


## 0.3.0 reliability and operations decisions

- Prioritize existing-flow verification and provider-independent health/export while no live API credentials are supplied.
- Freeze new AI request context and treat changed-input request-key reuse as a conflict. Retain legacy data without rewriting previous migrations.
- Fail uncertain interrupted provider calls without automatic replay; preserve the possibility of external charges and do not imply financial refunds.
- Keep accounting persistence outside fallback handling to avoid additional provider spend after a database failure.
- Export tenant records via a private, bounded, paginated snapshot with a completion digest. Keep portability export separate from native database and media restoration.
- Patch production dependencies without downgrading the framework; disclose remaining development emulator advisories.
- Distinguish PGlite/fixture evidence from native/live acceptance. Record runtime permission/tooling limits rather than bypassing them or calling a gate complete.

## 0.4.0 credits and verification decisions

- Preserve the no-product-credit self-hosted default. Credit mode is explicit and requires accepted quotes and an atomic reservation before new AI work.
- Consume a stored quote once for a saved result; release queued cancellation and known no-attempt failures. Keep uncertain provider outcomes in REVIEW for an audited operator decision.
- Separate platform authority from tenant ownership: deployment allowlist plus verified email. Do not let ordinary organization owners grant credits.
- Protect ledger history with append-only operations and SQL triggers. Retention/erasure and payment refunds/expiry are later explicit work; credits are not provider-currency budgets.
- Replace S3rver with checksum-pinned S3Proxy rather than a permissive fake S3 server. Java dependency review is not covered by npm audit. Native MinIO remains a separate gate.
- Invalid generated JSON/schema is a per-job output failure, not a provider outage. Keep service cooldown only for transport/HTTP/envelope failure, excluding caller abort.
