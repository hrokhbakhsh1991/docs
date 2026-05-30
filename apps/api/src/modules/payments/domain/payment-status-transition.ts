import { isAllowedPaymentStatusTransition } from "@repo/shared-contracts";
import { ConflictException } from "@nestjs/common";
import { PaymentStatus } from "./payment.types";

const TRANSITION_INVALID = {
  error: {
    code: "PAYMENT_STATUS_TRANSITION_INVALID",
    message: "Requested payment transition is not allowed"
  }
} as const;

/**
 * Validates `payments.status` using {@link PAYMENT_STATUS_TRANSITIONS} from `@repo/shared-contracts`.
 */
export function assertAllowedPaymentStatusTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (!isAllowedPaymentStatusTransition(current, next)) {
    throw new ConflictException(TRANSITION_INVALID);
  }
}

export function paymentStatusToOutboxEventType(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.PAID:
      return "payment.captured";
    case PaymentStatus.FAILED:
      return "payment.failed";
    case PaymentStatus.REFUNDED:
      return "payment.refunded";
    default:
      return "payment.status_changed";
  }
}
