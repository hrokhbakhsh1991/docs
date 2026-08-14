import { bookingPaymentStatusFromBalanceDue } from "./booking-payment-status-from-balance";
import { compileRegistrationInvoice } from "./compile-invoice-balances";
import type { BookingPaymentSyncStatus } from "../ports/booking-payment.port";

export type ResolveApproveBookingPaymentStatusInput = {
  readonly registrationId: string;
  readonly currency: string;
  readonly prepaymentMinor: string;
  readonly paidPaymentsMinor: string;
  readonly paymentAmountsMinor: readonly string[];
  readonly scheduleAmountsMinor?: readonly string[];
  readonly obligationMinor?: string;
  /** PR23-E2 — Completed refunds deducted in compile. */
  readonly refundedCompletedMinor?: string;
};

/**
 * Post-Paid invoice facts → booking projection for receipt approve.
 * Call only after the approved payment is visible as Paid in the fact source.
 */
export function resolveApproveBookingPaymentStatus(
  input: ResolveApproveBookingPaymentStatusInput
): BookingPaymentSyncStatus {
  const invoice = compileRegistrationInvoice({
    registrationId: input.registrationId,
    currency: input.currency,
    prepaymentMinor: input.prepaymentMinor,
    paidPaymentsMinor: input.paidPaymentsMinor,
    paymentAmountsMinor: input.paymentAmountsMinor,
    scheduleAmountsMinor: input.scheduleAmountsMinor ?? [],
    ...(input.obligationMinor !== undefined ? { obligationMinor: input.obligationMinor } : {}),
    ...(input.refundedCompletedMinor !== undefined
      ? { refundedCompletedMinor: input.refundedCompletedMinor }
      : {}),
  });
  return bookingPaymentStatusFromBalanceDue(invoice.balanceDueMinor);
}
