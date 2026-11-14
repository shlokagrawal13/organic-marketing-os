# Notification center keyboard accessibility

NOTIFY-01K keeps the existing tenant-scoped notification center usable without a
mouse. Opening the bell moves focus to the dialog close control, the dialog is
identified by its visible heading and `aria-modal`, and the trigger exposes the
dialog relationship through `aria-controls`. Pressing Escape closes the open
view and restores focus to the bell. The close control does the same after
discarding an open preference draft through the existing path.

This is a bounded browser interaction increment. It changes no notification
schema, migration, API query, event producer, provider call, external
delivery, realtime transport, durable replay, tenant/role rule or recovery
fixture. Existing filtering, pagination, unread summary, read/unread actions,
preference saves, SSE reconnect and tenant-safe deep links remain unchanged.

The browser regression checks focus on open, Escape dismissal and focus
restoration before exercising the existing notification feed, pagination and
preference assertions. The normal owned verifier must still fail closed before
fixture startup when its Redis safety guard finds `127.0.0.1:6379` occupied;
that existing service is never contacted.
