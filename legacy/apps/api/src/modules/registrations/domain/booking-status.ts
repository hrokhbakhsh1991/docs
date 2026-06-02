/**
 * Explicit booking lifecycle states (domain model).
 * **Does not replace** `RegistrationStatus` in the DB yet — map via {@link toBookingStatusFromRegistration}.
 *
 * TODO: Align DB enum / migration once API contracts are ready.
 */
export enum BookingStatus {
  PENDING = "pending",
  AWAITING_PAYMENT = "awaiting_payment",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  WAITLISTED = "waitlisted"
}
