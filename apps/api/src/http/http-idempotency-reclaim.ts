import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";

const DEFAULT_RECLAIM_MS = 120_000;

/** `HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS` — stale `processing` TTL for HTTP idempotency rows. */
export function resolveHttpIdempotencyProcessingReclaimMs(): number {
  const raw = process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS?.trim();
  if (!raw) {
    return DEFAULT_RECLAIM_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECLAIM_MS;
}

/**
 * Deletes stale `processing` HttpIdempotencyRecord rows so clients can retry.
 * Finance (and other) mutations under runIdempotentHttpMutation must be retry-safe after reclaim.
 */
export async function reclaimStaleProcessingHttpIdempotencyRecords(
  reclaimMs = resolveHttpIdempotencyProcessingReclaimMs()
): Promise<number> {
  const cutoff = new Date(Date.now() - reclaimMs);
  const admin = getPrismaAdmin();
  const result = await admin.httpIdempotencyRecord.deleteMany({
    where: {
      status: "processing",
      createdAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    metricsRegistry.increment("http_idempotency_processing_reclaimed_total", undefined, result.count);
  }

  return result.count;
}
