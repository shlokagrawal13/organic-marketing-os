# Start here — Organic Marketing OS

Application version: **0.8.0**. Handoff revision: **2026-09-29.2**. This archive contains the current source, complete supplied master spec, completed-work evidence, remaining tasks and access requirements. Read these files instead of asking the user to retell the project.

## Resume in another chat or account

Upload the latest checkpoint ZIP and send the text in `RESUME_PROMPT.txt`. A project folder opened in a coding agent uses the same files. For a connected private repository, use its latest agreed branch/commit instead of an older ZIP. Authorize required tools/connections in that environment; this file does not transfer an account login or execution permission.

Only the last saved checkpoint travels. A chat's unsaved work, running processes, secrets, and the user's local database/media do not appear in a source archive automatically. Keep the existing Windows `.env` and Docker volumes private and intact.

## Read in this order

1. `AGENTS.md` — architecture, safety, testing and update rules.
2. `PROJECT_CHECKPOINT.json` — current task state, next action, evidence and blockers.
3. `PROJECT_STATUS.md` and `docs/HANDOFF.md` — implemented behavior and prior decisions.
4. `docs/TASK_BOARD.md` — stable pending-task IDs with acceptance criteria.
5. `docs/ACCESS_REQUIREMENTS.md` — access only when an actual test/integration needs it.
6. Relevant domain documents/code, then the relevant numbered sections of `docs/MASTER_SPEC.md` and `docs/REQUIREMENTS_MATRIX.md`.

The master spec is authoritative for intended scope; working code and dated test evidence establish actual behavior. Conflicts require inspection, not assuming a feature exists.

## First useful action

Canonical repository: https://github.com/shlokagrawal13/organic-marketing-os (private), main branch. Published v0.8 application commit: `bce6fc27daa6869d5464d160e2dda083a2ba4d2d`, exact tree `a6db020badb17a32617da54ccc6222afa0c35356`. Actions run `36622686659` failed before jobs because the authenticated account remains billing-locked. Use the latest repository source/checkpoint rather than an older ZIP or unrelated repository.

Check the archive manifest. MODEL-01 and AGENTS-01 local contracts are complete; live provider benchmarks remain AI-LIVE-01 and native Redis execution remains NATIVE-01. Continue **MEDIA-01** while external billing/native access is blocked. BILLING-01 actual Stripe sandbox verification still requires authorized test configuration. Do not re-create the app from a template.

```bash
python scripts/package_handoff.py --check
```

Use `python3` on Linux/macOS or `py -3` on Windows if that is your Python 3.9+ command. This optional helper verifies a source snapshot; it does not execute the app or contact a service. See docs/TEST_STRATEGY.md for application tests.

## Facts that must not be lost

- Architecture: Next.js frontend, NestJS API, PostgreSQL/Prisma, Redis/BullMQ, private S3-compatible storage, dedicated FFmpeg render worker. Eleven additive migrations; the original ten are preserved.
- Actual MP4 rendering uses uploaded media; voiceover text does not synthesize speech.
- Text adapter is OpenAI-compatible `/chat/completions`, default OpenAI URL, blank key/model. No live paid model is verified.
- Latest increment evidence: Prisma generation, 19 unit tests, API and Next.js production builds, both npm audits at 0 advisories and PGlite populated upgrade/restore through eleven migrations. The full verifier cannot start scenarios because `redis-server` is absent. Earlier 0.6 evidence: 12 unit, 6 HTTP, 5 browser and 3 recovery/configuration scenarios. Native PostgreSQL/Docker/MinIO, live providers and full production acceptance remain open.
- Production and full npm audits were both 0 on 2026-09-26 after replacing S3rver with checksum-pinned S3Proxy. The Java tool is outside the npm scan. These are dated results, not permanent security guarantees.
- All 161 master headings are mapped (140 Partial, 21 Missing in the last counted matrix; not completion percentages). Generated media/voice, live sourced research, publishing, external analytics, actual Stripe sandbox/refund/dispute/fraud workflows and several operational capabilities still need implementation.
- The user does not want to be assigned routine testing. Continue local engineering/testing independently and state any genuine external blocker clearly.

## Before the next handoff

Follow the continuity contract in AGENTS.md. Update the checkpoint, task board and session log while work progresses, then run:

```bash
python scripts/package_handoff.py
```

This writes a new manifest and ZIP outside the project folder. It packages source/documentation/evidence and excludes runtime data, credentials and build caches. It does not infer what was completed; the agent must update that information accurately. Always provide the latest saved ZIP or successfully pushed repository commit.
