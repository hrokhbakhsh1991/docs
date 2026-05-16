import { ConflictException } from "@nestjs/common";

/**
 * Strict finance-tied booking finalization pipeline (ordered, no skips).
 *
 * Maps to operational signals: {@link bookingFinalizationPhaseFromFacts} derives the current
 * reached phase from snapshot / payment / registration rows.
 */
export const BookingFinalizationPhase = {
  BOOKING_CREATED: "BOOKING_CREATED",
  PRICE_SNAPSHOT_LOCKED: "PRICE_SNAPSHOT_LOCKED",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_CAPTURED: "PAYMENT_CAPTURED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED"
} as const;

export type BookingFinalizationPhase =
  (typeof BookingFinalizationPhase)[keyof typeof BookingFinalizationPhase];

export const BOOKING_FINALIZATION_ORDER: readonly BookingFinalizationPhase[] = [
  BookingFinalizationPhase.BOOKING_CREATED,
  BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
  BookingFinalizationPhase.PAYMENT_INITIATED,
  BookingFinalizationPhase.PAYMENT_CAPTURED,
  BookingFinalizationPhase.BOOKING_CONFIRMED
] as const;

const PHASE_INDEX = new Map<BookingFinalizationPhase, number>(
  BOOKING_FINALIZATION_ORDER.map((p, i) => [p, i])
);

export type BookingFinalizationFacts = {
  hasPriceSnapshot: boolean;
  hasPendingPayment: boolean;
  hasCapturedPayment: boolean;
  registrationFinanciallyConfirmed: boolean;
};

/**
 * Latest satisfied phase along the pipeline (single source for "where we are").
 */
export function bookingFinalizationPhaseFromFacts(f: BookingFinalizationFacts): BookingFinalizationPhase {
  if (f.registrationFinanciallyConfirmed && f.hasCapturedPayment) {
    return BookingFinalizationPhase.BOOKING_CONFIRMED;
  }
  if (f.hasCapturedPayment) {
    return BookingFinalizationPhase.PAYMENT_CAPTURED;
  }
  if (f.hasPendingPayment) {
    return BookingFinalizationPhase.PAYMENT_INITIATED;
  }
  if (f.hasPriceSnapshot) {
    return BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED;
  }
  return BookingFinalizationPhase.BOOKING_CREATED;
}

/**
 * Requires `current` phase index to be exactly `required` phase index (no skipping forward from an earlier phase).
 * `current` is the phase **before** the operation; `required` is the minimum phase that must already be true.
 */
export function assertBookingFinalizationAtLeast(
  current: BookingFinalizationPhase,
  required: BookingFinalizationPhase,
  operation: string
): void {
  const c = PHASE_INDEX.get(current) ?? -1;
  const r = PHASE_INDEX.get(required) ?? -1;
  if (c < r) {
    throw new ConflictException({
      error: {
        code: "BOOKING_FINALIZATION_ORDER_VIOLATION",
        message: `${operation} requires booking pipeline at ${required} (currently ${current}); steps cannot be skipped.`
      }
    });
  }
}

/**
 * Asserts we are advancing by **exactly one** pipeline step (or idempotent replay of the same phase).
 */
export function assertSingleStepBookingFinalizationAdvance(
  before: BookingFinalizationPhase,
  after: BookingFinalizationPhase,
  operation: string
): void {
  if (before === after) {
    return;
  }
  const bi = PHASE_INDEX.get(before) ?? -1;
  const ai = PHASE_INDEX.get(after) ?? -1;
  if (ai !== bi + 1) {
    throw new ConflictException({
      error: {
        code: "BOOKING_FINALIZATION_ORDER_VIOLATION",
        message: `${operation} would advance booking pipeline from ${before} to ${after}; only single-step progression is allowed.`
      }
    });
  }
}

export function bookingFinalizationOutboxEventType(phase: BookingFinalizationPhase): string {
  switch (phase) {
    case BookingFinalizationPhase.BOOKING_CREATED:
      return "booking.finalization.booking_created";
    case BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED:
      return "booking.finalization.price_snapshot_locked";
    case BookingFinalizationPhase.PAYMENT_INITIATED:
      return "booking.finalization.payment_initiated";
    case BookingFinalizationPhase.PAYMENT_CAPTURED:
      return "booking.finalization.payment_captured";
    case BookingFinalizationPhase.BOOKING_CONFIRMED:
      return "booking.finalization.booking_confirmed";
  }
}
