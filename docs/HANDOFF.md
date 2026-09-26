# Project handoff — 2026-09-26.1

## User intent and working agreement

Build the supplied AI Marketing OS V3 into a fully working product. The user wants autonomous implementation and verification, including browser inspection, rather than repeatedly being asked to test. The user clarified that unavailable API keys meant AI-provider keys for the product. They want a new chat/account to continue from saved files without retelling the project. Prefer concise Hinglish updates, exact evidence and honest missing-feature reporting.

This is a source continuation checkpoint for version 0.4.0, not a claim of completed production software. The user connected GitHub and asked for continued autonomous real implementation/testing. The connection was verified; no dedicated project repository or live paid provider was established.

## Completed milestones

| Version | Implemented and locally exercised |
|---|---|
| 0.1 | Next/Nest/Postgres/Redis foundation; accounts/session/email; organizations/roles/team; brand/DNA revisions; drafts/campaigns/calendar/search/review/approval; queued compatible text tasks and usage records |
| 0.2 | Private validated assets; immutable uploaded-media render jobs; real MP4/audio/SRT/thumbnail; aspect/resolution controls; scene cache, cancel/retry and render approval; mobile/light/dark UI |
| 0.3 | AI context freezing, request identity, queue-loss reconciliation and no replay of interrupted calls; fallback/accounting fixes; runtime dependency patches; workspace health and private paginated record export; expanded recovery/no-key/role/collaboration tests |
| 0.4 | Immutable product-credit accounting, quote/reserve/settle/cancel/review, verified platform credit authority, Credits & usage UI, S3Proxy replacement and zero npm advisories; task-output provider-health fix |
| Continuity | Start/resume instructions, task board, access matrix, machine-readable state, source integrity packer and sanitized evidence |

## Actual verification boundary

Latest app tests: 12 unit, 5 HTTP scenarios, 5 production-web browser scenarios and 3 recovery/configuration scenarios. Seven migrations applied; immutable credit entries/trigger survive restore. A populated v0.1 upgrade and fresh-database restore passed on PGlite. See VERIFICATION_REPORT.md and qa/*.json, not just this summary.

The test runtime used Node 24, PGlite socket bridge, native Redis 6.2, loopback S3Proxy 4.1.1 with random SigV4 credentials, real FFmpeg/ffprobe 6.1.1, local SMTP and HTTP text fixtures. It did not use a paid AI account. PGlite serializes database work; native lock/race results remain unverified. Render interruption coverage is running cancellation/SIGTERM/retry, not full host loss or SIGKILL orphan cleanup.

The prior agent runtime had no Docker/native PostgreSQL. Native package installation failed due to runtime privilege restrictions. These facts describe that environment; recheck a new environment before assuming the same restriction. Do not bypass access controls. CI for native PostgreSQL 17/Redis 7 is configured but not remotely executed. The normal Compose/MinIO stack also remains unexecuted by the agent.

The user reported the original local frontend working on Windows. The agent did not remotely connect to their computer. Their currently installed release, current workspace content, database and storage state are unknown. Do not say the supplied 0.3 code is deployed on their machine.

## File and code map

| Need | Location |
|---|---|
| Exact product spec and traceability | MASTER_SPEC.md; REQUIREMENTS_MATRIX.md (in docs) |
| UI and role-gated operations | apps/web/app; apps/web/AGENTS.md |
| API/auth/tenancy/content/AI/assets/renders/operations | apps/api/src |
| Text/render execution | apps/api/src/worker.ts; render-worker.ts |
| Shared schemas/provider router/media/FFmpeg | packages/core |
| Data schema and seven migrations | prisma |
| Native CI and local Compose | .github/workflows/ci.yml; compose.yaml; compose.host.yaml |
| Isolated verification and PGlite upgrade/restore | scripts/verify-local.mjs; verify-upgrade.mjs |
| Scenarios and sanitized evidence | tests; docs/qa |
| Next-task state, task IDs and access | PROJECT_CHECKPOINT.json; docs/TASK_BOARD.md; ACCESS_REQUIREMENTS.md |
| Source integrity and packaging | CHECKPOINT_MANIFEST.json; scripts/package_handoff.py |

## Decisions to preserve

Keep the prescribed architecture and immutable migration history. Organization is currently the workspace boundary. No fake analytics or runtime test fallback. Every tenant route validates membership; roles constrain writes/approvals. Content changes invalidate approvals, and render approval belongs to one immutable version. Current-session file routes keep the bucket private.

New AI jobs capture brand context. Interrupted RUNNING calls fail without automatic provider replay because acceptance/charges may be unknown. Accounting failures cannot trigger a second paid fallback. Product credits now reserve/settle transactionally. Interrupted or attempted failed requests remain REVIEW, never assumed free. Fixed product quotes do not cap external provider-currency spend. Default self-hosted mode does not require product credits. Old queued jobs with no context snapshot use the current brand; keep that migration compatibility explicit.

Default Compose does not bind host 5432/6379 because these conflicted on the user's Windows machine. Optional host-development ports are separate. Preserve `.env`, Compose project identity and named volumes during upgrades; never use volume deletion as a repair shortcut.

## Open work and next action

All 161 master headings remain tracked (137 Partial, 24 Missing; not a percentage of completeness). The task board groups the remaining engineering and environment gates without removing requirements from the master matrix.

Next local task: BILLING-01, add database plans/entitlements and signed/idempotent test payment event processing, preserving the verified immutable ledger. Stripe sandbox access is needed only for actual sandbox lifecycle verification; do not claim fixture events are Stripe-connected. DEP-01 is complete for the dated npm advisory scope. If native execution becomes available, NATIVE-01 can close its own evidence gap. Continue useful local work even if external credentials remain unavailable.

No dirty implementation or running migration is intentionally left in this checkpoint. The application code is the verified 0.4 credit/tooling increment. No services need to remain running for a resume. The manifest records the exact included files. On resume, inspect any mismatch and preserve newer user work before proceeding.

The user supplied the new private shlokagrawal13/organic-marketing-os repository. Write access and the empty repository were verified; the first source upload and native CI execution are in progress. No result is claimed before remote verification.

## Portability and limits

Download/upload the newest complete source checkpoint or use the same private repository. Markdown carries intent and progress; JSON carries structured state; the manifest detects changed/missing/extra included files. None of these carries account login, live process state, provider billing, secrets or actual user database/media. Changing a ChatGPT account does not reconfigure the product's provider account or transfer its API allowance. Reauthorize required connections in the new environment and keep private runtime backups separate.

Checkpointing reduces reliance on chat memory; it cannot recover changes that were never saved. Future agents must update files during work, before a context/usage interruption where possible, and at every delivered milestone.

## New private repository — 2026-09-26.5

The user supplied https://github.com/shlokagrawal13/organic-marketing-os. The GitHub connection verified repository ID 1389748509, private visibility, an empty branch list and write access. This is the sole approved project repository. The similarly named OrganicMarketing repository is a different project and remains excluded.

Upload is being prepared from this canonical checkpoint with independent Git history. Terminal Git has no authenticated login; use the connected GitHub repository tools. Never reuse the abandoned sibling clone or its unrelated parent commit. No native CI result is claimed until its actual run finishes; record the exact uploaded commit and run URL afterward.
