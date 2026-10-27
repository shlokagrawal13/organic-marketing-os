# Draft autosave and conflict recovery

UX-01C implements master section 124 for saved content drafts, including scene edits. New drafts require an explicit first save. REVIEW, APPROVED and ARCHIVED content never autosave. Settings and other editors remain separate unfinished work.

The editor waits two seconds after editing stops, then submits one revision-checked write. Only acknowledged saved data clears the dirty state. Typing during a request remains in the editor and is saved later using the acknowledged revision. Manual save shares the same serialization guard. No browser-local persistence, AI call, approval, publishing or automatic retry is introduced.

The existing content PUT accepts an optional `autosave: true`; its atomic tenant/id/revision predicate additionally requires DRAFT. Existing manual edits retain approval, prepared-publication and render-approval invalidation, content versions, asset validation and audit events. No schema, migration or dependency changes are needed.

Conflicts stop saves until an explicit confirmed reload. Network/validation failures stop autosave and preserve local edits; a user may explicitly retry an existing revision, which still cannot overwrite a concurrent revision. A possibly committed new creation or failed confirmation read blocks further saves until the user checks saved content. Export contains the current local draft. Reload requires discard confirmation. Pending timers are canceled on selection/workspace/unmount; late acknowledgements cannot reopen another editor. A request already submitted can finish after leaving. Unacknowledged edits remain subject to the existing navigation/unload warnings; there is no offline or browser-crash durability claim. Each request has a 20-second deadline, without assuming a timeout rolled back the server write.

| Acceptance | Verification |
| --- | --- |
| Tenant/session/membership and all six roles | Native HTTP scenario, including revoked membership and cross-tenant IDs |
| DRAFT-only admission and stale/concurrent write rejection | Native HTTP; exactly one concurrent revision/version/audit commit |
| Existing approval invalidation and strict payload validation | Native HTTP; explicit edit of approved content invalidates preparation |
| Text and scene edits persist after debounce/reload | Actual API/browser and database assertions |
| Edits during a delayed actual write are retained | Browser; sequential revisions 1 then 2, exact final revision 3 |
| Conflict export/reload and no background retries | Browser; downloaded JSON contains exact local title/body, cancel/confirm reload |
| Uncommitted and committed response loss | Browser; explicit retry remains revision-bound and cannot overwrite |
| Approved/read-only/new drafts do not autosave | Browser and native HTTP |
| Selection cancellation and uncertain new creation | Browser; late acknowledgement cannot reopen editor; one creation only |

Focused checks and any initial failures are recorded in [QA evidence](qa/ux01c-evidence.json). Final acceptance requires all three CI jobs and every required step on this increment's exact published commit. The external final receipt pairs with the portable source ZIP. CI verifies owned fixtures and does not deploy.

Remaining: autosave for other editors/settings, offline recovery, collaborative merge, nested workspaces, other search domains and large-tenant performance, broader accessibility, production/live-provider/full-master acceptance. Recovery fixture work remains closed at P; no Q/R.
