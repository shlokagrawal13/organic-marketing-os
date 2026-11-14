# NOTIFY-01J notification feed filtering and pagination

NOTIFY-01J keeps the notification center on the existing tenant-bound list and summary APIs while making larger feeds usable. It is deliberately limited to the client feed presentation and its browser regression.

## Behavior

- The **Show** control requests `category=RENDER|PUBLISH|AI|BILLING|APPROVAL|CONTENT`, or omits the filter for **All categories**.
- Each request uses `take=20` and an explicit `skip`. **Load more** appends the next page in the API's existing `createdAt desc` order and disappears when the server-reported total has been reached.
- The unread badge and read-all affordance use `GET /notifications/summary`, so selecting a category or loading only the first page does not undercount unread records.
- Selecting a filter clears the current page and starts a fresh request. Existing generation guards ignore late responses after a workspace change, refresh, unmount or filter change.
- SSE notifications and the 60-second polling fallback refresh the currently selected category. Read/unread mutations, preference saves, deep-link acknowledgment and tenant-safe navigation are unchanged.

The existing API intentionally permits an explicit `category` query to inspect a muted category. The UI therefore does not silently reinterpret the server's documented override semantics; default **All categories** behavior continues to omit muted categories.

## Safety and limits

The list and summary endpoints retain their existing workspace membership, role and user/broadcast scope. The page size is bounded below the API maximum and no private notification data is added to the projection. This increment adds no schema or migration, provider call, email/SMS/mobile push, durable replay, cross-process fan-out or realtime delivery SLO. CI verifies owned fixtures and does not deploy; production, live-provider, remote durability/RPO-RTO, deployed and full-master acceptance remain separate gates.

## Verification

The focused notification browser regression creates 21 historical publishing notifications plus a current render notification, selects Render and Publish filters, loads the second page and returns to All. Local Prisma generation, API/web production builds, 34 notification unit tests, Prettier and `git diff --check` pass. The owned Windows UI verifier fails closed before fixture startup when Redis `127.0.0.1:6379` is occupied, preserving any existing service.
