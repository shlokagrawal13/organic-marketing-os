# Verification report — Organic Marketing OS 0.4.0

Release verification: 2026-09-26. Scope: review and repair the existing core/media milestone, exercise it without user API keys, and add product-credit accounting and replace the vulnerable test-storage dependency. The full V3 OS is not complete or production-ready. Passing these scenarios does not prove that no defect remains.

## Result

| Check | Executed result | Evidence |
|---|---|---|
| API/frontend builds | Pass | TypeScript/Prisma generation and built Next.js application |
| Unit suite | 12 passed | `tests/ai.test.ts`, `security.test.ts`, `media.test.ts` |
| HTTP suite | 5 broad scenarios passed | `tests/integration/` |
| Production browser suite | 5 scenarios passed | `tests/ui/`, `docs/qa/` screenshots and MP4 |
| Configuration/fault suite | 3 scenarios passed | `tests/recovery/` |
| Schema deployment | 7 migrations applied to fresh test database | Harness migration deployment |
| Populated upgrade/restore | Pass on PGlite only | `scripts/verify-upgrade.mjs`, `docs/qa/upgrade-restore-evidence.json` |
| Production dependency scan | 0 known advisories | `docs/qa/dependency-audit-summary.json` |
| Full npm dependency scan | 0 known advisories | S3rver removed; S3Proxy Java dependency tree is outside npm scope |
| Spec/migration integrity | 161 headings mapped; original master and first 6 migrations unchanged | `REQUIREMENTS_MATRIX.md`, `docs/qa/verification-summary.json` |

These are scenario counts, not test-coverage percentages. Every one of the 161 master headings remains tracked: 137 Partial and 24 Missing. Partial includes areas with only supporting infrastructure or documentation; these numbers must not be presented as a percentage complete.

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

This review ran the shared source in an isolated environment, not inside the user's Windows installation. Services were the production Next.js build, compiled NestJS API/workers, PGlite WASM PostgreSQL over a socket bridge, native Redis 6.2, loopback signed S3Proxy 4.1.1, real FFmpeg/ffprobe 6.1.1, local SMTP capture and isolated compatible-text fixtures. Node.js 24 was used. The runtime application has no mock provider fallback.

Native Docker/PostgreSQL tooling was absent. Attempts to install native packages were blocked by runtime privilege restrictions; no native gate is reported as passed. MinIO was not started. PGlite serializes requests, so concurrent HTTP tests exercise application behavior but cannot establish native row-lock/race correctness. CI is configured for PostgreSQL 17/Redis 7 and requires isolated test services, but that workflow has not executed remotely here.

No paid provider request, social publication, external email delivery or payment was made. Captured mail and provider responses are test fixtures. QA media is visibly synthetic. Production and full npm scans each returned zero known advisories on the verification date. They do not audit Java/S3Proxy dependencies or establish application security. No penetration, supply-chain, accessibility or scale certification is implied.

## Master lifecycle and remaining work

| Master stage | Current implementation | Still required |
|---|---|---|
| Understand | Manual Brand Brain/Creative DNA with versions | Research ingestion, retrieval and ongoing learning |
| Research | No live research engine | Sourced research, trends, competitors, SEO/AEO, community intelligence |
| Strategize | Structured text strategy task, fixture verified | Live quality tests and full 18-agent orchestration |
| Create | Manual/text-fixture content, private uploads, actual uploaded-media MP4 | Generated image/video/voice, localization, advanced editing, word-aligned captions |
| Review | Structural checks, rights acknowledgment and content/render human approval | Semantic/factual/platform policy automation |
| Publish | No social publisher | Official OAuth, scheduling, variants, policy, idempotent publishing/recovery |
| Measure | Internal job/storage/usage records | External analytics, attribution and reliable platform reporting |
| Learn/improve | No full learning loop | Experiments, growth learning and controlled overrides |
| Operate/commercialize | Sessions, roles, queues, private media, workspace health/export, immutable product credits and restricted credit administration | Stripe/plans/monthly grants/refunds/expiry, full platform administration, alerts, retention/deletion, native cross-store recovery and deployment assurance |

Next implementation/acceptance steps are in `IMPLEMENTATION_PLAN.md`. Missing functions require code as well as later authorized credentials. The release is a verified local increment, not a claim that the planned platform is finished.
