/**
 * Operator decision helpers — map ops actions to lifecycle transitions + capacity gates.
 * Pure domain; host persists via existing booking repository lifecycle.
 */

import type { BookingCreatePolicyContext } from "@app-cloud/booking-http-contracts";

import { assertDenaliTransitionCapacity, denaliWaitlistAllowed } from "./availability";
import {
  DEFAULT_DENALI_CAPACITY_RULE,
  type DenaliCapacityRule,
} from "./capacity-rule";
import {
  applyDenaliBookingTransition,
  type DenaliBookingSnapshot,
} from "./lifecycle";

export type DenaliOperatorDecisionMeta = {
  readonly at?: string;
  readonly actorId?: string;
  readonly reason?: string;
};

function withCapacity(
  snapshot: DenaliBookingSnapshot,
  capacityCtx: BookingCreatePolicyContext | undefined,
  rule: DenaliCapacityRule
): void {
  if (capacityCtx === undefined) {
    return;
  }
  assertDenaliTransitionCapacity(
    {
      ...capacityCtx,
      partySize: snapshot.partySize,
      tourId: snapshot.tourId,
    },
    rule
  );
}

/** pending | waitlisted → approved (capacity re-check when context provided). */
export function decideDenaliApprove(
  booking: DenaliBookingSnapshot,
  meta: DenaliOperatorDecisionMeta = {},
  capacityCtx?: BookingCreatePolicyContext,
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): DenaliBookingSnapshot {
  withCapacity(booking, capacityCtx, rule);
  return applyDenaliBookingTransition({
    booking,
    to: "approved",
    action: booking.status === "waitlisted" ? "promote_waitlist" : "approve",
    ...meta,
  }).booking;
}

/** pending | waitlisted → rejected. */
export function decideDenaliReject(
  booking: DenaliBookingSnapshot,
  meta: DenaliOperatorDecisionMeta = {}
): DenaliBookingSnapshot {
  return applyDenaliBookingTransition({
    booking,
    to: "rejected",
    action: "reject",
    ...meta,
  }).booking;
}

/** pending → waitlisted (requires waitlistEnabled). */
export function decideDenaliWaitlist(
  booking: DenaliBookingSnapshot,
  meta: DenaliOperatorDecisionMeta = {},
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): DenaliBookingSnapshot {
  if (!denaliWaitlistAllowed(rule)) {
    throw new Error("DENALI_BOOKING_WAITLIST_DISABLED: waitlistEnabled=false");
  }
  return applyDenaliBookingTransition({
    booking,
    to: "waitlisted",
    action: "waitlist",
    ...meta,
  }).booking;
}

/** waitlisted → approved (alias of approve with capacity). */
export function decideDenaliPromoteWaitlist(
  booking: DenaliBookingSnapshot,
  meta: DenaliOperatorDecisionMeta = {},
  capacityCtx?: BookingCreatePolicyContext,
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): DenaliBookingSnapshot {
  if (booking.status !== "waitlisted") {
    throw new Error(
      `DENALI_BOOKING_TRANSITION_REJECTED: promote_waitlist requires waitlisted (got ${booking.status})`
    );
  }
  return decideDenaliApprove(booking, meta, capacityCtx, rule);
}

/** pending | waitlisted | approved → cancelled. */
export function decideDenaliCancel(
  booking: DenaliBookingSnapshot,
  meta: DenaliOperatorDecisionMeta = {}
): DenaliBookingSnapshot {
  return applyDenaliBookingTransition({
    booking,
    to: "cancelled",
    action: "cancel",
    ...meta,
  }).booking;
}
