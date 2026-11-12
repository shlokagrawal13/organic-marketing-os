export const NOTIFICATION_STREAM_RETRY_DELAYS_MS = [
  1000, 2500, 5000, 10000, 30000,
] as const;

/**
 * Returns a bounded retry delay for the optional notification stream.
 * The attempt index is intentionally capped so a disconnected browser keeps
 * polling without creating an unbounded reconnect storm.
 */
export function notificationStreamRetryDelay(attempt: number) {
  const normalized = Number.isFinite(attempt)
    ? Math.max(0, Math.floor(attempt))
    : 0;
  const index = Math.min(
    normalized,
    NOTIFICATION_STREAM_RETRY_DELAYS_MS.length - 1,
  );
  return NOTIFICATION_STREAM_RETRY_DELAYS_MS[index];
}
