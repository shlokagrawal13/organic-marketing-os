# Workspace settings draft protection

UX-01E addresses accidental loss of workspace name/timezone edits in master sections123–124. The settings panel reads current tenant-bound settings whenever it opens. OWNER/ADMIN may edit; all other roles retain the existing read-only UI and server write denial.

[Settings panel](../apps/web/app/workspace-settings.tsx) keeps a controlled local draft and compares it with the last acknowledged values. Changes require explicit Save workspace. Dirty navigation, workspace switching, browser reload and sign-out require confirmation. Sign-out now also respects the existing content, knowledge, research and policy dirty states. Cancel keeps local edits. An exact JSON export contains only the workspace identity, local name/timezone, last acknowledged name/timezone and whether the save is unconfirmed; it contains no credentials.

A synchronous in-flight guard serializes reads/writes. During a request, fields and navigation/workspace/sign-out controls are disabled. The request has a20-second deadline. Successful writes update the visible workspace name/timezone from the response without a global session refresh that could discard the editor. Unmounted responses cannot update a later editor. Reopening fetches current server values.

Validation or permission failures retain the draft and allow an explicit corrected save. Network loss, server errors or an invalid acknowledgement block further writes until a confirmed reload. No automatic retry is sent. Reload requires discard confirmation; a failed read retains both the draft and uncertain-save block. A timeout does not prove rollback, and a started request may finish later.

| Acceptance | Evidence |
| --- | --- |
| Cancel navigation, workspace switch, actual browser reload and sign-out | Browser assertions retain exact edits and show zero writes |
| Explicit sign-out after confirmation | Actual single-session and all-device logout; login UI and revoked session denial |
| Name/timezone export | Downloaded JSON compared with exact local and saved values |
| Delayed actual PATCH | Real DB update, disabled controls, one request and one audit record |
| Acknowledged settings and responsive layout | Header/selector values; desktop and390px screenshots/overflow check |
| Committed response loss and another administrator's later update | No replay; mandatory reload; newer server values preserved |
| Failed reload | Local edits and uncertain state retained |
| Validation and revoked membership | Actual400/403 behavior; no automatic writes |
| EDITOR/CREATOR/ANALYST/CLIENT | Read-only UI and actual server403 |
| Initial read failure and reopening | Explicit read recovery and fresh server values |
| Existing search/content/knowledge | All23 predecessor browser and10 HTTP checks retained |

This is draft-loss protection, not settings autosave or optimistic concurrency. The existing settings API has no revision token and retains explicit last-write-wins semantics. Collaborative merge, offline/crash durability, other editors, nested workspaces and broader UX/search/accessibility remain open. Research authorization/review remains explicit. Recovery fixtures remain closed at P; no Q/R. CI verifies owned fixtures and does not deploy. Final acceptance is recorded in the external UX-01E exact-commit receipt paired with its source ZIP.
