import { ConflictException } from "@nestjs/common";
import { PaymentStatus } from "./payment.types";

export const PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN = {
  error: {
    code: "PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN",
    message:
      "Registration already has a successful payment; additional manual debt is not allowed in the finance pilot."
  }
} as const;

/**
 * Pilot rule (map-phase D7.1–D7.2): block manual debt when registration is already settled
 * or another payment is still pending. Recovery after online failure is allowed when no Paid
 * and no Pending rows exist.
 */
export function assertManualPaymentDebtAllowed(existingStatuses: PaymentStatus[]): void {
  if (existingStatuses.some((s) => s === PaymentStatus.PAID)) {
    throw new ConflictException(PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN);
  }
  if (existingStatuses.some((s) => s === PaymentStatus.PENDING)) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_PENDING_EXISTS",
        message: "Pending payment already exists for registration"
      }
    });
  }
}
