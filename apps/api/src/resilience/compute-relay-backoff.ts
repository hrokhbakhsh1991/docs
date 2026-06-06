export type ComputeRelayBackoffInput = {
  readonly attempt: number;
  readonly baseMs: number;
  readonly maxMs: number;
  readonly jitterRatio?: number;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
};

const DEFAULT_JITTER_RATIO = 0.25;

/**
 * Capped exponential backoff with additive jitter (DEC-111).
 * attempt=1 → ~baseMs; doubles until maxMs.
 */
export function computeRelayBackoff(input: ComputeRelayBackoffInput): number {
  const attempt = Math.max(1, Math.floor(input.attempt));
  const baseMs = Math.max(1, Math.floor(input.baseMs));
  const maxMs = Math.max(baseMs, Math.floor(input.maxMs));
  const jitterRatio = input.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const random = input.random ?? Math.random;

  const exponent = Math.min(30, attempt - 1);
  const uncapped = baseMs * 2 ** exponent;
  const capped = Math.min(maxMs, uncapped);
  const jitterSpan = Math.floor(capped * jitterRatio);
  const jitter = jitterSpan > 0 ? Math.floor(random() * jitterSpan) : 0;
  return Math.min(maxMs, capped + jitter);
}

const DEFAULT_SHUTDOWN_DRAIN_BACKOFF_BASE_MS = 50;
const DEFAULT_SHUTDOWN_DRAIN_BACKOFF_MAX_MS = 500;
const DEFAULT_IDEMPOTENCY_POLL_BASE_MS = 25;
const DEFAULT_IDEMPOTENCY_POLL_MAX_MS = 500;

export function readOutboxPollBackoffMaxMs(baseMs: number): number {
  const raw = process.env.OUTBOX_POLL_BACKOFF_MAX_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return Math.max(baseMs, 8000);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < baseMs) {
    return Math.max(baseMs, 8000);
  }
  return parsed;
}

export function readOutboxShutdownDrainBackoffBaseMs(): number {
  const raw = process.env.OUTBOX_SHUTDOWN_DRAIN_BACKOFF_BASE_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_SHUTDOWN_DRAIN_BACKOFF_BASE_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_SHUTDOWN_DRAIN_BACKOFF_BASE_MS;
}

export function readOutboxShutdownDrainBackoffMaxMs(): number {
  const base = readOutboxShutdownDrainBackoffBaseMs();
  const raw = process.env.OUTBOX_SHUTDOWN_DRAIN_BACKOFF_MAX_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_SHUTDOWN_DRAIN_BACKOFF_MAX_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= base ? parsed : DEFAULT_SHUTDOWN_DRAIN_BACKOFF_MAX_MS;
}

export function readHttpIdempotencyPollBaseMs(): number {
  const raw = process.env.HTTP_IDEMPOTENCY_POLL_BASE_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IDEMPOTENCY_POLL_BASE_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_IDEMPOTENCY_POLL_BASE_MS;
}

export function readHttpIdempotencyPollMaxMs(): number {
  const base = readHttpIdempotencyPollBaseMs();
  const raw = process.env.HTTP_IDEMPOTENCY_POLL_MAX_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IDEMPOTENCY_POLL_MAX_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= base ? parsed : DEFAULT_IDEMPOTENCY_POLL_MAX_MS;
}

export async function sleepRelayBackoffMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
