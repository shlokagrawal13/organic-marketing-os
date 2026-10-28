# Brand Brain and Creative DNA autosave

UX-01D advances master section 124 for the business profile and Creative DNA. Both share one tenant-bound optimistic revision and save together. A first manual save is required; subsequent edits debounce for two seconds in either editor. Switching between Brand Brain and Creative DNA retains both local drafts. Leaving knowledge editing or changing workspace requires discard confirmation when dirty. Started requests may finish after leaving, but late responses cannot replace another editor/workspace.

[Shared revision persistence](../apps/web/app/use-revision-persistence.ts) serializes manual/automatic writes, preserves typing during requests, and stops on failures rather than replaying uncertain writes. The [content transport](../apps/web/app/use-draft-persistence.ts) retains UX-01C's DRAFT-only state, confirmation-read and uncertain-creation checks. Every predecessor assertion remains.

[Brand API](../apps/api/src/brand.ts) retains OWNER/ADMIN/EDITOR writes, all existing read roles, strict payload validation, version/audit creation and explicit revision-checked restore. Optional `autosave: true` requires an existing revision. Concurrent initial creation returns one success and a controlled conflict, including native uniqueness conflicts. No schema, migration, dependency, workflow or provider changes are needed.

[Knowledge save status](../apps/web/app/brand-save-status.tsx) shows pending/saved/error state, exports the exact current local business profile and DNA, and offers confirmed reload. Conflicts and ambiguous first creation block manual save until reload; existing-record explicit retries remain revision-bound. Restore cannot discard dirty edits or overlap a save; explicit workspace actions block navigation/workspace switching until completion so their reload cannot discard a different editor's input. Generation guards cover workspace reads, discarded writes, and out-of-order history/activity refreshes. Each save and knowledge/metadata read has a 20-second deadline; a timeout does not establish rollback. Selecting the already active workspace is a no-op and does not enter an unresolved loading state.

| Requirement | Verification |
| --- | --- |
| Tenant/session/current-membership and six-role boundaries | Native HTTP, including CREATOR/ANALYST/CLIENT write denial |
| Initial consent, strict inputs, stale revisions, version/audit and restore | Native HTTP; concurrent initial creation has no server-error outcome |
| Profile/DNA combined debounce and reload | Actual API/browser/database assertions; desktop and390px mobile |
| Typing during acknowledged delayed writes | Sequential revisions retain both editors' exact local values |
| Conflict export, confirmed reload and dirty restore guard | Browser export JSON and cancel/confirm checks |
| Uncommitted/committed response loss and uncertain creation | No automatic retry; explicit retries cannot overwrite later revisions |
| Navigation and workspace/read cancellation | Browser deferred real writes/reads and discard confirmation |
| Out-of-order history | Older real response cannot replace a newer saved revision's history |
| Predecessor content/search guarantees | All UX-01C and workspace-search scenarios retained and rerun |

[QA evidence](qa/ux01d-evidence.json) records actual local results and any initial failures. Final acceptance requires ALL THREE jobs and every required step on D's own exact published commit. Pair the external final receipt with the fresh portable source ZIP; predecessor CI does not verify D.

Research remains an explicit save/review flow because every field edit resets its source-authorization acknowledgement. This increment does not infer that authorization or automatically invalidate accepted evidence. Other settings/editors, offline durability, collaborative merge, nested workspaces, search/performance and wider accessibility remain unfinished.21 broad product tracks and production/live-provider/deployed/full-master gates remain open. Recovery fixtures are closed at P; no Q/R. CI verifies owned fixtures and does not deploy.
