<!-- NOTIFY01H_CURRENT_START -->
## Current: NOTIFY-01H bounded live-stream reconnect - 2026-11-13

NOTIFY-01H adds controlled reconnect behavior to the optional tenant/role-guarded notification SSE stream. A transient EventSource failure closes only the failed connection, exposes a clear **Reconnecting...** state, and retries with bounded delays of 1s, 2.5s, 5s, 10s and a capped 30s. The existing 60-second list polling fallback remains active, and navigation/unmount clears pending timers and closes the stream.

The increment is client-side only: no schema, migration, provider call, external delivery, durable replay, cross-process fan-out or delivery-SLO claim is added. Existing cursor/count-only snapshots, tenant/role checks, category muting, explicit preference saves, read/unread actions and the 60-second server stream bound remain unchanged. API/web production builds, 33 focused notification unit tests, formatting and diff checks pass. The owned Windows UI verifier was run through verify-local and failed closed before fixture startup because 127.0.0.1:6379 is occupied; no existing service was contacted.

Exact three-job CI on this new source is still required. Preserve real services, credentials, volumes, Antigravity worktrees and the user's uncommitted apps/web/next-env.d.ts change. See [NOTIFY-01H evidence](docs/qa/notify01h-evidence.json) and [stream reconnect design](docs/NOTIFICATION_STREAM_RECONNECT.md). External delivery, durable/cross-process realtime, remote durability/RPO-RTO, deployed/live-provider and full-master acceptance remain open; CI verifies fixtures and does not deploy.
<!-- NOTIFY01H_CURRENT_END -->

<!-- NOTIFY01F_CURRENT_START -->
## Current: NOTIFY-01F notification preference controls UI - 2026-11-12

NOTIFY-01F adds an accessible notification-preferences panel to the existing notification center. It exposes native checkbox controls for Render, Publish, AI, Billing, Approval and Content categories, reads and writes the existing tenant/user-bound preferences endpoints, and keeps changes local until the user selects **Save preferences**. Back, Cancel and close discard unsaved changes; a successful save refreshes the feed and unread badge so muted categories disappear from the default view. The close-discard regression protects against reopening stale local choices.

The UI increment adds no schema or migration, external email/push/realtime transport, provider call or delivery SLO claim. Existing polling, read/unread/read-all, category filtering, generation guards, role/tenant checks and E's replacement preference API remain unchanged. Local API/web production builds, 31/31 focused notification unit tests and diff checks pass. Local browser execution remains unclaimed because the owned verifier fails closed when Redis 127.0.0.1:6379 is occupied; real services, volumes, credentials, Antigravity worktrees and the user's uncommitted apps/web/next-env.d.ts change remain untouched.

The exact final F commit **004aa8d95d5cb4bac071e031537e4addf906797a** was verified by [run 43112150245](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43112150245); all three jobs and every required step passed. Results are 430 unit, 77 HTTP, 68 browser, 5 recovery, 26 migration files, 44 readability samples (36 standard plus 8 busy), zero production/full dependency-audit vulnerabilities and all 24 Compose phases. The implementation source and runner pin are carried from e56e9731b934ec315d54b3765263c2cfe6e7663d, with core on ubuntu-24.04/HarfBuzz 8.3.0. Artifact names, sizes and API digests are recorded, while artifact ZIP bytes and embedded reports remain uninspected because the download route is proxy403-blocked. The portable source package and final external receipt close F's package status. Production/live-provider, external notification delivery/realtime/SLO, remote durability/RPO-RTO, deployed and full-master acceptance remain open; CI does not deploy.
<!-- NOTIFY01F_CURRENT_END -->

# Active handoff - NOTIFY-01F notification preference controls UI integration

<!-- NOTIFY01E_CURRENT_START -->
## Historical: NOTIFY-01E notification preferences and category muting - 2026-11-12

NOTIFY-01E is closed on exact published source commit 121c63c135fb03ea6e24c8b24bb41b31d765edf2; [GitHub Actions run 43073695509](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43073695509) passed all three jobs and all 41 required steps. The verified result is 431 unit, 77 HTTP, 68 browser, 5 recovery, 26 migrations, 44 readability samples (36 standard plus 8 busy), zero production/full dependency-audit vulnerabilities and all 24 Compose phases. The native upgrade report preserved 26/26 migrations; the populated PostgreSQL PITR report compared 38 tables with 11 populated tables and 19 rows; the Compose report bound in-flight claims, a WAL target, four historical objects and one admitted callback while denying ten admission controls.

The increment adds tenant- and user-bound GET/PUT/PATCH notification preferences, immutable audit-log preference updates, default muted-category filtering for the notification feed and unread summary, and explicit include/category overrides. No migration or external delivery claim is added. The first exact attempt 43070242889 correctly exposed a contradictory PATCH expectation; commit 121c63c fixed the test to match replacement semantics before the accepted run. Local Prisma generation, API/web builds, 31 focused notification tests and zero audits pass. The Windows full unit attempt remains environment-limited at 305/430, and the owned HTTP verifier remains fail-closed because Redis port 6379 is occupied.

See [NOTIFY-01E evidence](docs/qa/notify01e-evidence.json) and the external receipt/source package in the desktop project-files folder. Preserve the user uncommitted next-env.d.ts change and Antigravity worktrees. The next action is the next bounded NOTIFY-01 increment; production live/deployed/provider, remote durability/RPO-RTO and full-master acceptance remain open; CI does not deploy.
<!-- NOTIFY01E_CURRENT_END -->

<!-- DATA01F_INTEGRATION_CURRENT_START -->
## Current: DATA-01D through DATA-01F exact CI closure - 2026-11-11

DATA-01D, DATA-01E and DATA-01F were reviewed in the separate integration worktree and are now published on exact main commit fe3c090e3ce759f9f233501e312aadd43a232706. [GitHub Actions run 42919208576](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/42919208576) passed all three jobs and all 41 required steps: 424 unit, 74 HTTP, 68 browser, 5 recovery, 26 migrations, 44 readability samples, zero audits and all 24 Compose phases. Four evidence artifacts were downloaded; downloaded ZIP bytes and embedded reports were inspected; the API digest versus downloaded ZIP SHA-256 comparison gap is recorded.

The accepted increment adds strict ISO-8601 audit-range validation, cancellation-safe export cleanup, workspace-row locking with legal-hold/in-flight rechecks and exact byte aggregation beyond the 100-row preview. Local API/web/Prisma builds and 20 focused data-governance tests pass. Local DATA HTTP is explicitly unaccepted because the owned verifier refused occupied port 3000 before startup; existing services stayed untouched. See [DATA-01F evidence](qa/data01f-evidence.json).

NOTIFY-01D lifecycle wiring is exact-source CI verified on e6fbd33ce79b590bd34462f5306585d39a542214 / run 43030351133. All Antigravity worktrees and the user's uncommitted apps/web/next-env.d.ts change remain untouched. Remote durability/RPO-RTO, live/deployed/provider and full-master acceptance remain open; CI verifies fixtures and does not deploy.
<!-- DATA01F_INTEGRATION_CURRENT_END -->

<!-- NOTIFY01C_DATA01C_CURRENT_START -->
## Current: NOTIFY-01C / DATA-01C exact-source closure - 2026-11-11

NOTIFY-01C and DATA-01C are closed on exact source commit `e4f74b45fe936296f171a86cde9469be5da39d91`. GitHub Actions [run 42875217657](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/42875217657) completed successfully with all three jobs and every required step: native application verification, disposable Compose/native restore, and native populated upgrade/migration recovery. Four evidence artifacts were uploaded; names, sizes and SHA-256 digests were recorded in the final receipt.

The implementation includes the guarded tenant notification center, unread/read/read-all actions, atomic low-credit and policy-review alerts, locked retention pruning, and private-output preservation. A final boundary regression fixed the exact-threshold case (20 credits to 17 now emits one deduplicated alert) without changing ledger immutability or transaction boundaries. Focused notification/data tests and API build passed locally; Windows full-suite/render prerequisites and occupied Redis limitations remain recorded rather than treated as acceptance.

The source receipt is [docs/qa/notify01c-final-ci-receipt.json](qa/notify01c-final-ci-receipt.json). The portable source package is `organic-marketing-os-v0.9.2-notify01c-20261111.zip` outside the repository. Review the separate Antigravity `notify-01d`/`data-01d` branches against this integrated main before selecting the next bounded slice. Live/deployed/provider, remote durability and full-master acceptance remain open; CI verifies fixtures and does not deploy.
<!-- NOTIFY01C_DATA01C_CURRENT_END -->

# Historical handoff - NOTIFY-01B / DATA-01B integration

UX-01L is closed on exact `main` commit `dafdb93a562c5bf53d9dfaa159340754775a6e07` and [run 41921508171](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/41921508171): all three jobs and every required step passed (379 unit, 50 HTTP, 67 browser, 5 recovery, 25 migrations, 24 Compose phases, zero audits). Four artifact bytes/digests/CRCs and embedded reports were checked; [imported receipt](qa/ux01l-final-ci-receipt.json) closes its packaged pending status.

Current integration merges Antigravity's PR #1 `notify-01a` head `73ff67b` and PR #2 `data-01a` head `f22119d` into main without editing their worktrees. NOTIFY-01B (`notify-01b`, head `6db62d6`) adds publishing and AI failure notifications; DATA-01B (`data-01b`, head `ff85254`) adds tenant-scoped social-connection disconnect, credential scrubbing and schedule/attempt cascade. Both were reviewed against integrated main, with three data branch trailing-blank-line violations removed during the merge resolution. The implementation merge is `058cf27`; docs were published at `f1ba479`. Focused notification 20/20 and data-governance 11/11 checks plus API/web builds pass. Exact [run 42810027002](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/42810027002) passed all three jobs and all 41 steps. Artifact names, sizes and digests were recorded; browser artifact bytes/report remain uninspected because downloads were proxy403-blocked. The prior continuity checkpoint `5e8b537` passed [run 42805024713](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/42805024713). See [current evidence](qa/integration01b-evidence.json) and [prior receipt](qa/integration01a-final-ci-receipt.json). Local HTTP could not run safely because FFmpeg/fontconfig failed and an existing Redis occupied port 6379; the harness refuses occupied ports before fixture startup. See [integration evidence](qa/integration01a-evidence.json).

At the time of this historical handoff, later NOTIFY-01C–E and DATA-01C–F were still on Antigravity-owned branches; they are now reconciled in the current sections above. Preserve all prior assertions, master specification, real environment/user services and media/volumes. Recovery fixtures ended at P; production/live-provider/deployed/full-master acceptance remains open. CI does not deploy.

## Historical UX-01L handoff

Verified predecessor: UX-01K exact commit `44cdc0193c88f296e73bc97ffa869642985b7f78`, [run 41826622865](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/41826622865). All three jobs and every required step passed: 379 unit, 50 HTTP, 67 browser, 5 recovery, 25 migrations, 44 readability samples, zero dependency-audit vulnerabilities and all 24 Compose phases. Four artifact ZIP byte digests, CRCs and embedded reports were verified. [Imported receipt](qa/ux01k-final-ci-receipt.json) closes K's packaged own-CI pending status. First K run 41824933052 remains a historical failed assertion, not acceptance.

Current: [UX-01L keyboard focus for publication search details](WORKSPACE_SEARCH_FOCUS.md). Opening a saved preparation focuses its detail heading; returning focuses the exact result trigger, or the search input if that result has disappeared. The query, filters and result list remain intact. This is a client-side focus change; no API, provider, dependency or migration change. [Browser regression](../tests/ui/workspace-search.spec.ts) covers forward/back focus and retains frozen/current content behavior.

UX-01L local verification: 6 HTTP and 6 browser checks pass after 25 migrations in an owned fixture; a further final-source keyboard Enter/Shift+Tab case and 6 HTTP checks pass in another owned fixture. Both cleaned up with unchanged real environment. The first browser run passed 5/6 but hit the existing current-content assertion's five-second limit while the local content view was loading; the assertion remains exact with a bounded 20-second wait, and the full focused suite passed on rerun. [QA evidence](qa/ux01l-evidence.json) records all attempts. L is closed on exact commit `dafdb93a562c5bf53d9dfaa159340754775a6e07` / run `41921508171`; see [final receipt](qa/ux01l-final-ci-receipt.json). Do not count K's green run for L. Preserve all prior assertions, 25 migrations, the master specification and user data. Recovery fixtures ended at P; production/live-provider/deployed/full-master acceptance remains open. CI does not deploy.

Parallel ownership: Codex owns UX/search UI and main integration. Antigravity owns the separate NOTIFY-01A and DATA-01A backend branches. Their pre-integration green CI does not establish merge or integrated-main acceptance. Reconcile both branches against current main without discarding either history; do not edit their worktrees here.
Method: focused local checks then full exact-commit CI and artifact review. Preserve assertions, real environment/user services, migrations and master specification. Only owned fixtures. Recovery fixtures closed at P; no Q/R. Production/live-provider/deployed/full-master gates remain open. CI does not deploy; the source ZIP is not a runtime backup.

<!-- NOTIFY01A_NOTE_START -->
## NOTIFY-01A integration note - 2026-11-10

The NOTIFY-01A backend branch `notify-01a` (PR #1) adds the `Notification` table (migration `202611030001_in_app_notifications`, 26 migrations and 38 tables) and tenant-bound list/get/read APIs. Branch CI is recorded in [notification evidence](qa/notify01a-evidence.json); integrated-main acceptance passed on exact commit `607b8fb` / run `42784451013`. The merge carries 26-migration assertions in the application snapshot and recovery scripts. No external delivery or realtime/SLO claim. Later NOTIFY branches remain separate and must be reviewed against integrated main.
<!-- NOTIFY01A_NOTE_END -->

<!-- DATA01A_NOTE_START -->
## DATA-01A integration note - 2026-11-10

DATA-01A branch `data-01a` (PR #2) expands the NDJSON workspace export to publication, billing, claim-review and social-connection records with credential stripping. It adds member revocation with session invalidation and immutable financial/audit history preservation. Review found that the branch endpoint could remove an OWNER, unlike the existing team endpoint; integration adds an owner guard and regression. Branch evidence is in [DATA-01A evidence](qa/data01a-evidence.json); integrated-main CI passed on exact commit `607b8fb` / run `42784451013`. Later DATA branches remain separate until reviewed.
<!-- DATA01A_NOTE_END -->
<!-- NOTIFY01G_CURRENT_START -->
## Current: NOTIFY-01G bounded notification live updates - 2026-11-12

NOTIFY-01G adds an optional tenant- and role-guarded Server-Sent Events snapshot stream. It emits only a change cursor plus total/unread counts, checks the existing muted/user/broadcast scope every two seconds and closes after 60 seconds. The notification panel refetches its guarded list when a snapshot changes, retains the existing 60-second polling fallback and exposes live/connecting/fallback state. Existing notification creation, read/unread actions, category muting, explicit preference saves, tenant/revision/security checks and migrations are preserved.

Exact implementation commit `a7c6e1c216678c36ba4ce225a4cb606dee321a49` / run `43129027400` (https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43129027400) passed all three CI jobs and every required step: 431 unit, 78 HTTP, 68 browser, 5 recovery, 26 migrations, 44 readability samples (36 standard plus 8 busy), zero production/full audit vulnerabilities and 24 Compose phases. The first G run's single browser routing failure was fixed by routing EventSource through the `/api` rewrite; the fresh run above is the acceptance run. Uploaded artifact names, sizes and SHA-256 digests are recorded in `docs/qa/notify01g-evidence.json`; artifact bytes/reports remain uninspected because the download path is proxy403-blocked, while upload digests and CI logs were verified.

The portable source package is `C:/Users/shlok/Desktop/organic-marketing-os-project-files/organic-marketing-os-notify01g-final.zip` and the paired external receipt is `C:/Users/shlok/Desktop/organic-marketing-os-project-files/notify01g-final-ci-receipt.json`. CI verifies owned fixtures and does not deploy. This bounded increment does not add email, SMS, mobile push, cross-process fan-out, durable replay or a realtime delivery SLO; production/live-provider, remote durability/RPO-RTO, deployed and full-master acceptance remain open. Preserve real services, credentials, volumes, Antigravity worktrees and the uncommitted `apps/web/next-env.d.ts`.
<!-- NOTIFY01G_CURRENT_END -->
