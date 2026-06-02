import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "./registration-status";
import { BookingStatus } from "./booking-status";

/**
 * Read-only projection of legacy registration + payment columns into {@link BookingStatus}.
 * `waitlisted` is **not** inferable from `RegistrationStatus` alone — callers must override when
 * integrating waitlist promotion flows.
 */
export function toBookingStatusFromRegistration(
  status: RegistrationStatus,
  paymentStatus: RegistrationPaymentStatus,
  options?: { treatAsWaitlisted?: boolean }
): BookingStatus {
  if (options?.treatAsWaitlisted) {
    return BookingStatus.WAITLISTED;
  }
  switch (status) {
    case RegistrationStatus.PENDING:
      return BookingStatus.PENDING;
    case RegistrationStatus.ACCEPTED:
      return paymentStatus === RegistrationPaymentStatus.PAID
        ? BookingStatus.CONFIRMED
        : BookingStatus.AWAITING_PAYMENT;
    case RegistrationStatus.ACCEPTED_PAID:
      return BookingStatus.CONFIRMED;
    case RegistrationStatus.REJECTED:
    case RegistrationStatus.CANCELLED:
      return BookingStatus.CANCELLED;
    case RegistrationStatus.REFUNDED:
      return BookingStatus.REFUNDED;
    case RegistrationStatus.NO_SHOW:
      return BookingStatus.CONFIRMED;
    default:
      return BookingStatus.PENDING;
  }
}

/**
 * Projection of a **target** `RegistrationStatus` into {@link BookingStatus} for transition validation.
 * Does not model payment side-effects of the same request — use with {@link toBookingStatusFromRegistration}
 * for the current row.
 */
export function toBookingStatusFromTargetRegistrationStatus(
  status: RegistrationStatus
): BookingStatus {
  switch (status) {
    case RegistrationStatus.PENDING:
      return BookingStatus.PENDING;
    case RegistrationStatus.ACCEPTED:
      return BookingStatus.AWAITING_PAYMENT;
    case RegistrationStatus.ACCEPTED_PAID:
      return BookingStatus.CONFIRMED;
    case RegistrationStatus.REJECTED:
    case RegistrationStatus.CANCELLED:
      return BookingStatus.CANCELLED;
    case RegistrationStatus.REFUNDED:
      return BookingStatus.REFUNDED;
    case RegistrationStatus.NO_SHOW:
      return BookingStatus.CONFIRMED;
    default:
      return BookingStatus.PENDING;
  }
}
