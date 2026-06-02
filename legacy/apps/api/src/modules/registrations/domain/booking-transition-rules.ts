import { BookingStatus } from "./booking-status";

/**
 * Directed edges `(from, to)` permitted by the booking lifecycle state machine.
 * Any pair not listed is **illegal** for controlled transitions.
 *
 * TODO: Partial refunds (split `confirmed` → `refunded` with residual balance).
 * TODO: Time-based expiration (auto `awaiting_payment` → `cancelled`).
 * TODO: Auto-cancel unpaid bookings job + idempotent notifications.
 */
export const BOOKING_ALLOWED_TRANSITIONS: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  [BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT],
  [BookingStatus.PENDING, BookingStatus.CONFIRMED],
  [BookingStatus.PENDING, BookingStatus.CANCELLED],
  [BookingStatus.PENDING, BookingStatus.WAITLISTED],
  [BookingStatus.AWAITING_PAYMENT, BookingStatus.CONFIRMED],
  [BookingStatus.AWAITING_PAYMENT, BookingStatus.CANCELLED],
  [BookingStatus.AWAITING_PAYMENT, BookingStatus.REFUNDED],
  [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED, BookingStatus.REFUNDED],
  [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
  [BookingStatus.WAITLISTED, BookingStatus.PENDING],
  [BookingStatus.WAITLISTED, BookingStatus.AWAITING_PAYMENT],
  [BookingStatus.WAITLISTED, BookingStatus.CANCELLED]
];

const allowedKey = (from: BookingStatus, to: BookingStatus): string => `${from}→${to}`;

const ALLOWED_SET: ReadonlySet<string> = new Set(
  BOOKING_ALLOWED_TRANSITIONS.map(([from, to]) => allowedKey(from, to))
);

/** Facade over allowed transition edges (explicit list + query helpers). */
export const BookingTransitionRules = {
  allowedEdges: BOOKING_ALLOWED_TRANSITIONS,

  canTransition(from: BookingStatus, to: BookingStatus): boolean {
    if (from === to) {
      return true;
    }
    return ALLOWED_SET.has(allowedKey(from, to));
  }
} as const;

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BookingTransitionRules.canTransition(from, to);
}
