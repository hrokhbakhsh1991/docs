import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../db/background-admin-client";
import { metricsRegistry } from "../observability/metrics";

const DEFAULT_RECLAIM_MS = 120_000;

/** `HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS` — lease duration + legacy createdAt fallback TTL. */
export function resolveHttpIdempotencyProcessingReclaimMs(): number {
  const raw = process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS?.trim();
  if (!raw) {
    return DEFAULT_RECLAIM_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECLAIM_MS;
}

/**
 * Deletes expired `processing` HttpIdempotencyRecord rows so clients can retry.
 *
 * New writers: reclaim when `lease_until < now()`.
 * Legacy rows (`lease_until IS NULL`, old pods): reclaim when `created_at < now() - TTL`.
 *
 * Finance (and other) mutations under runIdempotentHttpMutation must be retry-safe after reclaim.
 */
export async function reclaimStaleProcessingHttpIdempotencyRecords(
  reclaimMs = resolveHttpIdempotencyProcessingReclaimMs()
): Promise<number> {
  const now = new Date();
  const legacyCutoff = new Date(Date.now() - reclaimMs);
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_HTTP_IDEMPOTENCY_RECLAIM);
  const result = await admin.httpIdempotencyRecord.deleteMany({
    where: {
      status: "processing",
      OR: [
        { leaseUntil: { lt: now } },
        { AND: [{ leaseUntil: null }, { createdAt: { lt: legacyCutoff } }] },
      ],
    },
  });

  if (result.count > 0) {
    metricsRegistry.increment("http_idempotency_processing_reclaimed_total", undefined, result.count);
  }

  return result.count;
}
