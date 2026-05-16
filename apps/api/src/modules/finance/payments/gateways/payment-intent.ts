/**
 * Finance port: parameters to create a provider-side payment intent.
 * **No PSP credentials** — transport and signing live in future adapters (Stripe, Zibal, …).
 *
 * Idempotency: `idempotencyKey` must be stable per logical operation so retries / duplicates
 * map to the same provider intent (see {@link IPaymentIdempotencyPlaceholder}).
 */
export type PaymentIntent = {
  tenantId: string;
  /** Caller-supplied idempotency key (e.g. `Idempotency-Key` header mirrored server-side). */
  idempotencyKey: string;
  amountMinor: string;
  currency: string;
  /** Booking aggregate id (`registrations.id` in this codebase). */
  bookingId: string;
  metadata?: Record<string, string>;
};
