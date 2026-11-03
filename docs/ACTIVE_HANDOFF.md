# Active handoff - UX-01J

Verified predecessor: UX-01I e3bac58364eefc07862f551358e630cb43f6a87d, [run41511073906](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/41511073906). ALL THREE jobs/41 steps passed:379 unit,49 HTTP,63 browser,5 recovery,25 migrations,44 readability,zero audits,24 Compose phases. Four artifact ZIP bytes/digests/CRCs/reports verified. [Imported final receipt](qa/ux01i-final-ci-receipt.json) closes I's packaged pending status.

Current: [opt-in settings autosave](WORKSPACE_SETTINGS_AUTOSAVE.md), [QA evidence](qa/ux01j-evidence.json). Local1 HTTP/15 browser pass with25 migrations in independent owned PostgreSQL/Redis; cleanup and real environment unchanged. J needs ALL THREE jobs/every required step on its own exact final commit, including all24 Compose phases. Pair external ux01j-final-ci-receipt.json with fresh source ZIP.

Acceptance: manual save remains default; explicit per-editor opt-in, two-second valid-draft debounce, existing tenant/revision/audit checks, one in-flight write, no retry on failure, conflict or uncertainty. Import/recovery/reload disables autosave. All earlier settings assertions remain. Other editors, automatic merge, nested workspace and wider UX/search remain open.

Method: focused local checks then full exact-commit CI and artifact review. Preserve assertions, real environment/user services, prior25 migrations/master. Only owned fixtures. Recovery fixtures closed at P; no Q/R.21 broad tracks and production/live-provider/deployed/full-master gates remain open. CI does not deploy; ZIP is source/context, not runtime backup.

<!-- DATA01A_NOTE_START -->
## DATA-01A integration note - 2026-11-04

DATA-01A backend is implemented on branch `data-01a`. Adds comprehensive coverage of all tenant models to the NDJSON workspace export (/api/workspaces/:organizationId/operations/export), including billing records, publication records, content claim reviews, and social connections with stripped credential ciphertexts. Adds safe member-data revocation (DELETE /api/workspaces/:organizationId/operations/members/:targetUserId) for OWNER/ADMIN roles, invalidating sessions while preserving financial credit history and audit logs. Unit tests in `tests/data-governance.test.ts` and integration tests in `tests/integration/data-export.test.ts`. See `docs/DATA_GOVERNANCE.md` and `docs/qa/data01a-evidence.json`.
<!-- DATA01A_NOTE_END -->
