import { metricsRegistry } from "../observability/metrics";
import {
  computeRelayBackoff,
  readOutboxShutdownDrainBackoffBaseMs,
  readOutboxShutdownDrainBackoffMaxMs,
  sleepRelayBackoffMs,
} from "../resilience/compute-relay-backoff";
import {
  assertDbCircuitClosed,
  recordDbTransientFailure,
  recordDbTransientSuccess,
} from "./db-circuit-breaker";
import { asTransientDbServiceUnavailableError, isTransientDbError } from "./transient-db-error";

const DEFAULT_TRANSIENT_RETRY_ATTEMPTS = 2;

/** Retries after the first failed attempt (DEC-112). Total attempts = retries + 1. */
export function resolveCanonicalTxTransientRetryAttempts(): number {
  const raw = process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_TRANSIENT_RETRY_ATTEMPTS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TRANSIENT_RETRY_ATTEMPTS;
  }
  return Math.min(parsed, 5);
}

/**
 * Replays a whole transaction closure on classified transient DB errors (DEC-112).
 * Does not retry inside an open Prisma transaction callback.
 */
export async function withTransientTxRetry<T>(run: () => Promise<T>): Promise<T> {
  const maxRetries = resolveCanonicalTxTransientRetryAttempts();
  const maxAttempts = maxRetries + 1;
  const backoffBaseMs = readOutboxShutdownDrainBackoffBaseMs();
  const backoffMaxMs = readOutboxShutdownDrainBackoffMaxMs();

  let lastTransientError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    assertDbCircuitClosed();
    try {
      const result = await run();
      recordDbTransientSuccess();
      if (attempt > 1) {
        metricsRegistry.increment("canonical_tx_transient_retry_total", undefined, attempt - 1);
      }
      return result;
    } catch (error: unknown) {
      if (!isTransientDbError(error)) {
        throw error;
      }

      lastTransientError = error;
      if (attempt < maxAttempts) {
        await sleepRelayBackoffMs(
          computeRelayBackoff({
            attempt,
            baseMs: backoffBaseMs,
            maxMs: backoffMaxMs,
          })
        );
        continue;
      }

      recordDbTransientFailure();
      throw asTransientDbServiceUnavailableError(error);
    }
  }

  recordDbTransientFailure();
  throw asTransientDbServiceUnavailableError(lastTransientError);
}
