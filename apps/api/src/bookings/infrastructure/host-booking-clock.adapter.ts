import type { BookingClockPort } from "../ports/booking-clock.port";

/**
 * Host adapter — system wall clock (same as former `new Date()` in bookings.service).
 */
export class HostBookingClockAdapter implements BookingClockPort {
  now(): Date {
    return new Date();
  }
}
