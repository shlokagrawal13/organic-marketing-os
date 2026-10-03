# Changelog

## 0.9.2 MEDIA-01D single-image editing — 2026-10-03

- Added an opt-in, separately priced single-image edit preset and asset-library reference picker. The worker verifies tenant ownership and private image bytes before multipart provider submission.
- Added isolated HTTP/unit coverage for edit quotes, source integrity, multipart bytes and end-to-end asset ingestion. Full local verifier passed; live provider acceptance and remote CI for this slice remain pending.
- Added bounded image size, quality and background selection plus built-in voice, WAV/MP3 and speed selection. Requests and audits freeze the normalized preset; provider adapters and the status/UI contracts use the same catalog.
- Passed API and clean Next.js production builds, 31 unit tests, 7 HTTP scenarios, 6 browser scenarios, 5 recovery/configuration scenarios and all 12 migrations after the option expansion.

## 0.9.2 MEDIA-01D retained output reconciliation — 2026-10-02

- Retained provider bytes written to private storage when the worker loses its database claim before ingestion, moving the generation to UNKNOWN with a private output pointer for platform review.
- Kept linked credit reservations in REVIEW and added `media_generation.output_reconciliation_needed` audit evidence without exposing private object keys through public/export responses.
- Added recovery coverage for retained private output reconciliation.
- Verified `npm run build:api`, `npm test` and full `npm run verify`: 7 HTTP scenarios, 6 browser scenarios and 5 recovery/configuration scenarios passed after the sandboxed S3Proxy attempt was rerun with local service permission.
- The earlier public account-side Actions gate was cleared; public run `37049004398` for `b2ac0ee74247ad8b9478bf82516161ea4211e69f` passed before this slice. This slice still needs publish and remote CI evidence.

## 0.9.2 MEDIA-01D credit reconciliation guard — 2026-10-02

- Blocked platform credit review resolution for reservations linked to active media generations until the media job is terminal.
- Added integration coverage for a REVIEW media reservation that returns 409 while PENDING and can be released after UNKNOWN.
- Published to public `main` as source commit `b48b40b92b20bdd1f2aa1d3287ebfe70586b773a`; remote tree `e641e612e9fb6966a9e9a0fc2e5236bc43d62ee8` matched 182/182 local blob paths/modes/SHAs. The push-created Actions run still stopped at an account-side startup gate.
- Verified `npm test` and `npm run build:api`; full local harness still stops before integration because S3Proxy exits with `Operation not permitted`.

## 0.9.1 MEDIA-01D plan/source gates — 2026-10-02

- Added per-kind generated-media plan allowlists through `MEDIA_IMAGE_PLANS`, `MEDIA_VIDEO_PLANS` and `MEDIA_VOICE_PLANS`; status/create now resolve the workspace plan before exposing or queueing configured models.
- Added source-reference ownership gates: source asset IDs must be unique active image assets in the same workspace before the current provider preset rejects unsupported source-byte editing.
- Updated provider config/audit records to freeze allowed plans and source asset counts.
- Published to private `main` as source commit `0b9dce36c95027723ea0529e734316b2af039131`; remote tree `c1918f5b14059606dc39b239d5f7ffc7b854b061` matched 182/182 local blob paths/modes/SHAs. GitHub Actions run `37005496060` still failed before jobs.
- Verified `npm test` and `npm run build:api`; full local harness was attempted but S3Proxy exited before readiness with `Operation not permitted`, so no new integration/browser pass is claimed.

## 0.9.0 verified private source publication — 2026-10-02

- Published the exact verified v0.9 source to private `shlokagrawal13/organic-marketing-os` main as application commit `b47c34fd9fd1fe9b24beea96aacb41a9a9dedf7b`.
- Verified remote tree `a85c8a0384083167121e6fa34f46d9ac837fba8c` recursively against local source: 182 blob paths, modes and SHAs matched with zero mismatches.
- Recorded GitHub Actions run `37002434700` as `startup_failure` before any job; no native CI pass, live provider acceptance or billing fix is claimed.
- Resolved the earlier automatic approval-review upload gate with explicit user approval for this private payload and destination; the unrelated `OrganicMarketing` repository remains excluded.

## 0.9.0 — 2026-10-01

- Added twelfth migration and tenant-scoped durable generated-media API/worker for OpenAI image, voice and asynchronous video contracts.
- Added operator estimates, accepted fixed credit reservations, queued-cancel release and uncertain-outcome review without automatic paid replay.
- Added bounded private ingestion, media validation/provenance, saved receipt/output recovery and revision-checked scene attachment with approval invalidation.
- Added Asset library generation UI, previews/downloads/history, media worker health and sanitized record export.
- Passed 28 unit, 7 HTTP, 6 browser and 4 recovery/configuration scenarios, production builds and 12-migration populated PGlite upgrade/restore. No live provider call or real payment.
- Extended media providers/references/reconciliation and native/live acceptance remain open. GitHub upload was rejected by automatic approval review for missing explicit source-export authorization; v0.9 remains local.

## 0.8.1 — 2026-09-29

- Recovered and verified the latest private source checkpoint. Added an unprivileged checksum-pinned Redis test installer and explicit harness startup diagnostics.
- Named billing/credit tables for assistive technology and scoped the credit-history browser assertion to its ledger table.
- Added MEDIA-01A generated image/video/voice lifecycle contracts and six tests for duplicate submission, ambiguous acceptance, costs, cancel races, polling and targeted rights/tenant input. Runtime integration remains MEDIA-01B/C.
- Fresh checks: 25 unit, 6 HTTP, 5 browser and 3 recovery/configuration scenarios pass; API/web builds, 11 migrations, populated PGlite upgrade/restore and both npm audits pass with zero advisories. Native PostgreSQL/Compose, live providers and master acceptance remain open.

## 0.8.0 — 2026-09-29

- Added a versioned task-specific orchestration graph with explicit contracts covering all 18 master agent roles; roles are executable durable steps rather than names embedded in a prompt.
- Added frozen retrieval of Brand Brain, Creative DNA and up to ten recent approved content examples at queue time. Research/community steps disclose absent external evidence instead of inventing it.
- Added `AIAgentRun`/`AIAgentStep` persistence, dependency/state/output traceability, provider-usage linkage, stale-worker failure handling and tenant-scoped trace export.
- Added post-generation compliance/orchestrator critique and a role-gated human approve/reject endpoint. Obvious blocked guarantees cannot be approved; generated results cannot enter the draft/scene workflow until approved.
- Updated the creation UI with graph state, findings, review controls and downloadable traces.
- Passed 19 unit tests, Prisma generation, API and Next.js production builds, populated PGlite upgrade/restore through 11 migrations, and production/full npm audits with zero advisories. Fresh full HTTP/browser/recovery execution remains blocked because this runner has no `redis-server`.

## 0.7.0 — 2026-09-29

- Added task capability, declared quality, plan, provider priority, shared Redis health and request-cost policy to the centralized text model router.
- Strategy and scene work require premium providers; fallbacks are prefiltered for comparable capabilities/quality and recorded explicitly. Unknown transport or invalid/charged output outcomes stop without a second potentially billable call.
- Added durable route evidence to `AIUsage`: retry count, quality tier, failure code, provider request ID, unknown-outcome flag and routing metadata. Credits & usage now exposes route/result context.
- Added a tenth additive migration, safe environment configuration, subscription-plan-aware worker routing and configurable per-request dollar caps that reject unknown costs before a call.
- Passed 16 unit tests, Prisma generation, API and Next.js production builds, populated PGlite upgrade/restore through 10 migrations, and production/full npm audits with zero advisories. Full verifier remains blocked because this runner has no `redis-server`.

## 0.6.1 — 2026-09-28

- Added durable `BillingInvoice` persistence, a ninth additive migration, tenant-scoped invoice list/detail API routes and invoice rows in Credits & usage.
- Extended signed `invoice.paid` events with invoice ID, status, currency, paid/due amounts and provider invoice/PDF URLs; Stripe paid invoices map those fields when supplied.
- Added explicit refund, dispute, fraud-warning and proration policy to the billing summary and UI without claiming real money movement.
- Verified Prisma generation, API TypeScript build, direct web TypeScript, unit tests, direct PGlite invoice processing and populated upgrade/restore through all nine migrations.
- Full local verification could not rerun in the current runtime because `redis-server` is unavailable and S3Proxy/localhost listeners hit environment limits. GitHub Actions remained blocked by a private account-side startup gate at that time.

## 0.6.0 — 2026-09-27

- Added official Stripe SDK test/live configuration, hosted Checkout and Customer Portal routes with idempotency keys, strict Starter/Growth price mapping and server-owned return URLs.
- Added raw Stripe signature verification, event-mode enforcement and durable mapping for subscription created/updated/deleted and paid invoices; browser redirects cannot grant access.
- Added current-plan/Checkout/Portal controls to Credits & usage and verified roles, request payloads, metadata, customer binding, replay and one-time grants against an isolated Stripe-compatible fixture.
- Added no migration. Actual Stripe sandbox/live acceptance remained open; invoice views and explicit billing policy were added in 0.6.1.

## 0.5.0 — 2026-09-27

- Added database-backed plans, entitlements, subscriptions and a durable billing-event inbox in an eighth additive migration; preserved the original seven migrations.
- Added raw-body HMAC/timestamp verification, exact event replay, changed-payload conflict rejection and deterministic out-of-order subscription protection for the isolated test billing provider.
- Added signed one-time monthly plan grants plus refund/expiry ledger corrections without rewriting immutable credit rows or allowing negative balances.
- Added tenant billing summary, strict role/cross-tenant checks, upgrade documentation and a sixth broad HTTP scenario. Stripe Checkout/Portal/invoices and real sandbox verification remain open.
- Passed builds, 12 unit, 6 HTTP, 5 browser, 3 recovery/configuration scenarios, all eight migrations, PGlite populated restore and both npm audits with zero known advisories.

## 0.4.0 verified private source publication — 2026-09-26.6

- Uploaded all 150 checkpoint files to the user-supplied private repository with independent history and matched every Git blob hash/mode.
- Recorded Actions startup_failure before any job; retry rejected. Native verification remains open pending the detailed startup diagnostic.
- Updated continuation records only; no application/migration changes or new application-test results.

## 0.4.0 private repository initialization — 2026-09-26.5

- Verified the NEW user-supplied private organic-marketing-os repository and write access. Preparing independent source history and native CI; results remain pending until remotely verified.

## 0.4.0 repository target correction — 2026-09-26.4

- Recorded the user's correction: OrganicMarketing is a different project; use a NEW private repository.
- Removed the unrelated repository from the active target and abandoned the prepared commit with its unrelated ancestry. Await the new URL; no source upload/native CI is claimed.
- Updated continuation records only; no application or migration changes.

## 0.4.0 GitHub preparation — 2026-09-26.3

- Located the existing public OrganicMarketing repository, documented its different legacy architecture and prepared an isolated v0.4 review commit.
- Created only a remote branch at the legacy commit. Automatic approval review blocked public source disclosure; v0.4 upload/PR/native CI remain pending authorization.

## 0.4.0 — 2026-09-26

- Added additive immutable credit ledger, atomic text-job quotes/reservations/settlement, queued cancellation release and uncertain-provider review.
- Added verified allowlisted platform credit authority, audited idempotent adjustments/review and real Credits & usage UI/export records. Self-hosted mode remains the default; paid plans/Stripe remain missing.
- Removed S3rver; use checksum-pinned private SigV4 S3Proxy for verification. Production/full npm audits each report zero known advisories; Java audit is outside that result.
- Fixed invalid task-output failures disabling unrelated provider requests; retained service-outage cooldown and no-extra-call accounting guards.
- Passed 12 unit, 5 HTTP, 5 production-browser and 3 recovery/configuration scenarios, seven migrations and populated PGlite restore including ledger immutability.
- Updated portable checkpoint, remaining tasks, GitHub access facts, upgrade instructions and sanitized evidence. Native Docker/PostgreSQL, live providers, paid billing and full master acceptance remain open.

## 0.3.0 handoff update — 2026-09-20

- Added portable start/resume instructions, structured checkpoint, stable remaining-task IDs, access requirements and session log.
- Added an offline source snapshot packer with SHA-256 inventory checking and secret/runtime-data exclusions.
- Made checkpoint updates part of AGENTS.md so future sessions preserve decisions, evidence, blockers and the exact next task.
- Clarified the actual unconfigured OpenAI-compatible text adapter and corrected outdated provider-catalog verification counts.
- Application runtime/dependencies/migrations remain 0.3.0; this update does not claim additional native/live or product acceptance.

## 0.3.0 — 2026-09-20

- Fixed AI request-key collisions with changed input; validate scene requests and freeze new job brand context/revision.
- Reconcile all queued text records after Redis entry loss; heartbeat/ownership/deadline handling prevents obsolete completion. Interrupted provider calls fail without automatic replay.
- Prevent usage-persistence errors from triggering paid fallback; bound provider response size and token counts; abort suppresses fallback.
- Correct content approval clearing and stale revision checks; improve render scene-stage reporting.
- Patch runtime nodemailer/multer/deepmerge-ts dependencies: production audit 0 known advisories; retain disclosure of 4 development S3rver-chain advisories.
- Add OWNER/ADMIN Workspace health with actual service/job/storage information and private paginated NDJSON record export, bounded generation and completion digest.
- Add all-role, collaboration, export, malicious multipart, no-key and worker-interruption verification; guard integration/fault tests against accidental existing-service execution.
- Pass 11 unit, 4 HTTP, 4 production-browser and 3 recovery/configuration scenarios; apply six migrations and execute populated PGlite upgrade/fresh-database restore.
- Fix mobile operations-table overflow and validate generated test fixtures before upload tests. Add evidence, remaining-gate report and upgrade instructions.

Native PostgreSQL/Redis CI and Docker/MinIO execution, cloud/live providers, native database plus media restore and full product acceptance remain unverified. Missing master modules still require implementation.

## 0.2.0 — 2026-09-19

- Added private S3-compatible uploads with format/probe validation, rights acknowledgment, tenant deduplication, tags/search/preview/download and archive/restore.
- Added scene visual/narration attachments and actual FFmpeg rendering with private MP4/JPEG/SRT outputs, three aspect ratios, 720/1080 options and uploaded background music.
- Added immutable render jobs, dedicated worker, progress/cancel/retry, heartbeat/reconciliation, reusable scene cache and exact-revision approval invalidation.
- Added Asset library and Video studio, mobile/light/dark styling, playback and download workflows.
- Added an additive fifth migration, local MinIO/render-worker services and optional host-development Compose mappings. Removed default Postgres/Redis host ports to avoid the user's Windows conflicts.
- Increased the frontend proxy body buffer to carry the API's 25 MiB uploads; verified an upload above 10 MiB.
- Passed 8 unit tests, 2 HTTP scenarios and 3 browser scenarios on the production web build, including actual MP4/audio and landscape/square rendering. Added QA evidence and Windows upgrade instructions.

Local verification uses PGlite, Redis, S3rver and real FFmpeg. Native Docker/MinIO, live providers, populated native upgrades and restore are still pending; full OS completion is not claimed.

## 0.1.0 — 2026-09-19

- Established the specified Next.js/NestJS/PostgreSQL/Prisma/Redis architecture and four migrations.
- Added accounts, session security, tenancy/RBAC, email tokens and team invitations.
- Added persistent Brand Brain/Creative DNA, revision checks and restore.
- Added drafts, campaigns, structural checks, human review/approval, edit invalidation, comments, versions, archive and editorial calendar planning.
- Added queued text generation, a compatible primary/fallback router, output validation, cancellation and provider usage records.
- Added strategy/script/scene UI, internal reports and explicit unavailable states for missing capabilities.
- Added responsive light/dark styling, unsaved-edit protection, setup, deployment definitions, tests and requirements mapping.
- Fixed parser output typing, same-view navigation and a screen-reader table label escaping the mobile scroll container during QA.
- Verified the browser workflows against the built production web server; included desktop/mobile test screenshots.

Real-provider validation, native CI/Docker and the remaining master-spec modules are pending. This release is not production-ready.
