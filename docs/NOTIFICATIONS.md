# In-App Notifications (NOTIFY-01A, NOTIFY-01B, NOTIFY-01C, NOTIFY-01D, NOTIFY-01E & NOTIFY-01F)

> NOTIFY-01D exact-source closure: commit `e6fbd33ce79b590bd34462f5306585d39a542214` / [run 43030351133](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43030351133) passed all three jobs and all 41 required steps. The bounded lifecycle increment is closed; see [QA evidence](qa/notify01d-evidence.json) for artifact metadata and the proxy download gap.

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
- **Notification Preference Controls (NOTIFY-01F)**: The workspace notification center exposes an accessible preferences panel backed by the NOTIFY-01E endpoints. Users can inspect and select muted categories, save explicitly, cancel local changes, and immediately see the feed and unread badge refresh with the saved filter.

It provides idempotent creation, tenant-isolated and role-authorized list and single retrieval APIs, category filtering (`?category=RENDER|PUBLISH|AI|BILLING|APPROVAL|CONTENT`), bounded pagination, and single/batch read/unread actions.

In accordance with bounded scope:
- No synthetic or mock notification generation is used by the application. Unit tests may call event creators directly to verify their idempotent contracts.
- No external delivery channels (email, SMS, or mobile push).
- No realtime WebSocket or SLO guarantees claimed.
- `AuditLog` remains append-only and immutable; notifications are stored in a dedicated mutable read-receipt model (`Notification`).

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

---
## Concurrency & Retry Guarantees
- **Deduplication**: Replays of the same terminal event with the same `(organizationId, eventKey)` are ignored via atomic `upsert`, preventing duplicate notifications.
- **Retries**: A retry job generates a distinct `renderId`, correctly yielding a new notification while preserving the terminal failure record of the previous attempt.
- **Concurrent Acknowledgment**: Concurrent read requests atomically set `readAt` and preserve the first acknowledgement timestamp without regression.
