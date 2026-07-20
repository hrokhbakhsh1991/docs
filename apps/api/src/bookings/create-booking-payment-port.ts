/**
 * Platform composition helper — BookingPaymentAdapter wired to the process bookings repo.
 * Finance must import this (not `create-bookings-repository`) so projection stays behind
 * the booking payment port (TODO-008 / PREV-AUD-008).
 */
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import { getBookingsRepository } from "./create-bookings-repository";
import { BookingPaymentAdapter } from "../workspace-finance/infrastructure/booking-payment.adapter";
import type { IBookingPaymentPort } from "../workspace-finance/ports/booking-payment.port";

export function createBookingPaymentPort(
  bookings: BookingRepositoryPort = getBookingsRepository()
): IBookingPaymentPort {
  return new BookingPaymentAdapter(bookings);
}
