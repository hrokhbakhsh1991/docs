/**
 * Normalized webhook payload after provider-specific verification + parsing.
 * **No raw card / PAN data** — adapters must redact before logging.
 */
export type ParsedWebhookEvent = {
  /** Provider event id for deduplication (Stripe `evt_*`, Zibal reference, …). */
  providerEventId: string;
  /** Normalized event type, e.g. `payment.succeeded`. */
  type: string;
  /** Optional tenant resolution hint (metadata / path) — binding still server-authoritative. */
  tenantHint?: string;
  /** Links to internal payment / booking row when present. */
  providerPaymentId?: string;
  bookingId?: string;
  /** Fingerprint of raw body for replay / audit (not the body itself). */
  rawPayloadHash?: string;
};

/**
 * Verifies webhook authenticity (HMAC, mTLS, signed payload) and parses a neutral event.
 *
 * TODO: `StripeWebhookVerifier` — construct with webhook signing secret from KMS (never in repo).
 * TODO: `ZibalWebhookVerifier` — merchant key + documented signature scheme.
 */
export interface IWebhookVerifier {
  /**
   * @param headers Normalized lower-case keys optional; adapters may read `stripe-signature` etc.
   */
  verifySignature(
    _headers: Record<string, string | string[] | undefined>,
    _rawBody: Buffer | string
  ): Promise<boolean>;

  parseEvent(_rawBody: unknown): Promise<ParsedWebhookEvent>;
}
