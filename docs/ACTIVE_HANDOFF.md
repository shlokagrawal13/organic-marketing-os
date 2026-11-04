# Active handoff - UX-01J

Verified predecessor: UX-01I e3bac58364eefc07862f551358e630cb43f6a87d, [run41511073906](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/41511073906). ALL THREE jobs/41 steps passed:379 unit,49 HTTP,63 browser,5 recovery,25 migrations,44 readability,zero audits,24 Compose phases. Four artifact ZIP bytes/digests/CRCs/reports verified. [Imported final receipt](qa/ux01i-final-ci-receipt.json) closes I's packaged pending status.

Current: [opt-in settings autosave](WORKSPACE_SETTINGS_AUTOSAVE.md), [QA evidence](qa/ux01j-evidence.json). Local1 HTTP/15 browser pass with25 migrations in independent owned PostgreSQL/Redis; cleanup and real environment unchanged. J needs ALL THREE jobs/every required step on its own exact final commit, including all24 Compose phases. Pair external ux01j-final-ci-receipt.json with fresh source ZIP.

Acceptance: manual save remains default; explicit per-editor opt-in, two-second valid-draft debounce, existing tenant/revision/audit checks, one in-flight write, no retry on failure, conflict or uncertainty. Import/recovery/reload disables autosave. All earlier settings assertions remain. Other editors, automatic merge, nested workspace and wider UX/search remain open.

Method: focused local checks then full exact-commit CI and artifact review. Preserve assertions, real environment/user services, prior25 migrations/master. Only owned fixtures. Recovery fixtures closed at P; no Q/R.21 broad tracks and production/live-provider/deployed/full-master gates remain open. CI does not deploy; ZIP is source/context, not runtime backup.

<!-- NOTIFY01A_NOTE_START -->
## NOTIFY-01A integration note - 2026-11-04

NOTIFY-01A backend is complete on branch `notify-01a` (PR #1). Commit `12a2d6e`, CI runs 41707702237 and 41707694099 both passed. Adds `Notification` table (migration 202611030001, 26 migrations total, 38 tables) and `/workspaces/:organizationId/notifications` API (list, get, ack, read-all). Roles: OWNER/ADMIN/EDITOR/CREATOR/ANALYST allowed; CLIENT 403. No external delivery, no realtime/SLO. When UX-01 merges to main, a merge-forward of notify-01a will need: migration count assertions in tests/application-snapshot.test.ts (26), scripts/application-pitr-fixture.mjs (26) and scripts/verify-native-upgrade.mjs (26). See docs/NOTIFICATIONS.md and docs/qa/notify01a-evidence.json.
<!-- NOTIFY01A_NOTE_END -->
