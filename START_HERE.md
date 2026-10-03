# Start here — Organic Marketing OS 0.9.2

Resume the saved project; do not rebuild it from a template or ask the user to
repeat its history. The user wants the full supplied V3 specification completed
incrementally with independent implementation and verification.

1. Read `AGENTS.md`, `PROJECT_CHECKPOINT.json`, `PROJECT_STATUS.md`,
   `docs/TASK_BOARD.md` and the relevant domain document.
2. Run `python3 scripts/package_handoff.py --check`. Preserve and inspect any drift
   before editing. Do not overwrite user changes, `.env` or populated volumes.
3. Use the recorded `nextTaskId`/`nextAction`. MEDIA-01B implements durable generated
   media; MEDIA-01C adds its UI; MEDIA-01D and MEDIA-LIVE-01 retain follow-up scope.
4. Keep Next.js, NestJS, PostgreSQL/Prisma, Redis/BullMQ, private S3 and FFmpeg.
   `docs/MASTER_SPEC.md` and all prior migrations are preserved.
5. Record checks actually completed, update the continuity files together, and
   create a fresh source ZIP with `python3 scripts/package_handoff.py`.

The latest source is published to the canonical public repository:
https://github.com/shlokagrawal13/organic-marketing-os. A prior automatic
approval review rejection was resolved by explicit user approval for this public
upload. Never use `shlokagrawal13/OrganicMarketing`, which is a different project.
Public Actions run `37112921768` for application commit
`74d47e6f0f8ab3873aa8b2f3935a77f7c057ea9b` completed native application
verification successfully through ordered multi-image editing. EDITOR-01A scene
timeline controls are fully verified locally and await publication/CI; continue
from the checkpoint's next provider-neutral editor action.

Local verification uses PGlite, native Redis 7.2.11, S3Proxy and real FFmpeg;
provider outputs are isolated fixtures. The optional checksum-pinned Redis
installer resolves the earlier missing-binary blocker. Native PostgreSQL/Compose,
live AI/Stripe and full master acceptance are still open. No live provider key or
paid test budget was supplied. Check current capabilities before repeating an
old environment blocker. Chat buffering itself was not diagnosed from app logs.

Read `docs/UPGRADE_0.9.md` before updating a populated installation. A source ZIP
and the workspace NDJSON export are not database/private-media restore backups.
