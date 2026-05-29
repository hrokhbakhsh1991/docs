import { ConflictException } from "@nestjs/common";
import { PaymentStatus } from "./payment.types";

/**
 * Canonical payment **intent** lifecycle (PSP-agnostic).
 * Persisted `payments.status` uses {@link PaymentStatus}; map via {@link paymentStatusToIntentLifecycle}.
 *
 * **Rules:** transitions are deterministic and single-step only — no skipping (e.g. CREATED→CAPTURED).
 */
export const PaymentIntentLifecycleStatus = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  CAPTURED: "CAPTURED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED"
} as const;

export type PaymentIntentLifecycleStatus =
  (typeof PaymentIntentLifecycleStatus)[keyof typeof PaymentIntentLifecycleStatus];

const ALLOWED_NEXT: Readonly<Record<PaymentIntentLifecycleStatus, readonly PaymentIntentLifecycleStatus[]>> = {
  [PaymentIntentLifecycleStatus.CREATED]: [PaymentIntentLifecycleStatus.PENDING],
  [PaymentIntentLifecycleStatus.PENDING]: [
    PaymentIntentLifecycleStatus.CAPTURED,
    PaymentIntentLifecycleStatus.FAILED
  ],
  [PaymentIntentLifecycleStatus.CAPTURED]: [PaymentIntentLifecycleStatus.REFUNDED],
  [PaymentIntentLifecycleStatus.FAILED]: [],
  [PaymentIntentLifecycleStatus.REFUNDED]: []
} as const;

const TRANSITION_INVALID = {
  error: {
    code: "PAYMENT_STATUS_TRANSITION_INVALID",
    message: "Requested payment intent transition is not allowed"
  }
} as const;

/** Maps persisted payment row status to intent lifecycle (excludes `Cancelled`, which is not an intent state). */
export function paymentStatusToIntentLifecycle(
  status: PaymentStatus
): PaymentIntentLifecycleStatus | null {
  switch (status) {
    case PaymentStatus.PENDING:
      return PaymentIntentLifecycleStatus.PENDING;
    case PaymentStatus.PAID:
      return PaymentIntentLifecycleStatus.CAPTURED;
    case PaymentStatus.FAILED:
      return PaymentIntentLifecycleStatus.FAILED;
    case PaymentStatus.REFUNDED:
      return PaymentIntentLifecycleStatus.REFUNDED;
    case PaymentStatus.CANCELLED:
      return null;
    default:
      return null;
  }
}

/**
 * Validates a single-step intent transition. Idempotent `from === to` is allowed (replay).
 * @throws {@link ConflictException} when the edge is not in the lifecycle graph.
 */
export function assertAllowedPaymentIntentLifecycleTransition(
  from: PaymentIntentLifecycleStatus,
  to: PaymentIntentLifecycleStatus
): void {
  if (from === to) {
    return;
  }
  const allowed = ALLOWED_NEXT[from];
  if (allowed.includes(to)) {
    return;
  }
  throw new ConflictException(TRANSITION_INVALID);
}

export function allowedPaymentIntentNextStates(
  from: PaymentIntentLifecycleStatus
): readonly PaymentIntentLifecycleStatus[] {
  return ALLOWED_NEXT[from];
}
