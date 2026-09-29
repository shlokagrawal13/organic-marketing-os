# Project status — Policy-aware model routing milestone 0.7.0

## Current state

Account/brand/content/planning, private assets, actual uploaded-media video rendering, workspace health/export, policy-aware text routing, text-job credit accounting, signed billing events, Stripe contract routes and durable billing invoice views are implemented and locally verified. The full supplied V3 platform is **not finished or production-ready**. Missing modules require engineering as well as later live access.

## Implemented

The architecture remains Next.js, NestJS, PostgreSQL/Prisma, Redis/BullMQ, private S3-compatible storage and a separate FFmpeg render worker. Ten additive migrations preserve the nine previous migrations and original master specification.

Existing capabilities include accounts/sessions/email, organizations/six roles/invitations, Brand Brain/Creative DNA versions, drafts/campaigns/calendar/comments/search, human review and approval invalidation, queued compatible text generation with frozen brand context, private uploads and actual MP4/audio/captions/thumbnail rendering, scene caching/cancel/retry, worker recovery and private paginated workspace record export.

The 0.4 ledger retains immutable entries, atomic reservations/settlement and platform credit controls. Version 0.5 added plans, subscriptions and the durable billing inbox. Version 0.6 added official Stripe SDK configuration, hosted Checkout/Portal APIs and UI, strict plan-price mapping, raw Stripe signature verification, subscription/paid-invoice mapping, mode enforcement and redirect-host validation. The latest local increment adds durable `BillingInvoice` records, invoice list/detail APIs, invoice visibility in Credits & usage and explicit refund/dispute/fraud/proration policy. Stripe contracts passed against an isolated fixture; no real Stripe account or payment was used.

Version 0.7 adds task capability, declared quality, workspace-plan and estimated-cost routing; strategy/scene require premium providers. Comparable fallback is allowed only after a definitive rejection. Ambiguous transport, invalid successful responses and schema-invalid output stop without a second potentially billable call. Redis-backed provider health is shared across workers, and route/retry/failure/request-ID metadata is durable and visible in usage history.

## Executed evidence — 2026-09-29

The 0.7 increment passed Prisma generation, **16 unit tests**, API TypeScript production compile, Next.js 16.3.5 production build, populated PGlite upgrade/restore through all ten migrations, and production/full npm audits with zero known advisories. The full verifier attempted to run but stopped before application scenarios because `redis-server` is absent (`spawn redis-server ENOENT`). Redis-backed shared-health integration is compiled but not claimed native-executed here.

2026-09-28 invoice increment checks: Prisma generation, API TypeScript build, direct web TypeScript, unit suite, direct PGlite/Prisma invoice processing and populated upgrade/fresh PGlite restore passed with nine migrations applied. The full local verifier could not rerun in this runtime because `redis-server` is unavailable and local S3Proxy/localhost listeners hit environment restrictions.

Earlier 2026-09-27 evidence: API/Next.js builds, Prisma generation/validation and formatting checks passed. **12 unit, 6 broad HTTP, 5 production-browser and 3 recovery/configuration scenarios passed**, with eight migrations applied. Populated upgrade/fresh PGlite restore preserved existing records and the immutable ledger. Runtime and full npm audits each reported **0 known advisories**. This npm result does not audit the Java S3Proxy dependency tree or certify application security.

The isolated environment used PGlite WASM PostgreSQL, native Redis 6.2, S3Proxy, real FFmpeg/ffprobe, local SMTP capture and HTTP text fixtures. No live AI output, social publication or payment was exercised. See VERIFICATION_REPORT.md and docs/qa for exact scope. The user's Windows installation was not inspected or upgraded remotely.

## Access and open gates

The private `shlokagrawal13/organic-marketing-os` main branch contains the locally verified v0.6.1 invoice/policy increment at application commit `a4e6dfc2df7938b74836ac79ba3d883c1584faf2`. The triggered Actions run `36462190503` still failed at startup before any job; GitHub's annotation says recent account payments have failed or the spending limit needs attention. See `docs/qa/github-publication.json`.

Docker/native PostgreSQL remain unavailable here; native package installation again failed on runtime privilege operations. PGlite serializes DB requests. Native locking/restore, actual Compose/MinIO, cloud storage/mail/TLS, live provider quality/cost, full security/load/accessibility and master acceptance remain open.

Pending implementation includes actual Stripe sandbox/live acceptance and money-moving refund/dispute lifecycle checks; the full agent graph; generated image/video/voice; advanced editing; sourced research/trends/competitors/SEO/community; official OAuth/publishing; external analytics/growth; full platform administration; notifications/telemetry; retention/deletion and broader collaboration UX. TASK_BOARD.md retains all groups and REQUIREMENTS_MATRIX.md all 161 headings.

## Continue

Read START_HERE.md and PROJECT_CHECKPOINT.json. Continue AGENTS-01 locally. MODEL-01 contract implementation is complete; actual live model quality/cost remains AI-LIVE-01 and native Redis/PostgreSQL remains NATIVE-01. Actual Stripe sandbox acceptance needs authorized test configuration.

## v0.5 private source publication — 2026-09-27.1

Published verified source commit `0281511e9113d4bd2470b38529bc30d4f5b14a60` with tree `86454cb7e2aeda0db66f730bdd0b29e93d8aaf38` on private `main`. The remote tree equals the locally tested tree byte-for-byte at Git blob level. Actions run 36305587276 ended `startup_failure` with zero jobs, so no native test result is claimed.

## Private repository publication — 2026-09-26.6

Verified v0.4 source was uploaded to https://github.com/shlokagrawal13/organic-marketing-os, private repository ID 1389748509, branch main, source commit 0093dfaa9fd0864a77f8680e51e7b506ea32f15d. All 150 uploaded paths, Git blob hashes and modes match the local checkpoint; tree beb2d18a44759a3bf4afb8e70ea0717c89d54a20. History starts at the independent README commit 40e552455688260db0c878b162535e41bb39bfb6. The unrelated OrganicMarketing project is excluded.

Native CI was triggered by the source commit: https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/36269190288. GitHub returned completed/startup_failure with an empty job list, so no native tests ran. One retry request returned HTTP 403, "This workflow run cannot be retried." Generic local YAML parsing succeeded, but that does not verify GitHub's workflow validation or explain the startup failure. The specific startup reason is still unknown; do not assume a billing, permission or application defect.

The connector cannot expose the relevant startup diagnostics through its supported endpoints. Browser inspection found GitHub signed out and the private run unavailable; secure sign-in is needed to inspect the detailed run error. Preserve the uploaded source and resume this diagnostic after authenticated access. Fix the concrete reported cause, rerun native tests and record real results. Do not mark native verification complete.

This follow-up changes continuation records only. The last source commit above identifies the verified application import; resolve the latest documentation commit from the main ref or git rev-parse HEAD. Source is now maintained in this Git repository; older ZIP checkpoints may be stale. Local Git objects were reconstructed from remote metadata and verified by their exact SHA, and the uploaded tree was independently compared before setting the local main/upstream refs.
