# Notification stream error recovery

NOTIFY-01O consumes the existing server-declared `notification-error` SSE
event. The API emits a bounded `retryAfterMs` hint when a stream snapshot
cannot be produced. The browser closes only that failed `EventSource`, shows
`Reconnecting...`, and retries after the hint while retaining the existing
60-second list-polling fallback.

The client never trusts an arbitrary delay. Numeric hints are rounded and
clamped to the existing 1-second minimum and 30-second maximum. Missing,
non-numeric or malformed hints use the normal attempt-based backoff of 1s,
2.5s, 5s, 10s and capped 30s. A scheduled retry is cleared on unmount or
navigation, and the stream reference prevents a server error frame followed
by `onerror` from creating duplicate timers.

This is a bounded web-stream resilience increment. It adds no schema,
migration, provider call, external delivery, durable replay, cross-process
fan-out, recovery fixture or tenant/role contract change. Existing cursor and
unread snapshots, category filtering, preferences, acknowledgement actions,
focus containment, scroll isolation, polling fallback and tenant-safe deep
links remain unchanged.
