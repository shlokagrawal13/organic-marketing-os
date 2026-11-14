# Notification deep links

NOTIFY-01I makes the existing notification `link` field actionable in the workspace notification center. Clicking a notification first acknowledges it when unread, closes the popover, and then resolves only a same-workspace relative path into an existing in-app view.

Supported paths are tenant-bound content and render records, publication/calendar updates, media, billing and policy-review notifications. Content and render links retain their record identifier so the destination opens the exact item. Policy-review notifications use the existing `data.contentId` when present; older rows without that metadata fall back to the publication calendar with an explanatory notice.

Absolute, cross-workspace, malformed and unknown paths fail closed and never become arbitrary browser navigation. Billing alerts open the credits view only for workspace administrators; other roles return to the dashboard with a clear access notice. The render view resolves the target job through the tenant-scoped API before selecting it, so a stale or foreign identifier remains an API-level not-found rather than a cross-tenant display.

The increment adds no schema, migration, provider call, external delivery, stream transport or delivery-SLO claim. Existing notification creation, category muting, read/unread actions, SSE reconnect and polling fallback remain unchanged. Unit coverage exercises supported targets plus cross-tenant and external-link rejection; the browser regression verifies an asset-library deep link.
