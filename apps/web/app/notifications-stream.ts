export const NOTIFICATION_STREAM_RETRY_DELAYS_MS = [
  1000, 2500, 5000, 10000, 30000,
] as const;

export const NOTIFICATION_STREAM_MIN_RETRY_DELAY_MS =
  NOTIFICATION_STREAM_RETRY_DELAYS_MS[0];
export const NOTIFICATION_STREAM_MAX_RETRY_DELAY_MS =
  NOTIFICATION_STREAM_RETRY_DELAYS_MS.at(-1)!;

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

/**
 * Applies a server-declared retry hint without allowing a reconnect storm or
 * an unbounded client-side delay. Invalid hints retain the normal attempt
 * backoff so the optional stream remains safe when an intermediary sends a
 * malformed error frame.
 */
export function notificationStreamRetryDelayForHint(
  retryAfterMs: unknown,
  attempt: number,
) {
  const fallback = notificationStreamRetryDelay(attempt);
  if (typeof retryAfterMs !== "number" || !Number.isFinite(retryAfterMs)) {
    return fallback;
  }
  return Math.min(
    NOTIFICATION_STREAM_MAX_RETRY_DELAY_MS,
    Math.max(NOTIFICATION_STREAM_MIN_RETRY_DELAY_MS, Math.round(retryAfterMs)),
  );
}
