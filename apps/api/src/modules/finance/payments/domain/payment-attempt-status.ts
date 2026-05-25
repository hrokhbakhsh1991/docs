/**
 * In-memory payment **attempt** lifecycle (PSP-style lowercase states).
 * Not persisted on `payments.status` — use {@link PaymentStatus} from `@repo/shared-contracts` for DB rows.
 */
export enum PaymentAttemptStatus {
  INITIATED = "initiated",
  PENDING = "pending",
  AUTHORIZED = "authorized",
  CAPTURED = "captured",
  FAILED = "failed",
  REFUNDED = "refunded",
}
