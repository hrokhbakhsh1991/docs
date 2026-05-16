/**
 * Scope for idempotent payment mutations (create intent, refund, capture).
 * Composite key should be enforced in durable storage before hitting a PSP.
 */
export type PaymentIdempotencyScope = {
  tenantId: string;
  /** Logical operation, e.g. `fake:create_payment_intent`. */
  operation: string;
  idempotencyKey: string;
};

/**
 * **Placeholder** — duplicate prevention must be backed by the same durability guarantees
 * as HTTP idempotency (`IdempotencyService` / DB) before any real PSP.
 *
 * - First call: runs `fn`, stores outcome fingerprint.
 * - Duplicate: returns cached outcome, `duplicate: true`.
 *
 * TODO: Wire to shared idempotency store + reconciliation worker for drift detection.
 */
export interface IPaymentIdempotencyPlaceholder {
  executeOnce<T>(
    scope: PaymentIdempotencyScope,
    fn: () => Promise<T>
  ): Promise<{ value: T; duplicate: boolean }>;
}
