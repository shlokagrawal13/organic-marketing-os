# Active handoff - NOTIFY-01D lifecycle integration

<!-- NOTIFY01D_CURRENT_START -->
## Current: NOTIFY-01D lifecycle wiring - 2026-11-11

The accepted NOTIFY-01D source is exact commit `e6fbd33ce79b590bd34462f5306585d39a542214`; [GitHub Actions run 43030351133](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43030351133) passed all three jobs and all 41 required steps. It records 428 unit, 76 HTTP, 68 browser, 5 recovery, 26 migrations, 44 readability samples (36 standard plus 8 busy), zero audit vulnerabilities and all 24 Compose phases. The native populated upgrade report passed 26 migration checks; the PostgreSQL PITR report compared 38 tables and 19 rows; the Compose report passed all 24 phases. Artifact metadata and the download gap are recorded in [notify01d evidence](qa/notify01d-evidence.json).

The implementation wires signed billing subscription/payment-failure notifications into the billing transaction, revision-bound content-ready notifications into DRAFT to REVIEW, and a tenant/role-scoped unread category summary. Local Prisma/API/web builds and 29 focused notification tests pass. The owned HTTP verifier refused occupied Redis port 6379 before startup; no existing user service was contacted or stopped.

The bounded NOTIFY-01D increment is closed. Preserve Antigravity worktrees and the user's apps/web/next-env.d.ts change. Next action is the next bounded NOTIFY-01 increment; production live/deployed/provider, remote durability/RPO-RTO and full-master acceptance remain open; CI does not deploy.
<!-- NOTIFY01D_CURRENT_END -->

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

Later NOTIFY-01C–E and DATA-01C–F remain on Antigravity-owned branches; review them only after the `058cf27` exact CI closes. Preserve all prior assertions, master specification, real environment/user services and media/volumes. Recovery fixtures ended at P; production/live-provider/deployed/full-master acceptance remains open. CI does not deploy.

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
