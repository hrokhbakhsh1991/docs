const DEFAULT_WINDOW_MS = 60_000;

type Bucket = { timestamps: number[] };

const store = new Map<string, Bucket>();

function pruneTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export type SlidingWindowRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/**
 * In-memory sliding-window limiter (per process). Suitable for BFF routes; resets on deploy.
 */
export function checkSlidingWindowRateLimit(
  key: string,
  options: { limit: number; windowMs?: number; now?: number } = { limit: 30 },
): SlidingWindowRateLimitResult {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options.limit;
  const now = options.now ?? Date.now();

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }

  bucket.timestamps = pruneTimestamps(bucket.timestamps, now, windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = Math.max(1, windowMs - (now - oldest));
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  bucket.timestamps.push(now);
  return { allowed: true };
}

/** Test-only: reset in-memory buckets. */
export function resetSlidingWindowRateLimitStore(): void {
  store.clear();
}
