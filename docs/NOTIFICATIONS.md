# In-App Notifications (NOTIFY-01A through NOTIFY-01N)

> NOTIFY-01N is the current bounded increment: category filters expose existing unread counts, filtered read-all hides when the selected feed is clear, and failed unread acknowledgements keep the panel open for retry. Local 34/34 focused notification units and 5/5 browser cases pass; implementation `58ef05d` is pushed and exact three-job CI is pending. See [category acknowledgement design](NOTIFICATION_CATEGORY_ACKNOWLEDGEMENT_VISIBILITY.md) and [QA evidence](qa/notify01n-evidence.json).

> NOTIFY-01L is the current bounded increment: keyboard focus now stays inside the open notification dialog, Tab and Shift+Tab wrap between usable controls, and the dialog/feed contain overscroll. Implementation commit 7b08fe33c2bd8efd7f7b06f3fc504ca9aac07205 passed local Prisma/API/web builds, 34/34 focused notification tests, formatting and diff checks. Continuity/checkpoint/evidence commit 1d8008670b93d8386aac9e38f1a6c7460e0479c4 passed [run 43711098911](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43711098911), and final reconciliation commit 3284732 passed [run 43712992722](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43712992722) across all three jobs and 41 required steps; final package and external receipt are paired. See [accessibility design](NOTIFICATION_ACCESSIBILITY.md) and [QA evidence](qa/notify01l-evidence.json).
> NOTIFY-01K was the preceding bounded increment: the notification dialog now has deterministic keyboard focus on open, Escape dismissal and focus restoration to the bell, with explicit dialog semantics. Implementation commit 23d4f0913b66795c4ee62e1f8b4492dbf3cb6720 passed [run 43643899707](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43643899707); continuity/checkpoint/evidence commit 0dfcd0105aef26645f955f4c7e142bc7b4debe13 passed [run 43705123066](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43705123066) across all three jobs and all 41 required steps. The portable source package and final external receipt are paired outside the repository. See [accessibility design](NOTIFICATION_ACCESSIBILITY.md) and [QA evidence](qa/notify01k-evidence.json).

> NOTIFY-01I exact-source closure: implementation commit `1c00b201a7be10687a1f39897eb4d74f0155fa15` / [run 43588517881](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43588517881) passed, followed by continuity commit `d0116c0472129b4ec97f379f9b0371243a493972` / [run 43622753095](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43622753095) with all three jobs and all 41 required steps. The current package and external receipt record the continuity source hash and final artifact metadata; artifact bytes/reports remain uninspected because authenticated downloads were blocked.
> NOTIFY-01D exact-source closure: commit `e6fbd33ce79b590bd34462f5306585d39a542214` / [run 43030351133](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43030351133) passed all three jobs and all 41 required steps. The bounded lifecycle increment is closed; see [QA evidence](qa/notify01d-evidence.json) for artifact metadata and the proxy download gap.

> NOTIFY-01J exact-source closure: implementation commit 66d8782f5b8c0a6df21384a4a611597bdaf6e2f5 passed [run 43636741527](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43636741527), followed by continuity commit 79323d0d24663466cb7a4277f14aef464ed6c745 / [run 43639145310](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43639145310) with all three jobs and all 41 required steps. The portable source package and final external receipt are paired outside the repository; artifact bytes/reports remain uninspected because authenticated routes returned proxy 401/403. See [feed filtering design](NOTIFICATION_FEED_FILTERING.md) and [QA evidence](qa/notify01j-evidence.json).

## Overview & Scope
NOTIFY-01 introduces a durable, tenant-bound in-app notification engine driven by real terminal system events:
- **Render Events (NOTIFY-01A)**: `SUCCEEDED`, `FAILED`, `CANCELED` from video render worker and cancellation flows (`category: "RENDER"`).
- **Publishing Events (NOTIFY-01B)**: Terminal publication attempt outcomes `CONFIRMED` (`PUBLISH_SUCCEEDED`) and `REJECTED` (`PUBLISH_FAILED`) recorded in `recordPublicationOutcome` (`category: "PUBLISH"`).
- **AI Generation Events (NOTIFY-01B)**: Asynchronous media generation failures (`AI_GENERATION_FAILED`) recorded in `media-generation-runtime.ts` (`category: "AI"`).
- **Billing & Approval Events (NOTIFY-01C)**: Low credit balance alerts (`CREDITS_LOW`, `category: "BILLING"`) are emitted atomically when the immutable ledger crosses the configured threshold; policy review triggers (`APPROVAL_REQUIRED`, `category: "APPROVAL"`) are emitted when a YouTube policy review is completed and owner/admin scheduling approval is still required.
- **Notification Center Actions (NOTIFY-01C)**: Mark-as-unread toggle (`POST|PATCH :id/unread`) allowing users/admins to reset read receipts, preserving unread badge counts per MASTER_SPEC §83.

- **Billing & Content Lifecycle Events (NOTIFY-01D)**: Verified billing webhooks emit payment-failure and subscription-change notifications, while content transitions into review emit revision-bound content-ready notifications.
- **Category Summary Metrics (NOTIFY-01D)**: `GET /workspaces/:organizationId/notifications/summary` returns tenant- and role-scoped unread totals by category.
- **Notification Preferences & Category Muting (NOTIFY-01E)**: Per-user notification category muting and preferences management (`GET|PUT|PATCH /workspaces/:organizationId/notifications/preferences`) automatically filters muted categories from inbox feeds and unread badge summaries unless explicitly requested (`includeMuted=true` or an explicit `category` query parameter).
- **Notification Preference Controls (NOTIFY-01F)**: The workspace notification center exposes an accessible preferences panel backed by the NOTIFY-01E endpoints. Users can inspect and select muted categories, save explicitly, and immediately see the feed and unread badge refresh with the saved filter. Back, Cancel and close discard unsaved choices; the browser regression prevents stale local preferences from reappearing after reopening.
- **Bounded Notification Live Updates (NOTIFY-01G)**: The notification center may open a tenant- and role-guarded SSE stream. The stream emits only a change cursor plus total/unread counts, checks the existing notification scope every two seconds, closes after 60 seconds and lets the browser refetch the existing guarded list. A 60-second polling fallback remains in place.
- **Tenant-safe notification deep links (NOTIFY-01I)**: Clicking an unread notification acknowledges it, closes the popover and resolves only a same-workspace relative link into the existing content, render, media, publication/calendar or billing view. Content and render identifiers are preserved; render jobs are re-read through the tenant-scoped API. Cross-workspace, external, malformed and unknown paths fail closed.
- **Notification Feed Filtering & Pagination (NOTIFY-01J)**: The notification center exposes an All/category selector and bounded 20-item pages using the existing tenant-bound list API; Load more appends pages while the unread badge stays summary-based.
- **Keyboard Focus Containment (NOTIFY-01L)**: The open notification dialog wraps Tab and Shift+Tab within usable controls and contains overscroll in the dialog and feed; no data or transport contract changes.

It provides idempotent creation, tenant-isolated and role-authorized list and single retrieval APIs, category filtering (`?category=RENDER|PUBLISH|AI|BILLING|APPROVAL|CONTENT`), bounded pagination, and single/batch read/unread actions.

In accordance with bounded scope:
- No synthetic or mock notification generation is used by the application. Unit tests may call event creators directly to verify their idempotent contracts.
- No external delivery channels (email, SMS, or mobile push).
- No realtime WebSocket or SLO guarantees claimed.
- `AuditLog` remains append-only and immutable; notifications are stored in a dedicated mutable read-receipt model (`Notification`).

### NOTIFY-01F Preference Controls

The settings icon in the notification popover opens a tenant/user-scoped preferences view. Each category uses a native checkbox with a short description. Opening the view reads the current server values; toggles are local draft state only. **Save preferences** sends the complete selected category set through the existing tenant/user-bound update endpoint. A successful response returns to the feed and refreshes both the list and unread summary. **Back**, **Cancel**, and the close button discard the local draft without a request, preserving the explicit-save contract and avoiding an accidental preference write during navigation.

---

## Data Model & Schema

Migration `202611030001_in_app_notifications` introduces the `Notification` table:

```prisma
model Notification {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  type           String
  category       String       @default("RENDER")
  title          String
  body           String
  link           String?
  entityType     String?
  entityId       String?
  eventKey       String
  data           Json         @default("{}")
  readAt         DateTime?
  readBy         String?
  createdAt      DateTime     @default(now())

  @@unique([organizationId, eventKey])
  @@index([organizationId, createdAt])
  @@index([organizationId, userId, readAt])
}
```

### Key Schema Properties
1. **Deduplication Key (`eventKey`)**:
   Terminal render events construct an event key: `render:${renderId}:${status}`.
   The compound unique constraint `@@unique([organizationId, eventKey])` guarantees database-level idempotency against duplicate worker messages, retries, or concurrent dispatcher completions.
2. **Reverse Chronological Index**:
   `@@index([organizationId, createdAt])` optimizes reverse-chronological paginated listing.
3. **User & Unread Status Index**:
   `@@index([organizationId, userId, readAt])` enables efficient unread filtering and badge counts.

---

## Real Terminal Render Event Triggers

Notifications are emitted strictly upon reaching terminal render status:

1. **`render-worker.ts` (Success)**:
   When video rendering succeeds and the output asset is uploaded, `createRenderNotification(tx, ...)` executes inside the database transaction alongside the terminal `AuditLog` creation:
   - Type: `RENDER_SUCCEEDED`
   - Category: `RENDER`
   - Event Key: `render:${job.id}:SUCCEEDED`
   - Title: `Render complete`
   - Body: `Video render for "{title}" is ready for review.`

2. **`render-worker.ts` (Failure)**:
   When rendering encounters an unrecoverable worker failure, `createRenderNotification(tx, ...)` executes inside the failure transaction alongside the failure status update:
   - Type: `RENDER_FAILED`
   - Category: `RENDER`
   - Event Key: `render:${job.id}:FAILED`
   - Title: `Render failed`
   - Body: `Video render for "{title}" failed: {error}`

3. **`renders.ts` (Cancellation)**:
   When an authorized workspace user cancels an in-flight or queued render job, `createRenderNotification(tx, ...)` executes inside the cancellation transaction alongside the cancellation `AuditLog` entry:
   - Type: `RENDER_CANCELED`
   - Category: `RENDER`
   - Event Key: `render:${job.id}:CANCELED`
   - Title: `Render canceled`
   - Body: `Video render for "{title}" was canceled.`

4. **`publication-attempts.ts` (Publishing Terminal Outcomes - NOTIFY-01B)**:
   When a publication attempt resolves in `recordPublicationOutcome`, `createPublishNotification(tx, ...)` executes inside the outcome transaction alongside the outcome `AuditLog` entry:
   - Confirmed Success:
     - Type: `PUBLISH_SUCCEEDED`
     - Category: `PUBLISH`
     - Event Key: `publish:${attempt.id}:confirmed`
     - Title: `Publishing successful`
     - Body: `Publication attempt completed successfully.`
   - Rejected Failure:
     - Type: `PUBLISH_FAILED`
     - Category: `PUBLISH`
     - Event Key: `publish:${attempt.id}:rejected`
     - Title: `Publishing failed`
     - Body: `Publication attempt failed: {error}`

5. **`media-generation-runtime.ts` (AI Generation Failures - NOTIFY-01B)**:
   When an asynchronous media generation job fails during provider execution or unrecoverable error in `finish()`, an in-app notification is created inside the failure transaction:
   - Type: `AI_GENERATION_FAILED`
   - Category: `AI`
   - Event Key: `ai:${job.id}:failed`
   - Title: `AI generation failed`
   - Body: `Media generation failed: {error}`

6. **Credit ledger crossing (NOTIFY-01C)**:
   `packages/core/credits.ts` writes a workspace-wide `CREDITS_LOW` row in the same transaction as a reservation, settlement or grant when the available balance moves from above `CREDITS_LOW_THRESHOLD` to at or below it, or from exactly the threshold to below it. The default threshold is 20; the event key includes the workspace, threshold and resulting balance.

7. **YouTube policy review completion (NOTIFY-01C)**:
   `publications.ts` writes an `APPROVAL_REQUIRED` row in the same transaction as the first immutable policy review. The notification is broadcast to the workspace because only owner/admin roles may schedule the reviewed publication.

---

8. **Billing lifecycle webhooks (NOTIFY-01D)**:
   Verified `subscription.upserted` and `subscription.canceled` events emit `SUBSCRIPTION_UPDATED` or `SUBSCRIPTION_CANCELED` inside the same transaction that applies the billing state. Subscription event keys include the signed provider event ID so later changes are not collapsed. `invoice.payment_failed` is tenant-bound by the signed event payload and emits `PAYMENT_FAILED` without granting or rewriting credits. Replays use the event key and remain idempotent.

9. **Content review transition (NOTIFY-01D)**:
   A successful `DRAFT → REVIEW` transition emits a workspace-wide `CONTENT_READY` notification in the same transaction as the content state and audit row. The event key includes the immutable content revision (`content:<id>:revision:<revision>:ready`), so later revisions create distinct notifications while retries do not duplicate a revision.

## Authorization & Role Matrix

The API controller is mounted at `/workspaces/:organizationId/notifications` and guarded by `TenantGuard`:

| Role | Access Level | Scoping Behavior |
| :--- | :--- | :--- |
| `OWNER` | Full | Access to all workspace notifications; optional `mine=true` filter |
| `ADMIN` | Full | Access to all workspace notifications; optional `mine=true` filter |
| `EDITOR` | Scoped | Access restricted to notifications addressed to user or unassigned broadcasts (`userId === null`) |
| `CREATOR` | Scoped | Access restricted to notifications addressed to user or unassigned broadcasts (`userId === null`) |
| `ANALYST` | Scoped | Access restricted to notifications addressed to user or unassigned broadcasts (`userId === null`) |
| `CLIENT` | Denied | HTTP 403 Forbidden |
| Non-member | Denied | HTTP 404 Not Found (TenantGuard boundary) |

---

## API Endpoints

### 1. List Workspace Notifications
`GET /workspaces/:organizationId/notifications`

**Query Parameters:**
- `skip`: Integer, $\ge 0$ (default `0`)
- `take`: Integer, $1 \dots 100$ (default `50`)
- `unreadOnly`: `"true" | "false"` (optional, filters `readAt === null`)
- `category`: String, max 50 chars (optional, e.g. `"RENDER"`)
- `mine`: `"true" | "false"` (optional, for elevated roles)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "organizationId": "org-uuid",
      "userId": "user-uuid",
      "type": "RENDER_SUCCEEDED",
      "category": "RENDER",
      "title": "Render complete",
      "body": "Video render for \"Intro\" is ready for review.",
      "link": "/workspaces/org-uuid/renders/render-uuid",
      "entityType": "RENDER_JOB",
      "entityId": "render-uuid",
      "eventKey": "render:render-uuid:SUCCEEDED",
      "data": { "renderId": "render-uuid", "status": "SUCCEEDED" },
      "readAt": null,
      "readBy": null,
      "createdAt": "2026-11-04T00:00:00.000Z"
    }
  ],
  "total": 1,
  "unreadCount": 1,
  "skip": 0,
  "take": 50
}
```

### 2. Get Single Notification
`GET /workspaces/:organizationId/notifications/:id`

- Returns the notification record.
- Returns 404 if notification does not exist or belongs to another tenant.
- Returns 403 if non-elevated user attempts to access a notification assigned to another user.

### 3. Acknowledge Notification Read
`POST /workspaces/:organizationId/notifications/:id/read`
`PATCH /workspaces/:organizationId/notifications/:id/read`

- Idempotently marks notification as read (`readAt = now()`, `readBy = actor.id`).
- Subsequent calls preserve original `readAt` timestamp and return 200 OK.

### 4. Read All Notifications
`POST /workspaces/:organizationId/notifications/read-all`
`POST /workspaces/:organizationId/notifications/read-all?category=PUBLISH`

- Marks all unread notifications within the actor's scope (and matching optional `category` query parameter) as read.
- Returns `{ "acknowledged": <count> }`.

### 5. Mark Notification Unread (NOTIFY-01C)
`POST /workspaces/:organizationId/notifications/:id/unread`
`PATCH /workspaces/:organizationId/notifications/:id/unread`

- Toggles a notification back to unread status (`readAt = null`, `readBy = null`).
- Accurately increments `unreadCount` badge in subsequent queries.
- Idempotent: subsequent calls on an already-unread notification safely return 200 OK.

### 6. Unread Category Summary (NOTIFY-01D)
`GET /workspaces/:organizationId/notifications/summary`

- Returns `totalUnread` and `byCategory` for the current workspace.
- `OWNER` and `ADMIN` roles see all unread workspace notifications; other allowed roles see workspace broadcasts and notifications assigned to their user.
- Tenant membership is enforced by the existing guard and cross-workspace requests return 404.

### 7. Notification Preferences & Category Muting (NOTIFY-01E)
`GET /workspaces/:organizationId/notifications/preferences`
`PUT /workspaces/:organizationId/notifications/preferences`
`PATCH /workspaces/:organizationId/notifications/preferences`

- Preference updates are per-user and tenant-bound; the existing role guard denies CLIENT and non-members.
- Each update appends an immutable `AuditLog` event with action `notifications.preferences.updated`; no schema or migration change is needed.
- The list and unread summary endpoints omit muted categories by default. `includeMuted=true` includes them, while an explicit `category` query reads that category directly.
- The request body is `{ "mutedCategories": ["RENDER", "AI"] }`; at most 20 category strings are accepted.

### 8. Notification Preference Controls (NOTIFY-01F)

The notification bell opens a preferences control that:

- Loads the current user's tenant-bound muted categories only when opened.
- Presents the six supported categories with plain-language descriptions and native checkbox controls.
- Keeps edits local until the user explicitly chooses **Save preferences**.
- Provides **Cancel** and a back action that discard unsaved changes.
- Refreshes the notification list and unread badge after a successful save, so muted categories disappear from the default feed immediately.

This is a UI increment over the existing preference API. It does not add external email/push delivery, realtime transport or a new migration.

### NOTIFY-01I Tenant-safe deep links

The notification center treats persisted links as data rather than arbitrary browser destinations. A resolver accepts only paths under the active `/workspaces/:organizationId` base and maps supported records to existing in-app views. The parent workspace clears stale notification targets during normal navigation, while content and render destinations retain the exact identifier selected by the notification.

Policy-review links use the existing notification `data.contentId` when it is present and otherwise open the publication calendar with a clear notice. Billing links open Credits & usage only for `OWNER` and `ADMIN`; other roles return to the dashboard with an access notice. A render destination first fetches the job through the tenant-scoped API, so stale or foreign IDs fail as normal API not-found responses. No external, cross-tenant or unknown link is navigated.

### 9. Bounded Notification Live Updates (NOTIFY-01G)

`GET /workspaces/:organizationId/notifications/stream`

- The endpoint is guarded by the existing tenant membership and notification role checks. `OWNER` and `ADMIN` receive the workspace scope; other allowed roles receive their own and broadcast notifications.
- The response uses `text/event-stream` and emits `event: notification` only when the scoped latest-record cursor, total count or unread count changes. The `data` object is `{ "cursor": "<createdAt>:<id>", "total": 1, "unreadCount": 1 }`; it contains no notification body, link, private object key or other record payload.
- The server checks the existing notification scope every two seconds and bounds a connection to 60 seconds. Database errors produce a bounded retry hint and complete the stream; the browser changes to fallback status and continues the existing polling path.
- The browser opens the stream only for the enabled notification panel, refetches the existing list on a change event and closes the source during navigation or unmount. This is a bounded in-app transport increment; it does not claim external delivery, durable stream replay, cross-process fan-out or a delivery SLO.
- No schema, migration or notification event producer changed for this increment.

---
## Concurrency & Retry Guarantees
- **Deduplication**: Replays of the same terminal event with the same `(organizationId, eventKey)` are ignored via atomic `upsert`, preventing duplicate notifications.
- **Retries**: A retry job generates a distinct `renderId`, correctly yielding a new notification while preserving the terminal failure record of the previous attempt.
- **Concurrent Acknowledgment**: Concurrent read requests atomically set `readAt` and preserve the first acknowledgement timestamp without regression.

## NOTIFY-01H bounded live-stream reconnect

The browser notification panel keeps its existing EventSource stream optional and bounded. When a connection fails, the failed source is closed and the panel reports **Reconnecting...** while scheduling a retry at 1 second, 2.5 seconds, 5 seconds, 10 seconds, then a capped 30 seconds. The timer is cleared and the source is closed during navigation or unmount. The existing 60-second list polling remains active throughout, so a temporary stream outage cannot stop notification refresh.

This increment does not add durable stream replay, Last-Event-ID, cross-process fan-out, external email/SMS/mobile push, a provider call, a schema/migration or a delivery SLO. It preserves the tenant/role-guarded snapshot contract, cursor/count-only payload, category muting and all existing read/unread and preference behavior. See [the focused evidence](qa/notify01h-evidence.json) and [the implementation design](NOTIFICATION_STREAM_RECONNECT.md).

## NOTIFY-01I tenant-safe notification deep links

The link field already persisted by notification producers is now actionable in the workspace UI. Clicking a notification marks it read when needed, closes the popover and resolves a same-workspace target. Content links open the exact content record, render links open the exact render in Video studio after a tenant-scoped lookup, media links open Asset library, publication links open the calendar and billing links respect the administrator-only Credits view. Policy-review links use their captured content identifier when available.

The resolver rejects absolute, cross-workspace, malformed and unknown paths before any navigation. This increment changes no schema, migration, event producer, provider, external delivery, durable replay, cross-process fan-out or realtime delivery SLO. See [the deep-link design](NOTIFICATION_DEEP_LINKS.md) and [QA evidence](qa/notify01i-evidence.json).

## NOTIFY-01M filtered notification acknowledgement

The notification center keeps the existing workspace-scoped **Mark all as
read** action for **All categories**. When a user selects a category, the
button names that category and sends the existing `category` query to the
tenant-bound read-all endpoint. The selected feed is refreshed after the
acknowledgement, while the unread badge remains sourced from the existing
summary endpoint.

This is a bounded UI wiring increment. It changes no schema, migration,
notification producer, provider call, external delivery, durable replay,
cross-process fan-out, SSE contract, recovery fixture or role/tenant guard.
Muted categories, explicit category reads, read/unread toggles, pagination,
preferences, focus containment, scroll isolation, reconnect and deep links
remain unchanged. See [the filtered acknowledgement design](NOTIFICATION_FILTERED_ACKNOWLEDGEMENT.md)
and [QA evidence](qa/notify01m-evidence.json). Implementation commit 00f97432fe1459b54dbe42378c9e21da8f47ce3 passed exact run 43752790194; continuity commit fd1f025938c197279e9bfc7ec21df39403d9a7f5 passed exact run 43755578622; final reconciliation c47f18baf2dd9c8c5a9ea1ad9b44f16ac37427cd passed exact run 43757868315 across all three jobs and 41 required steps. The portable source package and external receipt are paired outside the repository.
