import { logger } from "../observability/logger";
import { resolveOutboxRelayErrorCode } from "../observability/log-safety";
import { isOutboxRelayEnabled, readOutboxPollIntervalMs } from "./outbox-relay-config";
import { processOutboxRelayOnce } from "./outbox-relay";

export type OutboxRelayHandle = {
  readonly stop: () => void;
};

/**
 * Starts in-process outbox relay when {@link OUTBOX_RELAY_ENABLED} is true (DEC-004).
 */
export function startOutboxRelayIfEnabled(): OutboxRelayHandle {
  if (!isOutboxRelayEnabled()) {
    return { stop: () => {} };
  }

  const intervalMs = readOutboxPollIntervalMs();
  let running = false;

  const tick = (): void => {
    if (running) {
      return;
    }
    running = true;
    void processOutboxRelayOnce()
      .then((result) => {
        if (result.published > 0 || result.failed > 0) {
          logger.info({ event: "outbox.relay.tick", ...result }, "outbox relay tick");
        }
      })
      .catch((error: unknown) => {
        logger.warn(
          { event: "outbox.relay.error", error_code: resolveOutboxRelayErrorCode(error) },
          "outbox relay tick failed"
        );
      })
      .finally(() => {
        running = false;
      });
  };

  tick();
  const interval = setInterval(tick, intervalMs);
  interval.unref?.();

  logger.info(
    { event: "outbox.relay.start", intervalMs },
    "outbox relay started (OUTBOX_RELAY_ENABLED=true)"
  );

  return {
    stop: () => {
      clearInterval(interval);
    },
  };
}
