/**
 * Single executable create/capacity rules shared by all workspace adapters.
 * Workspace adapters may layer markers on top; they must not re-copy these checks.
 */

import type { BookingCreatePolicyContext } from "./booking-create-policy.port";

export const BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE =
  "BOOKING_CAPACITY_REJECTED: tourCapacityMax required (booking-owned capacity)";

export function readTourCapacityMaxFromIntake(
  intake: Readonly<Record<string, unknown>> | undefined
): number | null {
  if (intake === undefined) {
    return null;
  }
  const raw = intake.tourCapacityMax;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return Math.trunc(raw);
}

/** Shared create shape — partySize + guestLabel. */
export function assertBookingBaseCreateShape(ctx: BookingCreatePolicyContext): void {
  if (ctx.partySize < 1 || !Number.isFinite(ctx.partySize)) {
    throw new Error("BOOKING_VALIDATION_REJECTED: partySize must be >= 1");
  }
  if (ctx.guestLabel.trim().length === 0) {
    throw new Error("BOOKING_VALIDATION_REJECTED: guestLabel is required");
  }
}

/**
 * Shared capacity ceiling — approved occupancy + partySize ≤ tourCapacityMax.
 * Missing / non-positive max rejects (booking-owned capacity).
 */
export function assertBookingStandardCapacity(ctx: BookingCreatePolicyContext): void {
  if (ctx.tourCapacityMax === null) {
    throw new Error(BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE);
  }
  if (ctx.tourCapacityMax < 1) {
    throw new Error("BOOKING_CAPACITY_REJECTED: tourCapacityMax must be >= 1");
  }
  const next = ctx.occupiedApprovedPartySize + ctx.partySize;
  if (next > ctx.tourCapacityMax) {
    throw new Error(
      `BOOKING_CAPACITY_REJECTED: occupied=${ctx.occupiedApprovedPartySize} partySize=${ctx.partySize} capacityMax=${ctx.tourCapacityMax}`
    );
  }
}
