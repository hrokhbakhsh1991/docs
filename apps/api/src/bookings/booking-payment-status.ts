import type { BookingPaymentStatus } from "./bookings.types";

const PAYMENT_STATUS_RANK: Record<BookingPaymentStatus, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
};

/** Never downgrade booking payment projection (unpaid → partial → paid). */
export function raiseBookingPaymentStatus(
  current: BookingPaymentStatus,
  target: BookingPaymentStatus
): BookingPaymentStatus {
  return PAYMENT_STATUS_RANK[target] > PAYMENT_STATUS_RANK[current] ? target : current;
}
