const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_BATCH_SIZE = 10;
const MIN_POLL_INTERVAL_MS = 100;

export function isOutboxRelayEnabled(): boolean {
  return process.env.OUTBOX_RELAY_ENABLED?.trim().toLowerCase() === "true";
}

/** DEC-087 — at most one processing row per tenant when true. */
export function isOutboxRelayOrderedPerTenant(): boolean {
  return process.env.OUTBOX_RELAY_ORDERED_PER_TENANT?.trim().toLowerCase() === "true";
}

export function readOutboxPollIntervalMs(): number {
  const raw = process.env.OUTBOX_POLL_INTERVAL_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_POLL_INTERVAL_MS) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return parsed;
}

export function readOutboxRelayBatchSize(): number {
  const raw = process.env.OUTBOX_RELAY_BATCH_SIZE?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_BATCH_SIZE;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(parsed, 100);
}

const DEFAULT_PUBLISH_MAX_ATTEMPTS = 5;

/** Bounded publish attempts before terminal `failed` (DEC-110 / SH-GAP-07). */
export function readOutboxPublishMaxAttempts(): number {
  const raw = process.env.OUTBOX_PUBLISH_MAX_ATTEMPTS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_PUBLISH_MAX_ATTEMPTS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PUBLISH_MAX_ATTEMPTS;
  }
  return Math.min(parsed, 20);
}

const DEFAULT_PUBLISH_CONCURRENCY = 16;

/** Parallel workers per claimed batch (DEC-017). */
export function readOutboxRelayPublishConcurrency(): number {
  const raw = process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_PUBLISH_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PUBLISH_CONCURRENCY;
  }
  return Math.min(parsed, 64);
}
