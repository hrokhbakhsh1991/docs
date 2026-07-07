const DEFAULT_RECLAIM_MS = 120_000;

/** `INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS` — stale `processing` TTL for delivery jobs. */
export function resolveIntegrationDeliveryProcessingReclaimMs(): number {
  const raw = process.env.INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS?.trim();
  if (!raw) {
    return DEFAULT_RECLAIM_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECLAIM_MS;
}
