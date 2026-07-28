/**
 * Denali booking status state machine + history append model.
 * Pure domain — no I/O, no shell, no SDK changes.
 */

import {
  isDenaliBookingTerminalStatus,
  type DenaliBookingStatus,
} from "./status";

/** Allowed edges (from → to[]). Terminal statuses have no outbound edges. */
const DENALI_BOOKING_TRANSITIONS: {
  readonly [K in DenaliBookingStatus]: readonly DenaliBookingStatus[];
} = {
  pending: ["approved", "waitlisted", "rejected", "cancelled"],
  waitlisted: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

export type DenaliBookingTransitionAction =
  | "create"
  | "approve"
  | "reject"
  | "waitlist"
  | "promote_waitlist"
  | "cancel";

export type DenaliBookingHistoryEntry = {
  readonly at: string;
  readonly from: DenaliBookingStatus | null;
  readonly to: DenaliBookingStatus;
  readonly action: DenaliBookingTransitionAction;
  readonly actorId?: string;
  readonly reason?: string;
};

export type DenaliBookingSnapshot = {
  readonly id: string;
  readonly status: DenaliBookingStatus;
  readonly partySize: number;
  readonly tourId: string;
  readonly history: readonly DenaliBookingHistoryEntry[];
};

export function listDenaliBookingTransitionsFrom(
  from: DenaliBookingStatus
): readonly DenaliBookingStatus[] {
  return DENALI_BOOKING_TRANSITIONS[from];
}

export function canTransitionDenaliBooking(
  from: DenaliBookingStatus,
  to: DenaliBookingStatus
): boolean {
  if (from === to) {
    return false;
  }
  if (isDenaliBookingTerminalStatus(from)) {
    return false;
  }
  return DENALI_BOOKING_TRANSITIONS[from].includes(to);
}

export function assertCanTransitionDenaliBooking(
  from: DenaliBookingStatus,
  to: DenaliBookingStatus
): void {
  if (!canTransitionDenaliBooking(from, to)) {
    throw new Error(
      `DENALI_BOOKING_TRANSITION_REJECTED: ${from} → ${to} is not allowed`
    );
  }
}

export type ApplyDenaliBookingTransitionInput = {
  readonly booking: DenaliBookingSnapshot;
  readonly to: DenaliBookingStatus;
  readonly action: DenaliBookingTransitionAction;
  readonly at?: string;
  readonly actorId?: string;
  readonly reason?: string;
};

export type ApplyDenaliBookingTransitionResult = {
  readonly booking: DenaliBookingSnapshot;
  readonly historyEntry: DenaliBookingHistoryEntry;
};

/** Apply a legal transition and append history (immutable). */
export function applyDenaliBookingTransition(
  input: ApplyDenaliBookingTransitionInput
): ApplyDenaliBookingTransitionResult {
  const from = input.booking.status;
  assertCanTransitionDenaliBooking(from, input.to);

  const at = input.at ?? new Date().toISOString();
  const historyEntry: DenaliBookingHistoryEntry = Object.freeze({
    at,
    from,
    to: input.to,
    action: input.action,
    ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
    ...(input.reason !== undefined && input.reason.trim().length > 0
      ? { reason: input.reason.trim() }
      : {}),
  });

  const booking: DenaliBookingSnapshot = Object.freeze({
    ...input.booking,
    status: input.to,
    history: Object.freeze([...input.booking.history, historyEntry]),
  });

  return { booking, historyEntry };
}

/** Initial pending booking after successful create validation/capacity. */
export function createDenaliBookingPendingSnapshot(input: {
  readonly id: string;
  readonly tourId: string;
  readonly partySize: number;
  readonly at?: string;
  readonly actorId?: string;
}): DenaliBookingSnapshot {
  const at = input.at ?? new Date().toISOString();
  const historyEntry: DenaliBookingHistoryEntry = Object.freeze({
    at,
    from: null,
    to: "pending",
    action: "create",
    ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
  });
  return Object.freeze({
    id: input.id,
    tourId: input.tourId,
    partySize: input.partySize,
    status: "pending",
    history: Object.freeze([historyEntry]),
  });
}
