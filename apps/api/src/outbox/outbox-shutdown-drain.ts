import type { OutboxShutdownDrainResult } from "../server/graceful-shutdown-outbox-flush";
import { countActiveProcessingOutboxRows, countPendingOutboxRows } from "./outbox-queue-counts";
import {
  reclaimStaleProcessingOutboxRows,
  sleepOutboxShutdownDrainBackoff,
} from "./outbox-processing-reclaim";
import { resolveOutboxProcessingReclaimMs } from "./outbox-reclaim-config";

/**
 * Shutdown drain — reclaim stale processing, relay ticks, until quiescent or deadline (F-05 / SD-G1).
 */
export async function drainOutboxRelayOnShutdown(
  deadlineMs: number,
  relayTick: (batchSize: number) => Promise<unknown> = async () => {
    const { processOutboxRelayOnce } = await import("./outbox-relay.js");
    return processOutboxRelayOnce(50);
  }
): Promise<OutboxShutdownDrainResult> {
  const reclaimMs = resolveOutboxProcessingReclaimMs();
  const deadline = Date.now() + deadlineMs;
  let drainAttempt = 0;

  while (Date.now() < deadline) {
    await reclaimStaleProcessingOutboxRows();
    await relayTick(50);

    const pending = await countPendingOutboxRows();
    const activeProcessing = await countActiveProcessingOutboxRows(reclaimMs);
    if (pending === 0 && activeProcessing === 0) {
      return { drained: true, pending: 0, activeProcessing: 0 };
    }

    drainAttempt += 1;
    await sleepOutboxShutdownDrainBackoff(drainAttempt);
  }

  const pending = await countPendingOutboxRows();
  const activeProcessing = await countActiveProcessingOutboxRows(reclaimMs);
  return { drained: false, pending, activeProcessing };
}
