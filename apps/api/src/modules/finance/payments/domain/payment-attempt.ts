import type { PaymentStatus } from "./payment-status";

/**
 * In-memory / not-yet-persisted shape for a single payment try against a booking (or similar aggregate).
 * Aligns loosely with gateway `PaymentIntent` ports — **no credentials**, no HTTP.
 */
export type PaymentAttempt = {
  readonly id: string;
  readonly tenantId: string;
  /** Booking aggregate id (`registrations.id`) when the attempt is booking-scoped. */
  readonly bookingId: string;
  /** Stable per logical operation (mirrors gateway idempotency contract). */
  readonly idempotencyKey: string;
  /** Minor units as decimal string (matches `PaymentIntent.amountMinor`). */
  readonly amountMinor: string;
  readonly currency: string;
  status: PaymentStatus;
  /** Opaque provider intent / session id when known — never card PAN/CVC. */
  providerIntentId?: string;
  readonly createdAt: Date;
  updatedAt: Date;
};
