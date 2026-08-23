/**
 * Denali booking lifecycle — history append model (workspace-retained, CW4-04).
 * Transition edges derive from `@app-tour/booking-http-contracts` (CW4-02 SoT).
 * Host authorization uses shared contract via BookingsService repositories.
 */

import {
  canTransitionBookingStatus,
  listBookingTransitionsFrom,
} from "@app-tour/booking-http-contracts";

import type { DenaliBookingStatus } from "./status";

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

/** Compat alias — edges from shared contract (CW4-04). */
export function listDenaliBookingTransitionsFrom(
  from: DenaliBookingStatus
): readonly DenaliBookingStatus[] {
  return listBookingTransitionsFrom(from);
}

/** Compat alias — edges from shared contract (CW4-04). */
export function canTransitionDenaliBooking(
  from: DenaliBookingStatus,
  to: DenaliBookingStatus
): boolean {
  return canTransitionBookingStatus(from, to);
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
