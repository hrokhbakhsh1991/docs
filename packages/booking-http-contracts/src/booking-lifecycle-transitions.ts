/**
 * Booking lifecycle transition table — machine-readable SoT (CW4-02).
 *
 * Host repositories and workspace ops manifests derive from this module.
 * Outbox: approve / waitlist / cancel observable; reject silent (CW0-04).
 */
import {
  BOOKING_STATUSES,
  type BookingStatus,
} from "./booking-status";

/** Ordered operator / manifest vocabulary (not a transition order). */
export const BOOKING_STATUS_PIPELINE = Object.freeze([
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const satisfies readonly BookingStatus[]);

export const BOOKING_TERMINAL_STATUSES = Object.freeze([
  "rejected",
  "cancelled",
] as const satisfies readonly BookingStatus[]);

/** Allowed edges (from → to[]). Terminal statuses have no outbound edges. */
const BOOKING_LIFECYCLE_TRANSITIONS_TABLE: {
  readonly [K in BookingStatus]: readonly BookingStatus[];
} = {
  pending: ["approved", "waitlisted", "rejected", "cancelled"],
  waitlisted: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

export const BOOKING_LIFECYCLE_TRANSITIONS = Object.freeze(
  BOOKING_LIFECYCLE_TRANSITIONS_TABLE
);

export function isBookingTerminalStatus(status: BookingStatus): boolean {
  return (BOOKING_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function listBookingTransitionsFrom(
  from: BookingStatus
): readonly BookingStatus[] {
  return BOOKING_LIFECYCLE_TRANSITIONS[from];
}

export function canTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  if (from === to) {
    return false;
  }
  if (isBookingTerminalStatus(from)) {
    return false;
  }
  return BOOKING_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** Source statuses that may transition to `to` (for repository WHERE in clauses). */
export function listBookingSourceStatusesForTarget(
  to: BookingStatus
): readonly BookingStatus[] {
  const sources: BookingStatus[] = [];
  for (const status of BOOKING_STATUSES) {
    if (canTransitionBookingStatus(status, to)) {
      sources.push(status);
    }
  }
  return Object.freeze(sources);
}

export function assertCanTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus
): void {
  if (!canTransitionBookingStatus(from, to)) {
    throw new Error(
      `BOOKING_TRANSITION_REJECTED: ${from} → ${to} is not allowed`
    );
  }
}
