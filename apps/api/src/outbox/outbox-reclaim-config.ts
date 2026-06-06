const DEFAULT_RECLAIM_MS = 120_000;

/** `OUTBOX_PROCESSING_RECLAIM_MS` — stale `processing` TTL (DEC-071). */
export function resolveOutboxProcessingReclaimMs(): number {
  const raw = process.env.OUTBOX_PROCESSING_RECLAIM_MS?.trim();
  if (!raw) {
    return DEFAULT_RECLAIM_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECLAIM_MS;
}
