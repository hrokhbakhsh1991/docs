/** Default replay window — matches legacy webhook replay TTL order of magnitude. */
export const PAYMENTS_WEBHOOK_REPLAY_TTL_MS_DEFAULT = 24 * 60 * 60 * 1000;

export function resolvePaymentsWebhookReplayTtlMs(): number {
  const raw = process.env.PAYMENTS_WEBHOOK_REPLAY_TTL_SEC?.trim();
  if (!raw) {
    return PAYMENTS_WEBHOOK_REPLAY_TTL_MS_DEFAULT;
  }
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return PAYMENTS_WEBHOOK_REPLAY_TTL_MS_DEFAULT;
  }
  return seconds * 1000;
}

type ReplayCacheEntry = {
  readonly expiresAtMs: number;
};

let replayCache = new Map<string, ReplayCacheEntry>();

export type ClaimPaymentsWebhookEventResult = "fresh" | "replay";

export type ClaimPaymentsWebhookEventOptions = {
  readonly nowMs?: number;
  readonly ttlMs?: number;
};

/**
 * P5-D-N-007 — idempotent webhook ingress via in-memory replay cache (WH-02).
 * Returns `replay` when eventId was seen within TTL; otherwise records and returns `fresh`.
 */
export function claimPaymentsWebhookEvent(
  eventId: string,
  options: ClaimPaymentsWebhookEventOptions = {}
): ClaimPaymentsWebhookEventResult {
  const normalized = eventId.trim();
  if (normalized.length === 0) {
    return "fresh";
  }

  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? resolvePaymentsWebhookReplayTtlMs();
  const existing = replayCache.get(normalized);
  if (existing !== undefined && existing.expiresAtMs > nowMs) {
    return "replay";
  }

  replayCache.set(normalized, { expiresAtMs: nowMs + ttlMs });
  return "fresh";
}

/** Test seam — reset replay state between specs. */
export function resetPaymentsWebhookReplayCache(): void {
  replayCache = new Map();
}
