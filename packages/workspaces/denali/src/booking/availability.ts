/**
 * Denali availability + create/approve capacity decisions (pure).
 */

import {
  BOOKING_TRANSPORT_CAPACITY_REJECTED,
  type BookingApprovedCapacitySnapshot,
  type BookingCapacityReleaseDecision,
  type BookingCapacityReleasePolicyContext,
  type BookingCreatePolicyContext,
} from "@app-tour/booking-http-contracts";
import { BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE } from "@app-tour/booking-http-contracts";

import { DEFAULT_DENALI_CAPACITY_RULE, type DenaliCapacityRule } from "./capacity-rule";

export type DenaliAvailability = {
  readonly tourCapacityMax: number;
  readonly occupiedApprovedPartySize: number;
  readonly remaining: number;
};

export type DenaliCreateCapacityDecision = "accept" | "deny";

export type DenaliCreateCapacityEvaluation = {
  readonly decision: DenaliCreateCapacityDecision;
  readonly availability: DenaliAvailability | null;
  readonly reasonCode: string | null;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTransportIntake(intake: Readonly<Record<string, unknown>> | undefined) {
  const transport = intake?.transport;
  return isRecord(transport) ? transport : undefined;
}

function offeredCarSeats(snapshots: readonly BookingApprovedCapacitySnapshot[]): number {
  return snapshots.reduce((total, snapshot) => {
    const transport = readTransportIntake(snapshot.registrationIntake);
    if (transport?.kind !== "personal_car") return total;
    const seats = transport.personalCarOccupants;
    return total + (typeof seats === "number" && Number.isInteger(seats) && seats >= 0 ? seats : 0);
  }, 0);
}

function occupiedCarSeats(snapshots: readonly BookingApprovedCapacitySnapshot[]): number {
  return snapshots.reduce((total, snapshot) => {
    const transport = readTransportIntake(snapshot.registrationIntake);
    return transport?.kind === "no_car_dong" ? total + Math.max(0, snapshot.partySize) : total;
  }, 0);
}

/**
 * Remaining seats against approved occupancy (host SoT).
 * Returns null when capacity ceiling is unknown / invalid.
 */
export function computeDenaliAvailability(
  occupiedApprovedPartySize: number,
  tourCapacityMax: number | null
): DenaliAvailability | null {
  if (
    !Number.isInteger(occupiedApprovedPartySize) ||
    occupiedApprovedPartySize < 0 ||
    tourCapacityMax === null ||
    !Number.isInteger(tourCapacityMax) ||
    tourCapacityMax < 1
  ) {
    return null;
  }
  const occupied = occupiedApprovedPartySize;
  const max = tourCapacityMax;
  return Object.freeze({
    tourCapacityMax: max,
    occupiedApprovedPartySize: occupied,
    remaining: Math.max(0, max - occupied),
  });
}

export function evaluateDenaliCreateCapacity(
  ctx: BookingCreatePolicyContext,
  _rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): DenaliCreateCapacityEvaluation {
  if (!Number.isInteger(ctx.partySize) || ctx.partySize < 1) {
    return Object.freeze({
      decision: "deny" as const,
      availability: null,
      reasonCode: "BOOKING_VALIDATION_REJECTED: partySize must be a positive integer",
    });
  }

  if (
    (ctx.approvedCapacitySnapshots ?? []).some(
      (snapshot) => !Number.isInteger(snapshot.partySize) || snapshot.partySize < 1
    )
  ) {
    return Object.freeze({
      decision: "deny" as const,
      availability: null,
      reasonCode: "BOOKING_CAPACITY_REJECTED: invalid approved occupancy snapshot",
    });
  }

  if (!Number.isInteger(ctx.occupiedApprovedPartySize) || ctx.occupiedApprovedPartySize < 0) {
    return Object.freeze({
      decision: "deny" as const,
      availability: null,
      reasonCode: "BOOKING_CAPACITY_REJECTED: invalid approved occupancy",
    });
  }

  const availability = computeDenaliAvailability(
    ctx.occupiedApprovedPartySize,
    ctx.tourCapacityMax
  );
  if (availability === null) {
    return Object.freeze({
      decision: "deny" as const,
      availability: null,
      reasonCode: BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE,
    });
  }

  // Denali's published capacity is a product invariant.  The generic legacy
  // flag remains in the rule contract for compatibility, but it must never
  // bypass this workspace's hard ceiling.
  const next = availability.occupiedApprovedPartySize + ctx.partySize;
  if (next > availability.tourCapacityMax) {
    return Object.freeze({
      decision: "deny" as const,
      availability,
      reasonCode: `BOOKING_CAPACITY_REJECTED: occupied=${availability.occupiedApprovedPartySize} partySize=${ctx.partySize} capacityMax=${availability.tourCapacityMax}`,
    });
  }

  const candidateTransport = readTransportIntake(ctx.registrationIntake);
  const snapshots = ctx.approvedCapacitySnapshots ?? [];
  const offered = offeredCarSeats(snapshots);
  const occupied = occupiedCarSeats(snapshots);
  const dongSeatsRequired =
    occupied + (candidateTransport?.kind === "no_car_dong" ? ctx.partySize : 0);
  if (dongSeatsRequired > offered) {
    return Object.freeze({
      decision: "deny" as const,
      availability,
      reasonCode: `${BOOKING_TRANSPORT_CAPACITY_REJECTED}: dongSeatsRequired=${dongSeatsRequired} carSeatsOffered=${offered} constraint=personal_car_dong`,
    });
  }

  return Object.freeze({
    decision: "accept" as const,
    availability,
    reasonCode: null,
  });
}

/**
 * Create-time capacity assert for HTTP adapters.
 * Single SoT: evaluateDenaliCreateCapacity → throw on deny (stable reason codes).
 */
export function assertDenaliCreateCapacity(
  ctx: BookingCreatePolicyContext,
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): void {
  const evaluation = evaluateDenaliCreateCapacity(ctx, rule);
  if (evaluation.decision === "deny") {
    throw new Error(evaluation.reasonCode ?? "BOOKING_CAPACITY_REJECTED: capacity decision deny");
  }
}

/**
 * Capacity gate for approve / promote-from-waitlist (same occupancy model as create).
 */
export function assertDenaliTransitionCapacity(
  ctx: BookingCreatePolicyContext,
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): void {
  assertDenaliCreateCapacity(ctx, rule);
}

/**
 * A driver cancellation must not leave already-approved dong passengers without a seat.
 * All values come from the booking repository's lock-scoped, capacity-only snapshots.
 */
export function evaluateDenaliCapacityRelease(
  ctx: BookingCapacityReleasePolicyContext
): BookingCapacityReleaseDecision {
  const bookingTransport = readTransportIntake(ctx.booking.registrationIntake);
  if (ctx.bookingStatus !== "approved" || bookingTransport?.kind !== "personal_car") {
    return Object.freeze({ allowed: true as const });
  }

  const confirmedDongSeats = occupiedCarSeats(ctx.approvedCapacitySnapshots);
  const offeredSeats = offeredCarSeats(ctx.approvedCapacitySnapshots);
  const currentOffer =
    typeof bookingTransport.personalCarOccupants === "number" &&
    Number.isInteger(bookingTransport.personalCarOccupants) &&
    bookingTransport.personalCarOccupants >= 0
      ? bookingTransport.personalCarOccupants
      : 0;

  if (confirmedDongSeats > Math.max(0, offeredSeats - currentOffer)) {
    return Object.freeze({
      allowed: false as const,
      reasonCode: "BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED",
    });
  }
  return Object.freeze({ allowed: true as const });
}

export function denaliWaitlistAllowed(
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): boolean {
  return rule.waitlistEnabled === true;
}
