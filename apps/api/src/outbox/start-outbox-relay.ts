import { logger } from "../observability/logger";
import { resolveOutboxRelayErrorCode } from "../observability/log-safety";
import {
  computeRelayBackoff,
  readOutboxPollBackoffMaxMs,
} from "../resilience/compute-relay-backoff";
import { isOutboxRelayEnabled, readOutboxPollIntervalMs } from "./outbox-relay-config";
import { processOutboxRelayOnce } from "./outbox-relay";
import { recordOutboxRelayTickSkipped } from "./outbox-relay-tick-monitor";

export type OutboxRelayHandle = {
  /** Clears poll timer and awaits any in-flight relay tick (SD-G2 / DEC-076). */
  readonly stop: () => Promise<void>;
};

/**
 * Starts in-process outbox relay when {@link OUTBOX_RELAY_ENABLED} is true (DEC-004).
 * Poll cadence uses capped exponential backoff on tick errors (DEC-111).
 */
export function startOutboxRelayIfEnabled(): OutboxRelayHandle {
  if (!isOutboxRelayEnabled()) {
    return { stop: async () => {} };
  }

  const baseIntervalMs = readOutboxPollIntervalMs();
  const backoffMaxMs = readOutboxPollBackoffMaxMs(baseIntervalMs);
  let running = false;
  let stopped = false;
  let failureStreak = 0;
  let inFlightTick: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  const schedule = (delayMs: number): void => {
    if (stopped) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      runTick();
    }, delayMs);
    timer.unref?.();
  };

  const runTick = (): void => {
    if (stopped) {
      return;
    }
    if (running) {
      recordOutboxRelayTickSkipped();
      return;
    }
    running = true;
    let nextDelay = baseIntervalMs;

    inFlightTick = processOutboxRelayOnce()
      .then((result) => {
        if (result.failed > 0) {
          failureStreak += 1;
          nextDelay = computeRelayBackoff({
            attempt: failureStreak,
            baseMs: baseIntervalMs,
            maxMs: backoffMaxMs,
          });
        } else {
          failureStreak = 0;
          nextDelay = baseIntervalMs;
        }

        if (result.published > 0 || result.failed > 0) {
          logger.info({ event: "outbox.relay.tick", ...result }, "outbox relay tick");
        }
      })
      .catch((error: unknown) => {
        failureStreak += 1;
        nextDelay = computeRelayBackoff({
          attempt: failureStreak,
          baseMs: baseIntervalMs,
          maxMs: backoffMaxMs,
        });
        logger.warn(
          { event: "outbox.relay.error", error_code: resolveOutboxRelayErrorCode(error) },
          "outbox relay tick failed"
        );
      })
      .finally(() => {
        running = false;
        if (!stopped) {
          schedule(nextDelay);
        }
      });
  };

  runTick();

  logger.info(
    { event: "outbox.relay.start", intervalMs: baseIntervalMs, backoffMaxMs },
    "outbox relay started (OUTBOX_RELAY_ENABLED=true)"
  );

  return {
    stop: async () => {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (inFlightTick !== undefined) {
        await inFlightTick;
      }
    },
  };
}
