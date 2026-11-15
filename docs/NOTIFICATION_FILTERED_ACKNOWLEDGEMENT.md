# NOTIFY-01M filtered notification acknowledgement

## Scope

The notification center already lets a user choose one category at a time and
the tenant-bound API already accepts `POST .../notifications/read-all?category=`.
NOTIFY-01M connects those two existing contracts. When a category is selected,
**Mark all ... as read** acknowledges only that category; **All categories**
keeps the existing workspace-scoped action.

The action remains protected by the existing tenant and role guards. It keeps
the summary endpoint as the source of the unread badge, preserves muted-category
and explicit-category behavior, and refreshes the selected page after the
acknowledgement. No schema, migration, event producer, provider, delivery,
stream, recovery or external-service behavior changes.

## Verification

The browser regression creates unread render and publishing notifications,
selects **Publishing updates**, acknowledges the filtered action, and verifies
that publishing is read while the render notification remains unread. It then
returns to **All categories** and verifies both read states through the existing
toggle controls. Focus, pagination, preferences, SSE reconnect, deep links,
tenant isolation and role checks remain covered by the existing notification
suite.
