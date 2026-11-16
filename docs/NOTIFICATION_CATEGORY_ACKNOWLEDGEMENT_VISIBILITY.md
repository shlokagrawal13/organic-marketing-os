# NOTIFY-01N category acknowledgement and deep-link retry safety

## Scope

The notification center keeps the unread badge sourced from the existing
tenant-scoped summary endpoint. When a category is selected, the feed response
also supplies that category's unread count. The **Mark all ... as read** action
is shown only when the selected category still has unread notifications; the
**All categories** action continues to use the summary unread count.

This prevents a filtered view from offering a no-op acknowledgement after that
category has already been read, while preserving the existing tenant, role,
muting, read/unread, pagination, preferences, stream and deep-link contracts.
If an unread deep-link notification cannot be acknowledged, the panel remains
open and navigation is deferred so the user can retry. No schema, migration,
producer, provider, delivery, recovery or transport behavior changes.

## Verification

The notification browser regression acknowledges the publishing category while
the render category remains unread, confirms the filtered acknowledgement action
disappears after the category is clear, and confirms the global action remains
available when switching back to **All categories**.

The deep-link regression forces one acknowledgement failure, verifies that the
popover and unread state remain in place, then retries successfully and verifies
the tenant-safe destination opens.
