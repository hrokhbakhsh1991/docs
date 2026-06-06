import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";
import {
  computeRelayBackoff,
  readOutboxShutdownDrainBackoffBaseMs,
  readOutboxShutdownDrainBackoffMaxMs,
  sleepRelayBackoffMs,
} from "../resilience/compute-relay-backoff";

import { resolveOutboxProcessingReclaimMs } from "./outbox-reclaim-config";

export { resolveOutboxProcessingReclaimMs } from "./outbox-reclaim-config";

/** Reclaim TTL env: `OUTBOX_PROCESSING_RECLAIM_MS` (see outbox-reclaim-config.ts). */

function staleProcessingWhere(cutoff: Date) {
  return {
    status: "processing" as const,
    OR: [{ processedAt: { lt: cutoff } }, { processedAt: null, createdAt: { lt: cutoff } }],
  };
}

/**
 * Heals OZ-02: stale `processing` rows whose event was already claimed by idempotent consumers → `done`.
 */
export async function healPublishedProcessingOutboxRows(
  reclaimMs = resolveOutboxProcessingReclaimMs()
): Promise<number> {
  const cutoff = new Date(Date.now() - reclaimMs);
  const admin = getPrismaAdmin();
  const healed = await admin.$executeRaw`
    UPDATE outbox_events AS o
    SET status = 'done', processed_at = NOW()
    WHERE o.status = 'processing'
      AND o.domain_event_id IS NOT NULL
      AND (
        (o.processed_at IS NOT NULL AND o.processed_at < ${cutoff})
        OR (o.processed_at IS NULL AND o.created_at < ${cutoff})
      )
      AND EXISTS (
        SELECT 1
        FROM processed_domain_events AS p
        WHERE p.tenant_id = o.tenant_id
          AND p.domain_event_id = o.domain_event_id
      )
  `;

  const count = Number(healed);
  if (count > 0) {
    metricsRegistry.increment("outbox_publish_done_healed_total", undefined, count);
  }

  return count;
}

/**
 * Resets stale `processing` rows to `pending` so relay can reclaim after crash/deploy (DEC-071 / F-01).
 * Runs OZ-02 heal first (DEC-072). Uses `processed_at` as claim timestamp when set.
 */
export async function reclaimStaleProcessingOutboxRows(
  reclaimMs = resolveOutboxProcessingReclaimMs()
): Promise<number> {
  await healPublishedProcessingOutboxRows(reclaimMs);

  const cutoff = new Date(Date.now() - reclaimMs);
  const admin = getPrismaAdmin();
  const result = await admin.outboxEvent.updateMany({
    where: staleProcessingWhere(cutoff),
    data: {
      status: "pending",
      processedAt: null,
    },
  });

  if (result.count > 0) {
    metricsRegistry.increment("outbox_processing_reclaimed_total", undefined, result.count);
  }

  return result.count;
}

/** Shutdown drain loop backoff between iterations (DEC-111). */
export async function sleepOutboxShutdownDrainBackoff(attempt: number): Promise<void> {
  await sleepRelayBackoffMs(
    computeRelayBackoff({
      attempt,
      baseMs: readOutboxShutdownDrainBackoffBaseMs(),
      maxMs: readOutboxShutdownDrainBackoffMaxMs(),
    })
  );
}
