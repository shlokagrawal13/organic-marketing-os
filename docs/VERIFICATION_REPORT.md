# Verification report — Organic Marketing OS 0.8.0

Latest verification update: 2026-09-29. Scope: retain the verified core/media/credit/billing/router foundation and add durable agent orchestration, frozen approved-content retrieval, critique and human gates, without claiming live-model, native Redis or Stripe sandbox acceptance. The full V3 OS is not complete or production-ready. Passing these checks does not prove that no defect remains.

## Result

| Check | Executed result | Evidence |
|---|---|---|
| API build | Pass | `npm run build:api` |
| Next.js production build | Pass | `npm run build:web`, Next.js 16.3.5 |
| Unit suite | 19 tests passed | `npm test` |
| Agent graph contracts | Pass | 18 roles mapped; topological dependencies, frozen context, missing-evidence disclosure and blocked-guarantee critique |
| Router policy contracts | Pass | Plan/capability/quality/cost filtering; comparable fallback; health selection; ambiguous outcome no duplicate call |
| Direct billing invoice verification | Pass | Fresh PGlite/Prisma database, all 9 migrations, subscription + invoice events processed idempotently, one invoice persisted, 100 credits granted |
| Schema deployment | 11 migrations applied to fresh test database | Populated upgrade/restore script |
| Populated upgrade/restore | Pass on PGlite only | `scripts/verify-upgrade.mjs`, `.local/upgrade-restore-evidence.json` |
| Earlier 0.6 full HTTP/browser/recovery evidence | Pass, dated 2026-09-27 | 12 unit, 6 HTTP, 5 production browser, 3 recovery/configuration scenarios with 8 migrations |
| Production dependency scan | 0 known advisories | `docs/qa/dependency-audit-summary.json` |
| Full npm dependency scan | 0 known advisories | S3rver removed; S3Proxy Java dependency tree is outside npm scope |
| Spec/migration integrity | 161 headings mapped; original master and first 8 migrations unchanged | `REQUIREMENTS_MATRIX.md`, `docs/qa/verification-summary.json` |

The full verifier was also attempted. It stopped before application scenarios because the runner has no `redis-server` binary (`spawn redis-server ENOENT`). This is an execution-environment gate, not a passed Redis/shared-health test.

These are scenario counts, not test-coverage percentages. Every one of the 161 master headings remains tracked: 140 Partial and 21 Missing. Partial includes areas with only supporting infrastructure or documentation; these numbers must not be presented as a percentage complete.

## New 0.8 findings and behavior

- Added versioned strategy/content/scene DAGs whose combined catalog maps every specified master agent role. Each node has an explicit responsibility, dependencies, state and output; a role name in a prompt is no longer treated as execution evidence.
- Brand Brain, Creative DNA and up to ten recent approved content examples are captured at queue time. Later edits cannot alter the run's frozen context. Research/community steps explicitly mark external evidence as unavailable.
- Added durable `AIAgentRun` and `AIAgentStep` records, provider usage linkage, stale-worker failure transitions and a tenant-scoped full-trace endpoint/export.
- The one validated provider generation is owned by the task's strategy/script/editor node. Post-generation compliance and orchestrator critique persist findings, and the human gate remains waiting until OWNER/ADMIN/EDITOR approval or rejection.
- Obvious guarantee violations are blocked and cannot be approved. Content-to-draft and scene-application UI actions remain disabled until the agent run is approved.
- The eleventh migration is additive. Populated PGlite upgrade/restore preserved v0.1 records and the immutable ledger through all eleven migrations. Updated HTTP/browser scenarios assert trace and approval, but this runner could not execute them without Redis; no fresh full-system pass is claimed.

## New 0.7 findings and behavior

- Added explicit route policy for task complexity, capabilities, declared quality, active plan, provider priority, shared health and an optional estimated dollar cap. Strategy/scene require premium; ordinary content requires standard.
- A fallback is eligible only when it meets the same capability/quality/plan/cost rules. Definitive HTTP rejection may fall back; transport ambiguity, invalid successful envelopes and schema-invalid output stop after one potentially billable call.
- Added Redis-backed shared health with cooldown, attempts, failures, consecutive failures and rolling latency. Unit tests verify health-based selection using the store contract; actual Redis execution is not claimed because the local binary is missing.
- Added durable retry count, quality tier, failure code, provider request ID, unknown-outcome flag and routing metadata to usage records and surfaced route context in Credits & usage.
- Added subscription-plan-aware worker routing and safe configuration for capabilities, plans, priority, rates and request caps. Unknown cost under a configured cap rejects before `fetch` or accounting callbacks.
- The tenth migration is additive. Populated PGlite upgrade/restore preserved v0.1 content and the immutable ledger through all ten migrations.

## New 0.6 findings and behavior

- Added disabled/test/live Stripe configuration with test/live key and event-mode enforcement. Partial or invalid configuration refuses API startup; loopback API overrides are development-only.
- Added idempotent hosted Checkout and Customer Portal session routes for OWNER/ADMIN, server-owned return URLs, workspace/plan metadata, strict two-price mapping and expected Stripe-host redirect validation.
- Added official raw-body Stripe signature verification and durable mapping for subscription created/updated/deleted plus paid invoices. Events without this product's metadata are ignored; browser redirects never grant access.
- Extended Credits & usage with current plan, configured Checkout choices and Portal access. The local fixture inspected request bodies, idempotency keys, roles, customer binding, duplicate webhook delivery and one-time grants.
- No Stripe account, card, external request or money was used. Before 0.6.1, sandbox renewal/cancel/refund behavior, invoice views, disputes and proration remained open.

## New 0.6.1 findings and behavior

- Added the ninth additive migration with `BillingInvoice`, linked to workspace, subscription and source billing event.
- Extended signed `invoice.paid` payloads with invoice ID, status, currency, amount and invoice URL fields; Stripe invoice webhooks persist those fields when supplied.
- Added tenant-scoped `GET /billing/invoices` and `GET /billing/invoices/:invoiceId` API views plus invoice rows in Credits & usage.
- Added explicit refund, dispute, fraud-warning and proration policy to the billing API/UI. These policies prevent browser redirects or unsigned notices from changing entitlements or credits.
- Direct PGlite/Prisma verification applied all nine migrations, processed subscription/invoice events twice to assert idempotency, stored one invoice and verified the monthly credit grant. This is local contract evidence, not live Stripe sandbox acceptance.
- Full local verification could not rerun in this runtime: the environment lacks `redis-server`, and S3Proxy/localhost listener startup hit operation-permitted restrictions. Native CI is still blocked by the GitHub account payment authorization failure.

## New 0.4 findings and behavior

- Added atomic product-credit reservations, immutable ledger entries, accepted quotes, idempotent consumption/release and platform-only adjustments. Default self-hosted mode preserves previous no-credit behavior.
- Invalid or interrupted provider calls hold reservations for review; SIGKILL recovery verifies no automatic replay and retained credits. Queued cancellation releases credits.
- Fixed a discovered router bug: one task's invalid JSON/schema output no longer puts the provider into cooldown for unrelated jobs. Service failures retain cooldown. Unit regression also checks the pre-request accounting guard prevents a call.
- Corrected an older integration assertion that assumed every tenant job retries a primary already in worker-wide cooldown. Usage history now tests actual calls without requiring a fabricated failure entry.
- The PGlite socket bridge sometimes disconnects after intentional trigger exceptions. Ledger UPDATE/DELETE rejection and restored immutability are verified against direct PGlite SQL; native-mode CI additionally asserts Prisma receives the immutable error. This does not close the native gate.
- Removed S3rver. Checksum-pinned S3Proxy passed signed writes, private/incorrect-signature rejection, ranges, deletes and integrated real media rendering. Added Java setup/download to CI; CI itself has not run remotely.
- Five browser scenarios passed. Credits desktop/mobile evidence was inspected; the test waits for the mobile navigation animation before capturing the page.

## Existing findings retained and workflows rerun

| Finding | Change | Verification |
|---|---|---|
| Same AI request key could hide changed input | Canonical task/input comparison returns 409 on a changed request; exact replay returns the saved job | Concurrent/idempotency HTTP assertions |
| Queued generation could use later brand edits | Capture Brand Brain/Creative DNA and revision at enqueue time | Persisted context assertions; later brand change does not alter job |
| Previously dispatched QUEUED jobs could stay lost after Redis entry loss | Reconcile all queued DB records, including dispatched entries | Kill worker, create a DB job without a queue entry, restart and complete it |
| Interrupted provider calls needed explicit ownership and no-replay handling | Run token, heartbeat, abort signal, deadline and conditional completion; stale RUNNING jobs fail | Kill worker after provider acknowledgment; restart produces failure with exactly one accepted call |
| Usage persistence failure could be mistaken for provider failure and trigger another paid request | Persist accounting outside provider fallback catch | Unit test: accounting throws, provider call count remains one |
| Provider response/resource validation needed bounds | 1 MiB body limit, safe nonnegative token counts, abort suppresses fallback | Oversized/abort unit cases and existing schema/fallback tests |
| Approval/revision edge cases could retain stale state | Check stale revisions before transitions; leaving APPROVED clears approval metadata | Content edit/restore/conflict and media approval tests |
| Known runtime dependency advisories | nodemailer 10.0.10, multer 2.4.0 and deepmerge-ts 8.0.0 overrides, updated lockfile | Builds, actual email/upload routes and production dependency audit |
| No consolidated workspace health or full record export | Role-gated service/job/storage view and bounded paginated private NDJSON export with digest | All-role/tenant checks, 125+ content records, checksum/privacy/rate tests and browser download |
| Operations table overflow on mobile | Use existing bounded horizontal table wrapper | Mobile overflow assertion and visual review |
| Harness could mistake a broken MP4 fixture for an upload regression | Disable interactive stdin for video generation, await process close and probe all generated fixtures before scenarios | Final run passes fixture probing and actual upload/render workflow |
| Standalone tests could accidentally target existing services | Require harness marker; native services need explicit isolated-test opt-in | Harness and checked-in CI configuration |

The earlier fixture failure was a 48-byte MP4 with no `moov` atom. The application correctly rejected it. The root cause of the one incomplete fixture was not established; the new preflight detects it before application tests. The final run generated, probed, uploaded and rendered valid media without retries masking a failure.

## Workflows exercised

Authentication covers registration/login, session renewal/revocation, verification/recovery email capture, password reset and unauthorized requests. Collaboration covers all six role classes, single-use invitation acceptance under concurrent requests, wrong-email/expired invitations, protection against inviting/removing owners or downgrading an existing owner, membership removal and content version restore.

Brand/content checks include revision conflicts, saved snapshots, campaigns, drafts, comments, review/approval, edit invalidation and history. Credit checks use real API calls and persisted records: duplicate/concurrent grants, changed operation input, verified platform/tenant separation, quote acceptance, reservation/cancellation/settlement, insufficient-credit contention and unknown-outcome review. Cached balances match ledger deltas and revision count. These are product units; no payment or live provider invoice was verified.

AI checks use real HTTP requests to an isolated fixture: primary failure, fallback, schema contracts, preserved scene ID, usage records, changed-input idempotency, immutable brand context and missing configuration. They do not assess a live model's output quality or actual spend.

Media checks use the real API, storage adapter and FFmpeg. They include invalid/rightless uploads, valid image/audio/MP4, deduplication, privacy/roles, byte ranges, large frontend uploads, malformed multipart fields and a file over 25 MiB. Actual output has H.264/AAC at portrait 720×1280, landscape 1920×1080 and square 720×720, expected duration, decoded non-silent audio, scene captions, JPEG thumbnail, cache reuse, approvals and private browser playback/download.

Operations checks use real service probes and tenant counts. Export retrieves all pages of implemented workspace records, verifies the final digest/counts, excludes another tenant and authentication/internal keys, denies non-admin access and enforces one export/user/workspace/minute. The maximum 64 MiB and 120-second limits are implemented bounds, not load-tested capacities. Binary media, internal scene caches and account-wide data are excluded; there is no restore/import route.

A separate API with all text-provider settings blank rejects AI generation with 503 and creates no job. The same API accepts manual content and produces/downloads an actual MP4. An insecure production startup is rejected. Users need no AI key for this manual uploaded-media workflow.

## Failure and recovery evidence

The AI fault test kills an actual worker with SIGKILL after the provider fixture acknowledges a request. It then ages the DB heartbeat by two minutes to avoid waiting for the normal 60-second stale threshold. A fresh worker fails the interrupted job and the fixture records no second accepted call. A separate lost QUEUED entry is recovered and completes. This verifies local behavior; it does not reconcile billing at an external provider or simulate native DB/Redis host loss.

Render tests wait for RUNNING and the real Rendering scene stage, cancel and confirm CANCELED/no output/download denial. Another running worker receives SIGTERM, marks the job failed, restarts and completes a new immutable retry; repeated retry request keys return the same new job. A separate unit test verifies termination of an actual child process through an abort signal. Render SIGKILL/host-power-loss orphan cleanup and high-load cancellation are still unverified.

The upgrade exercise starts from the original four SQL migrations and creates a user, membership, saved draft and queued AI job. Applying migrations 5, 6 and 7 preserves that draft exactly. It also creates a credit account/entry, rejects SQL UPDATE/DELETE and verifies the balance, entry and immutable trigger after restore. It captures a PGlite data-directory archive, deletes the original workspace and loads the archive into a fresh PGlite database; saved draft/membership/job records are present. This is not native pg_dump/PITR, Prisma populated-upgrade bookkeeping, private-bucket restoration or application rollback verification.

## Environment and limits

This review ran the shared source in an isolated environment, not inside the user's Windows installation. Services were the production Next.js build, compiled NestJS API/workers, PGlite WASM PostgreSQL over a socket bridge, native Redis 6.2, loopback signed S3Proxy 4.1.1, real FFmpeg/ffprobe 6.1.1, local SMTP capture and isolated compatible-text/Stripe fixtures. Node.js 24 was used. The runtime application has no mock provider fallback.

Native Docker/PostgreSQL tooling was absent. Attempts to install native packages were blocked by runtime privilege restrictions; no native gate is reported as passed. MinIO was not started. PGlite serializes requests, so concurrent HTTP tests exercise application behavior but cannot establish native row-lock/race correctness. CI is configured for PostgreSQL 17/Redis 7 and requires isolated test services, but that workflow has not executed remotely here.

No paid provider request, social publication, external email delivery or payment was made. Captured mail and provider responses are test fixtures. QA media is visibly synthetic. Production and full npm scans each returned zero known advisories on the verification date. They do not audit Java/S3Proxy dependencies or establish application security. No penetration, supply-chain, accessibility or scale certification is implied.

## Master lifecycle and remaining work

| Master stage | Current implementation | Still required |
|---|---|---|
| Understand | Manual Brand Brain/Creative DNA with versions | Research ingestion, retrieval and ongoing learning |
| Research | No live research engine | Sourced research, trends, competitors, SEO/AEO, community intelligence |
| Strategize | Structured text strategy task plus durable 18-role mapped orchestration/critique/human gate | Live model quality and external research evidence |
| Create | Manual/text-fixture content, private uploads, actual uploaded-media MP4 | Generated image/video/voice, localization, advanced editing, word-aligned captions |
| Review | Structural checks, rights acknowledgment and content/render human approval | Semantic/factual/platform policy automation |
| Publish | No social publisher | Official OAuth, scheduling, variants, policy, idempotent publishing/recovery |
| Measure | Internal job/storage/usage records | External analytics, attribution and reliable platform reporting |
| Learn/improve | No full learning loop | Experiments, growth learning and controlled overrides |
| Operate/commercialize | Sessions, roles, queues, private media, workspace health/export, immutable product credits, plans/subscriptions, signed test events, invoice views, explicit billing policy and locally verified Stripe Checkout/Portal/webhook contracts | Actual Stripe sandbox/live acceptance, real refund/dispute/fraud provider evidence, full platform administration, alerts, retention/deletion, native cross-store recovery and deployment assurance |

Next implementation/acceptance steps are in `IMPLEMENTATION_PLAN.md`. Missing functions require code as well as later authorized credentials. The release is a verified local increment, not a claim that the planned platform is finished.
