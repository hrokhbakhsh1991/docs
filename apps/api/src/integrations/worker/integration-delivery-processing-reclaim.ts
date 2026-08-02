import {
  BACKGROUND_ADMIN_REASON,
  getBackgroundAdminClient,
} from "../../db/background-admin-client";
import { metricsRegistry } from "../../observability/metrics";

import { resolveIntegrationDeliveryProcessingReclaimMs } from "./integration-delivery-reclaim-config";

function staleProcessingWhere(cutoff: Date) {
  return {
    status: "processing" as const,
    OR: [{ processedAt: { lt: cutoff } }, { processedAt: null, createdAt: { lt: cutoff } }],
  };
}

/**
 * Resets stale `processing` integration delivery jobs to `pending` after crash/HMR mid-tick.
 * Claim timestamp is `processed_at` (set on claim, same pattern as outbox relay DEC-071).
 */
export async function reclaimStaleProcessingIntegrationDeliveryJobs(
  reclaimMs = resolveIntegrationDeliveryProcessingReclaimMs(),
): Promise<number> {
  const cutoff = new Date(Date.now() - reclaimMs);
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_INTEGRATION_WORKER);
  const result = await admin.integrationDeliveryJob.updateMany({
    where: staleProcessingWhere(cutoff),
    data: {
      status: "pending",
      processedAt: null,
    },
  });

  if (result.count > 0) {
    metricsRegistry.increment(
      "integration_delivery_processing_reclaimed_total",
      undefined,
      result.count,
    );
  }

  return result.count;
}
