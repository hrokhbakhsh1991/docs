import { ConflictException } from "@nestjs/common";
import { PaymentStatus } from "../entities/payment.entity";
import {
  assertAllowedPaymentIntentLifecycleTransition,
  paymentStatusToIntentLifecycle
} from "./payment-intent-lifecycle";

const TRANSITION_INVALID = {
  error: {
    code: "PAYMENT_STATUS_TRANSITION_INVALID",
    message: "Requested payment transition is not allowed"
  }
} as const;

/**
 * Validates `payments.status` changes using the payment **intent** lifecycle (CREATED→…→REFUNDED)
 * mapped onto persisted {@link PaymentStatus}. `Cancelled` is outside intent states and uses a
 * narrow escape hatch from captured (`Paid`) only.
 */
export function assertAllowedPaymentStatusTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (current === next) {
    return;
  }

  const curIntent = paymentStatusToIntentLifecycle(current);
  const nextIntent = paymentStatusToIntentLifecycle(next);

  if (curIntent !== null && nextIntent !== null) {
    assertAllowedPaymentIntentLifecycleTransition(curIntent, nextIntent);
    return;
  }

  /** `Cancelled` is not modeled as an intent state; only allow voiding a captured payment. */
  if (current === PaymentStatus.PAID && next === PaymentStatus.CANCELLED) {
    return;
  }

  throw new ConflictException(TRANSITION_INVALID);
}

export function paymentStatusToOutboxEventType(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.PAID:
      return "payment.succeeded";
    case PaymentStatus.FAILED:
      return "payment.failed";
    case PaymentStatus.REFUNDED:
      return "payment.refunded";
    default:
      return "payment.status_changed";
  }
}
