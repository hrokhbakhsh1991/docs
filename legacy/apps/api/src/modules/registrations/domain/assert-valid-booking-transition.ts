import { BookingStatus } from "./booking-status";
import { canTransition } from "./booking-transition-rules";

export class BookingTransitionForbiddenError extends Error {
  readonly code = "BOOKING_TRANSITION_FORBIDDEN";

  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus
  ) {
    super(`Illegal booking transition: ${from} → ${to}`);
    this.name = "BookingTransitionForbiddenError";
  }
}

/**
 * Throws {@link BookingTransitionForbiddenError} when `from → to` is not in the allow-list
 * (self-transitions always allowed as no-ops).
 *
 * **Call sites:** optional guard **before** mutating `RegistrationEntity.status` once services adopt the domain layer.
 */
export function assertValidBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new BookingTransitionForbiddenError(from, to);
  }
}
