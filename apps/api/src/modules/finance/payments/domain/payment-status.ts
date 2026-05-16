/**
 * Payment attempt lifecycle (domain). **No PSP calls** — persistence and adapters stay out of this folder.
 *
 * TODO: **Retry policies** — idempotent replays vs new `PaymentAttempt` rows; backoff + max attempts.
 * TODO: **Async capture** — authorized funds with delayed capture windows (scheduler + expiry).
 * TODO: **Dispute / chargeback** — side channel from `captured` (may need new states or parallel dispute aggregate).
 */
export enum PaymentStatus {
  INITIATED = "initiated",
  PENDING = "pending",
  AUTHORIZED = "authorized",
  CAPTURED = "captured",
  FAILED = "failed",
  REFUNDED = "refunded"
}
