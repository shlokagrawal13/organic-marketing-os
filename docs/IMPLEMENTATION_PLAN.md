# Continuation plan

Current milestone: **0.6.0**. The core, private rendering, reliability fixes, workspace operations, product-credit accounting, signed billing inbox and Stripe test-mode contracts are locally verified. Full production OS acceptance remains open.

## Completed in this increment

- Audited the master specification and retained all 161 requirement mappings.
- Hardened AI request identity, frozen brand context, queue reconciliation, heartbeat ownership, cancellation and fallback accounting.
- Exercised all six roles, invitation lifecycle, revisions/restores, concurrent request guards, quotas, malicious multipart input and private exports.
- Executed actual worker interruption, running-render cancellation/retry, a no-provider manual render flow and a populated PGlite upgrade/restore.
- Added Workspace health and complete paginated workspace record export, with desktop/dark/mobile browser evidence.
- Removed the S3rver test chain; pinned private SigV4 S3Proxy checks and full/production npm audits pass with zero advisories.
- Added immutable credits, atomic AI quote/reservation/settlement, cancellation release, uncertain-outcome review and restricted platform credit forms; fixed task-output provider-health leakage.
- Added official Stripe SDK configuration, hosted Checkout/Portal routes and UI, strict price mapping, raw signature verification and subscription/paid-invoice mapping against an isolated fixture.

## Next implementation and acceptance work

1. Run native PostgreSQL/Redis CI and the actual Docker/MinIO stack when an executable environment is available. Repeat upgrade, concurrent locking, faults and database plus media backup/restore there. Retain fresh dependency scans; the previous S3rver npm chain is removed. Native/live gates are pending; local fixture success does not close them.
2. Extend the existing asset/render boundary with generated image/video/voice contracts and adapters. Persist provider IDs and provenance, resolve unknown outcomes, add cost reservation/cancellation, and verify contract behavior with isolated fixtures before any authorized live calls. Add word-aligned captions and deliberate scene regeneration.
3. Extend the existing durable product ledger with full capability/plan/credit policy, payment entitlements and provider-currency budgets. Configure authorized text/media providers later for staging quality/rate checks under agreed spend limits. Do not claim fixture outputs establish provider quality or actual charges.
4. Implement an official social OAuth adapter end to end: encrypted token lifecycle, platform variants, scheduling, policy checks, idempotent publication and unknown-outcome recovery. Verify with an authorized test account when available, then extend platforms.
5. Implement sourced research/trends/SEO/AEO, community intelligence, real platform analytics, evidence-backed insights, experiments and controlled learning.
6. Add Stripe invoice views and explicit refund/dispute/proration policy, then exercise the actual authorized sandbox Checkout/renewal/cancel/refund lifecycle and failure retries.
7. Extend operations with platform administration, telemetry/alerts, account export/deletion/retention, media/cache/orphan cleanup and executed cross-store recovery.
8. Execute complete master acceptance, live-provider QA, accessibility/security/load checks and staging deployment verification. Evaluate production readiness only after these pass.

Preserve the requested architecture and old migrations. Update status, matrix, changelog and evidence after every verified increment. No external messages, live publication or paid operations are authorized merely by running local tests.

## Continuity entry point

Use START_HERE.md and PROJECT_CHECKPOINT.json at the project root, then TASK_BOARD.md for stable IDs and ACCESS_REQUIREMENTS.md for exact access. The first local continuation is BILLING-01 invoice/refund/dispute policy; actual Stripe sandbox acceptance waits for authorized test configuration. Native execution can unblock NATIVE-01. Keep recording progress without requiring the user to reconstruct chat history.
