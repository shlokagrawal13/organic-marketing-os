# In-App Notifications (NOTIFY-01A, NOTIFY-01B, NOTIFY-01C, NOTIFY-01D & NOTIFY-01E)

## Overview & Scope
NOTIFY-01 introduces a durable, tenant-bound in-app notification engine driven by real terminal system events:
- **Render Events (NOTIFY-01A)**: `SUCCEEDED`, `FAILED`, `CANCELED` from video render worker and cancellation flows (`category: "RENDER"`).
- **Publishing Events (NOTIFY-01B)**: Terminal publication attempt outcomes `CONFIRMED` (`PUBLISH_SUCCEEDED`) and `REJECTED` (`PUBLISH_FAILED`) recorded in `recordPublicationOutcome` (`category: "PUBLISH"`).
- **AI Generation Events (NOTIFY-01B)**: Asynchronous media generation failures (`AI_GENERATION_FAILED`) recorded in `media-generation-runtime.ts` (`category: "AI"`).
- **Billing & Approval Events (NOTIFY-01C)**: Low credit balance alerts (`CREDITS_LOW`, `category: "BILLING"`) and policy review triggers (`APPROVAL_REQUIRED`, `category: "APPROVAL"`).
- **Notification Center Actions (NOTIFY-01C)**: Mark-as-unread toggle (`POST|PATCH :id/unread`) allowing users/admins to reset read receipts, preserving unread badge counts per MASTER_SPEC §83.
- **Billing & Content Lifecycle Events (NOTIFY-01D)**: Payment failures (`PAYMENT_FAILED`, `category: "BILLING"`), subscription modifications/cancellations (`SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_CANCELED`, `category: "BILLING"`), and content readiness triggers (`CONTENT_READY`, `category: "CONTENT"`).
- **Category Summary Metrics (NOTIFY-01D)**: Aggregated category summary endpoint (`GET /workspaces/:organizationId/notifications/summary`) providing `totalUnread` badge counts and category-level unread breakdowns with role-based scoping and strict tenant isolation.
- **Notification Preferences & Category Muting (NOTIFY-01E)**: Per-user notification category muting and preferences management (`GET|PUT|PATCH /workspaces/:organizationId/notifications/preferences`), automatically filtering muted categories from inbox feeds and unread badge summaries unless explicitly requested (`includeMuted=true` or explicit `category` query parameter).

It provides idempotent creation, tenant-isolated and role-authorized list and single retrieval APIs, category filtering (`?category=RENDER|PUBLISH|AI|BILLING|APPROVAL|CONTENT`), bounded pagination, and single/batch read/unread actions.

In accordance with bounded scope:
- No synthetic or mock notification generation.
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

---

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

### 6. Notification Category Summary (NOTIFY-01D)
`GET /workspaces/:organizationId/notifications/summary`

- Computes aggregated unread counts partitioned by category for the workspace.
- Honors role-based scoping: elevated roles (`OWNER`, `ADMIN`) receive total unread counts across all workspace notifications; non-elevated roles (`EDITOR`, `CREATOR`, `ANALYST`) receive counts for unassigned notifications plus their own assigned notifications.
- Strictly tenant-isolated: requests across tenant boundaries are rejected with HTTP 404.
- Response structure:
```json
{
  "organizationId": "org-uuid",
  "totalUnread": 5,
  "byCategory": {
    "RENDER": 2,
    "BILLING": 1,
    "CONTENT": 2
  }
}
```

### 7. Notification Preferences & Category Muting (NOTIFY-01E)
`GET /workspaces/:organizationId/notifications/preferences`
`PUT /workspaces/:organizationId/notifications/preferences`
`PATCH /workspaces/:organizationId/notifications/preferences`

- **Per-User Configuration**: Allows workspace users to view and update their notification category preferences (e.g., mute specific categories like `RENDER` or `PUBLISH`).
- **Audit-Backed Persistence**: Preference changes are persisted in immutable `AuditLog` events (`action: "notifications.preferences.updated"`), ensuring zero schema drift and full auditability without requiring speculative migration scripts.
- **Feed & Summary Filtering**: By default, notifications in muted categories are automatically filtered out from `GET /notifications` list feeds and `GET /notifications/summary` unread calculations.
- **Opt-in Visibility**:
  - Setting `?includeMuted=true` includes muted category notifications and counts in the response.
  - Specifying an explicit `?category=XYZ` query parameter bypasses muting filters for that targeted category query.
- Request payload:
```json
{
  "mutedCategories": ["RENDER", "AI"]
}
```
- Response structure:
```json
{
  "organizationId": "org-uuid",
  "userId": "user-uuid",
  "mutedCategories": ["RENDER", "AI"],
  "updatedAt": "2026-11-06T03:50:00.000Z"
}
```

---

## Concurrency & Retry Guarantees
- **Deduplication**: Replays of the same terminal event with the same `(organizationId, eventKey)` are ignored via atomic `upsert`, preventing duplicate notifications.
- **Retries**: A retry job generates a distinct `renderId`, correctly yielding a new notification while preserving the terminal failure record of the previous attempt.
- **Concurrent Acknowledgment**: Concurrent read requests atomically set `readAt` and preserve the first acknowledgement timestamp without regression.
