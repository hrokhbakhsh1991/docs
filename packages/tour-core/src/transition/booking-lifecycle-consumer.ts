import {
  BOOKING_LIFECYCLE_TRANSITIONS,
  BOOKING_STATUSES,
  BOOKING_TERMINAL_STATUSES,
  type BookingStatus,
} from "@app-tour/booking-http-contracts";

import {
  assertCanTransitionState,
  canTransitionState,
  listTransitionSourcesForTarget,
  listTransitionTargetsFrom,
  type TransitionTable,
} from "./transition-table";

/** First consumer — booking lifecycle table typed via generic infrastructure (CW5-06). */
export const BOOKING_TRANSITION_TABLE: TransitionTable<BookingStatus> =
  BOOKING_LIFECYCLE_TRANSITIONS;

export function canTransitionBookingViaGenericTable(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return canTransitionState(
    BOOKING_TRANSITION_TABLE,
    from,
    to,
    BOOKING_TERMINAL_STATUSES,
  );
}

export function assertCanTransitionBookingViaGenericTable(
  from: BookingStatus,
  to: BookingStatus,
): void {
  assertCanTransitionState(
    BOOKING_TRANSITION_TABLE,
    from,
    to,
    BOOKING_TERMINAL_STATUSES,
    (f, t) => `BOOKING_TRANSITION_REJECTED: ${f} → ${t} is not allowed`,
  );
}

export function listBookingTransitionTargetsFrom(from: BookingStatus): readonly BookingStatus[] {
  return listTransitionTargetsFrom(BOOKING_TRANSITION_TABLE, from);
}

export function listBookingTransitionSourcesForTarget(
  to: BookingStatus,
): readonly BookingStatus[] {
  return listTransitionSourcesForTarget(
    BOOKING_TRANSITION_TABLE,
    to,
    BOOKING_STATUSES,
    BOOKING_TERMINAL_STATUSES,
  );
}
