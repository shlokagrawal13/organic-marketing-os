<!-- UX01B_CORE_BUDGET_START -->
## UX-01B core CI time budget - 2026-10-27

Fixture-budget follow-up aa8c4eb7a09142c65a0cd2f9ae0f3581fcd7f74c/run40512689694 passed native upgrade, all24 Compose phases, core build,379 unit,44 readability and zero audits. Core media installation spent14min27s downloading116MB at134kB/s. The application flow was cancelled at about25 minutes, matching the configured job cap, before complete HTTP/browser/recovery acceptance. A same-source single-core retry reached GitHub startup_failure with zero jobs and an unexpected-error annotation. Later retry APIs reject the empty current attempt/old job. These are not final acceptance; see docs/qa/ux01b-ci-attempt2.json. Both earlier B attempts and their gaps remain recorded.

The reviewed CI change increases only the core job total budget25 to40 minutes. Every command, test, audit gate, required step and application assertion is unchanged. YAML/format and exact single-value comparison pass. The fixture-budget fix and local5 HTTP/5 browser/exhausted-budget429 control remain; application runtime, dependencies,24 migrations and protected specification are unchanged. The new source needs ALL THREE jobs and every required step on its own exact published commit, including fresh all24-phase Compose. Pair the refreshed source ZIP with external ux01b-final-ci-receipt.json; no previous commit/run substitutes.

Planned recovery fixtures remain closed at P; no Q/R. Production durability/RPO-RTO, live/deployed/full-master acceptance and21 broad product tracks remain open. CI verifies fixtures and does not deploy.
<!-- UX01B_CORE_BUDGET_END -->

<!-- UX01B_CI_FOLLOWUP_START -->
## UX-01B isolated HTTP rate-budget follow-up - 2026-10-27

First B publication 4d37eaa9d6c86f53704b46ed39d02b39867ced04/run40447671309 passed native upgrade/physical recovery, all24 Compose phases, core build,379 unit,44 readability samples and zero audits. Core HTTP passed40/43; the last three search scenarios hit the shared fixture loopback budget with429. Browser/recovery phases did not execute. This is not final acceptance. See docs/qa/ux01b-ci-attempt1.json.

The follow-up uses the existing isolation-guarded resetFixtureRateBudget before each independent search HTTP scenario. Every authentication/tenant/role/data assertion and the production600-per60-second limiter remain unchanged. Follow-up local5 HTTP/5 browser pass. An additional independent Redis fixture starts with an exhausted API budget: the actual unchanged production limiter returns429, then all5 HTTP cases pass with the isolated case setup. Both fixture cleanups/environment checks pass. API/UI/dependencies/migrations/workflow are unchanged from the first B publication. A new exact final commit must pass ALL THREE jobs and every required step; pair its external final receipt with the refreshed portable source ZIP.
<!-- UX01B_CI_FOLLOWUP_END -->

# Publication-preparation search (UX-01B)

<!-- UX01B_CURRENT_START -->
## UX-01B publication-preparation search - 2026-10-27

UX-01A final c2e12212085d0b276e9315eb1ca83e1d1f2402b2/run40444776576 passed ALL THREE jobs and every required step: 378 unit,41 HTTP,31 browser,5 recovery,24 migrations,44 readability samples,zero audits and all24 Compose phases. Four artifact ZIP byte/digest/CRC and embedded reports were verified. The imported docs/qa/ux01a-final-ci-receipt.json closes A's packaged own-CI pending status; earlier pending notices below are historical. Planned recovery fixtures remain closed at P; no Q/R.

B searches saved publication preparations using their frozen title/body/hook/platform, without substituting later content edits. Tenant-bound queries retain the existing seven-field result projection and bounded pagination. PREPARED/INVALIDATED/CANCELED are included explicitly. Exact read-only details show preparation identity/status/revision/platform, explain that preparation is not an external publishing result, and link separately to current content. Detail cancellation on back/workspace changes and existing read/upload-approval roles are preserved. Search/detail UI performs no publication mutation. See docs/WORKSPACE_SEARCH.md and docs/qa/ux01b-evidence.json.

Local3 focused unit,5 native HTTP and5 browser checks pass, along with API build/web typecheck/zero full and production audits. Twenty-four unchanged migrations were applied in independent owned fixtures; populated user services and real environment absence are preserved. Desktop/390px mobile details are checked. This new source requires ALL THREE jobs and every required step on its own exact published commit; pair external ux01b-final-ci-receipt.json with the fresh portable source ZIP. A's green CI does not verify B.

Remaining: other search domains, large-tenant performance, autosave/conflict/nested workspace and wider product UX/accessibility;21 broad product tracks remain open. Production durability/RPO-RTO, deployed real-provider and full-master acceptance remain separate open gates. CI verifies fixtures and does not deploy.
<!-- UX01B_CURRENT_END -->


[Query](../apps/api/src/search-query.ts) adds a fourth tenant-bound UNION branch over PublicationIntent. Only frozen snapshot title/body/hook and platform enter the FTS expression. Missing JSON fields become empty text. All preparation states are included, independent of the archive toggle for content/assets. The result shape is unchanged and excludes request keys/hashes, claim evidence, tokens and private object references. The existing organization/createdAt index is retained; this is not large-tenant load acceptance.

[Read-only details](../apps/web/app/publication-search-detail.tsx) use the existing tenant-checked publication-intents GET. They preserve preparation identity, display saved revision/status/platform, make no publication POST, and do not expose approval-only attempt/schedule controls. Back preserves search state; opening current content explicitly leaves the frozen preparation. Pending detail responses are discarded on unmount/workspace changes. [Browser tests](../tests/ui/workspace-search.spec.ts) include exact frozen/current opening, no mutations and delayed-response cancellation. [HTTP tests](../tests/integration/workspace-search.test.ts) cover all6 read roles, membership revocation/cross-tenant denials, unchanged attempt-role restrictions, all preparation states, frozen versus edited text, Unicode/null fields, deterministic pages and deletion.

The older UX-01A description below remains historical; its own-CI pending notice is closed by the imported [A receipt](qa/ux01a-final-ci-receipt.json).

# Workspace search

UX-01A implements the first bounded product search slice from master section57. Users choose Workspace search, enter whole words and optionally filter by record type or include archived content/assets. All words must occur in the saved record. Results open the exact content editor, focused campaign or asset card; Show all returns to the wider list. Leaving unsaved content uses the existing confirmation.

[API](../apps/api/src/search.ts) validates a strict query schema and uses [bound PostgreSQL queries](../apps/api/src/search-query.ts). Content title/body/hook, campaign name/goal/audience/description, and asset name/tags are searched with the simple dictionary. Each UNION branch constrains current organization membership. Existing read roles can search; existing write restrictions remain. Result metadata is limited to kind/id/title/summary/status/archive state/date, with title/summary <=240 characters. Exact campaign/asset endpoints constrain tenant and return404 across tenants.

Ranking uses ts_rank then date/kind/id for stable order. Page size defaults20, max50; offset max1000; the final page asks users to narrow the query. Saved changes are immediately reflected. Content retains its existing GIN expression index; campaign/asset tenant indexes are unchanged. A result limit does not establish large-tenant load performance. Query behavior follows [PostgreSQL17 full-text controls](https://www.postgresql.org/docs/17/textsearch-controls.html).

[UI](../apps/web/app/workspace-search.tsx) cancels stale response application after query/filter/workspace changes. Content opening shares selection generations with manual open/new/back so a delayed initial request cannot discard newer input. [Unit](../tests/workspace-search.test.ts), [HTTP](../tests/integration/workspace-search.test.ts) and [browser](../tests/ui/workspace-search.spec.ts) tests exercise validation, parameter binding, tenant/role denial, archive/type/Unicode/whole-word matching, deterministic pages, saved edits, exact opening, unsaved confirmation, stale responses and retry after errors.

[Evidence](qa/ux01a-evidence.json) records actual local checks and failures. Own exact-source three-job CI remains pending in this capsule; pair the external final receipt with the portable source ZIP. Local metadata-only asset fixtures do not prove S3 output/readability. No migration/dependency/workflow/recovery assertion changed.

Open: other search domains, stemming/fuzzy/semantic search, large-tenant performance, broader collaboration/autosave/conflict/nested workspace/timezone/language/first-value UX and full accessibility acceptance. P fixture recovery is closed by its [final receipt](qa/recovery01p-final-ci-receipt.json); production durability and deployed live-provider recovery remain open.
