import { isIntegrationSubsystemReady } from "../../health/integration-subsystem-gate";
import { logger } from "../../observability/logger";
import { createIntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import {
  isIntegrationDeliveryWorkerEnabled,
  readIntegrationDeliveryPollIntervalMs,
} from "./integration-delivery-worker-config";
import { processIntegrationDeliveryOnce } from "./process-integration-delivery-once";

export type IntegrationDeliveryWorkerHandle = {
  readonly stop: () => Promise<void>;
};

/**
 * Background worker for integration delivery jobs — separate from outbox relay.
 * Disabled unless INTEGRATION_DELIVERY_WORKER_ENABLED=true.
 */
export function startIntegrationDeliveryWorkerIfEnabled(): IntegrationDeliveryWorkerHandle {
  if (!isIntegrationSubsystemReady()) {
    return { stop: async () => {} };
  }
  if (!isIntegrationDeliveryWorkerEnabled()) {
    return { stop: async () => {} };
  }

  const intervalMs = readIntegrationDeliveryPollIntervalMs();
  const repository = createIntegrationDeliveryRepository();
  let stopped = false;
  let running = false;
  let inFlight: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  const schedule = (): void => {
    if (stopped) {
      return;
    }
    timer = setTimeout(() => {
      void runTick();
    }, intervalMs);
    timer.unref?.();
  };

  const runTick = async (): Promise<void> => {
    if (stopped || running) {
      schedule();
      return;
    }
    running = true;
    inFlight = processIntegrationDeliveryOnce({ deliveryRepository: repository })
      .then((result) => {
        if (result.claimed > 0) {
          logger.info(
            { event: "integration.delivery.tick", ...result },
            "integration delivery tick"
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ event: "integration.delivery.tick.failed", err: message });
      })
      .finally(() => {
        running = false;
        schedule();
      });
    await inFlight;
  };

  void runTick();

  return {
    stop: async () => {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (inFlight !== undefined) {
        await inFlight;
      }
    },
  };
}
