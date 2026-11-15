# Notification center keyboard accessibility

## NOTIFY-01L focus containment and scroll isolation

The notification dialog now contains keyboard focus while it is open. `Tab`
from the last usable control returns to the first, and `Shift+Tab` from the
first returns to the last. If focus is moved outside the modal while it is
open, the next tab action returns it to the appropriate boundary. The dialog
and its scrollable feed also contain overscroll so keyboard and touch scrolling
does not move the workspace behind the popover.

This is a bounded browser interaction increment. It changes no notification
schema, migration, API query, event producer, provider call, external delivery,
realtime transport, durable replay, tenant/role rule or recovery fixture.
Existing focus-on-open, Escape dismissal, focus restoration, filtering,
pagination, unread summary, read/unread actions, preference saves, SSE
reconnect and tenant-safe deep links remain unchanged.

The browser regression checks both focus boundaries after the existing live
feed has loaded. The normal owned verifier must still fail closed before
fixture startup when its Redis safety guard finds `127.0.0.1:6379` occupied;
that existing service is never contacted.

## NOTIFY-01K focus on open and dismissal

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

Continuity/checkpoint/evidence commit 1d8008670b93d8386aac9e38f1a6c7460e0479c4 passed [run 43711098911](https://github.com/shlokagrawal13/organic-marketing-os/actions/runs/43711098911) across all three jobs and 41 required steps. Artifact names, sizes and API digests are recorded; artifact bytes and embedded reports remain uninspected because artifact/log routes returned proxy/auth 401/403. Final reconciliation commit 3284732 passed run 43712992722 across all three jobs and 41 required steps; the portable package and external receipt are paired.
