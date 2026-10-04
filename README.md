# Organic Marketing OS — 0.9.2

### Latest local editor increment

EDITOR-01D adds image-only Static / Slow zoom in with an 8% limit, preserved Fit/Fill and fixed overlays. Passed 35 unit, 7 HTTP, 6 browser and 5 recovery scenarios, API/web builds and populated upgrade/restore. Publication pending; published EDITOR-01C CI remains historical evidence.

A working account, brand, content, media, workspace-operations and AI-credit milestone of the supplied AI Marketing OS V3 specification. **The full product is not finished or production-ready.** See `docs/PROJECT_STATUS.md` and the 161-row `docs/REQUIREMENTS_MATRIX.md` for the exact state.

Continuing in a new chat/account or coding agent? Begin with **`START_HERE.md`**. The source includes a current checkpoint, stable task IDs, verification evidence, access requirements and a one-message resume prompt. Generate/verify portable source checkpoints with `scripts/package_handoff.py` (optional Python 3 utility; no new application dependency).

## Upgrading an existing installation

Follow **`docs/UPGRADE_0.9.md`** and the referenced earlier upgrade notes. Preserve your existing `.env` and Docker volumes; do not run `docker compose down -v`.

## First installation

Install Node.js 24 and Docker Desktop with Compose. From this directory:

```bash
npm run setup
docker compose up -d --build
```

Open http://localhost:3000 and create your own account. Development verification/reset/invitation emails appear at http://localhost:8025. No demo account or performance data is seeded. The first image build needs internet access. Docker/MinIO execution for this release has not been verified in the build environment, where Docker is unavailable.

## What works

- NestJS API, PostgreSQL/Prisma with twelve migrations, Redis/BullMQ and a Next.js frontend.
- Accounts, HttpOnly sessions, rotation/revocation, email verification/recovery, organizations, roles, invitations and team access.
- Persistent Brand Brain/Creative DNA, version history, optimistic revisions and restore.
- Drafts, cumulative scene timelines, reorder/duplicate scene editing, comments, review/rejection/approval, approval invalidation, campaigns, editorial calendar, search and JSON exports.
- Queued text strategy/script/scene generation with compatible primary/fallback providers, validation and usage records.
- **Policy-aware model routing:** task capability, plan, declared quality, shared Redis health, configured dollar caps and comparable-fallback enforcement; ambiguous provider outcomes never start a second paid call.
- **Generated media:** saved image/voice/video jobs, rights and estimate acceptance, plan-aware models, bounded image/voice options, separately quoted editing with one to four verified private image references, fixed credit reservations, retained UNKNOWN output review, private validated outputs, restart recovery and revision-checked scene attachment. Enabled explicitly by an administrator; no live provider acceptance claimed.
- **Asset library:** private image/video/audio uploads, validation, previews, tags, search, deduplication, downloads, archive and restore.
- **Video studio:** uploaded media attached to scenes, reorderable/duplicable timeline scenes, per-scene Fit/Fill framing for images and video, actual FFmpeg MP4 rendering, uploaded narration/background music, manual timed caption cues with legacy full-scene fallback, portrait/landscape/square formats, progress/cancel/retry, reusable scene cache, preview and MP4/SRT/thumbnail downloads. Caption timing is manual, not automatic transcription or speech alignment.
- Separate approval for the exact rendered content revision, responsive light/dark UI.
- **Workspace health:** actual database/queue/storage/worker checks, tenant job counts, tracked storage usage and private workspace data export for owners/admins.
- **Credits & usage:** immutable history, accepted AI quotes, atomic reservations/settlement, queued-cancel release and review of uncertain provider outcomes. Restricted verified platform administrators can grant/correct/resolve credits. Self-hosted mode stays the default.
- **Billing:** database plans/entitlements/subscriptions, durable invoice records/views, explicit refund/dispute/fraud/proration policy and the official Stripe SDK contract for test/live configuration, hosted Checkout and Portal sessions, strict plan-price mapping, raw-signature webhook verification and Stripe subscription/paid-invoice mapping. The UI exposes billing only when configured; redirects never grant access.
- **Recovery:** queued AI jobs recover missing queue entries; interrupted provider calls fail without automatic replay; new jobs retain their original brand context.

To try the new workflow: **Asset library → upload media → Content library → Video draft → attach assets to scenes → Save → Render → Preview/download**. Review/approve the content before approving its rendered video. Text in a voiceover field is a script; it does not automatically synthesize speech. Generate AI voice explicitly in Asset library → Generate with AI, or attach recorded narration.

## AI configuration

In `.env`, set `AI_PRIMARY_URL`, `AI_PRIMARY_KEY`, `AI_PRIMARY_MODEL`, and declare its verified `AI_PRIMARY_QUALITY`. The provider must support compatible `/chat/completions`, JSON object responses and `max_completion_tokens`. Optional fallback uses `AI_FALLBACK_*` and is used only when its capability, quality, plan, health and cost policy remains compatible. Configure current per-million token rates before setting `AI_MAX_REQUEST_USD`; unknown-cost routes are blocked when a dollar cap is active. Then recreate API/text-worker containers. Never commit `.env` or put credentials in frontend code.

AI generation is fixture-tested, not live-provider verified. The test fixture is isolated in the verification harness and is never an application fallback. Rendering uploaded media needs no AI provider key.

For image/voice/video presets, explicit opt-in and current operator estimates, follow `docs/GENERATED_MEDIA.md`. Start the separate `media-worker`; provider keys stay on the server.

## Product-credit configuration

`BILLING_MODE=self_hosted` is the backward-compatible default. To enforce product credits, use `BILLING_MODE=credits`, configure per-task prices and restricted `PLATFORM_ADMIN_USER_IDS`, and restart API/text worker consistently. `BILLING_WEBHOOK_SECRET` protects the provider-neutral test endpoint. Stripe is disabled by default; `STRIPE_MODE=test` requires a test secret key, webhook secret and distinct Starter/Growth price IDs. Use `live` only after sandbox acceptance and production review. See `docs/BILLING.md`. No real Stripe account or payment was used in this release.

## Remaining work

Live generated-media acceptance and additional provider controls; word-aligned captions, motion/effects and platform variants; live sourced research/trends/SEO/AEO; official social OAuth/publishing; external analytics and growth learning; actual Stripe sandbox/live acceptance and money-moving refund/dispute lifecycle checks; retention/deletion; production observability, native cross-store restore exercises and full master acceptance. These require implementation, not just credentials.

## Verification

Run `npm run build`, `npm test`, `npm run verify:upgrade` and the isolated
`node scripts/verify-local.mjs --production-web` harness. See
`docs/VERIFICATION_REPORT.md` and `docs/qa/verification-summary.json` for checks
actually completed. The earlier missing Redis binary was resolved with the
optional checksum-pinned installer. Test fixtures never become runtime fallbacks.

The latest npm audit (2026-09-29) reported zero known advisories; dependency versions
have not changed in 0.9. This dated result excludes Java/S3Proxy and application
security. Native PostgreSQL races/restore, Docker/MinIO, live providers and full
master acceptance remain open.

The workspace NDJSON export includes records and authenticated media references;
it is not a database/media restore backup. The current v0.9.2 EDITOR-01C source is
published on public `main` at commit
`177936421b896737ed6ea424f7520c32651ee596`, and all 184 remote blob paths/modes/SHAs were verified against
the local source. Public Actions run `37189446835` completed the native application
verification workflow successfully.
