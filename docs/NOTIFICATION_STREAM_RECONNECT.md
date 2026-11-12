# NOTIFY-01H bounded live-stream reconnect

NOTIFY-01G added a tenant/role-guarded SSE snapshot stream with a 60-second server lifetime and a 60-second browser polling fallback. NOTIFY-01H makes transient stream failures recoverable without changing the server contract.

## Behavior

- The browser closes the failed EventSource before scheduling another connection.
- Retry delays are 1, 2.5, 5, 10 and 30 seconds; later attempts stay at 30 seconds.
- The panel exposes Connecting..., Live updates, Reconnecting... and Auto-refresh enabled states.
- The existing 60-second list poll continues during reconnect attempts.
- Cleanup aborts list requests, clears retry timers and closes the current Source.
- Snapshot payloads, tenant/role guards, muted-category scope and the server's 60-second bound are unchanged.

The increment deliberately leaves durable replay, cross-process fan-out, external delivery and delivery-SLO acceptance open. The pure backoff contract is covered by tests/notifications.test.ts; the transient-failure browser path is covered by tests/ui/notifications.spec.ts.
