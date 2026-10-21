/**
 * Denali availability + create/approve capacity decisions (pure).
 */

import type {
  BookingCapacityReleasePolicyContext,
  BookingCreatePolicyContext,
  BookingCapacityReleaseDecision,
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

function readCandidateTransportKind(
  intake: Readonly<Record<string, unknown>> | undefined
): string | null {
  const transport = intake?.transport;
  if (typeof transport !== "object" || transport === null || Array.isArray(transport)) {
    return null;
  }
  const kind = (transport as Readonly<Record<string, unknown>>).kind;
  return typeof kind === "string" ? kind : null;
}

function sumApprovedTransportFacts(
  facts: BookingCreatePolicyContext["approvedTransportFacts"],
  predicate: (kind: string | null) => boolean,
  value: (fact: NonNullable<BookingCreatePolicyContext["approvedTransportFacts"]>[number]) => number
): number {
  return (facts ?? []).reduce((sum, fact) => {
    if (!predicate(fact.transportKind)) {
      return sum;
    }
    const amount = value(fact);
    return sum + (Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0);
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
  if (tourCapacityMax === null || !Number.isFinite(tourCapacityMax) || tourCapacityMax < 1) {
    return null;
  }
  const occupied = Math.max(0, Math.trunc(occupiedApprovedPartySize));
  const max = Math.trunc(tourCapacityMax);
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

  // Denali's published capacity is a hard participant ceiling. Generic
  // overbooking configuration must not exceed the physical tour maximum.
  const next = availability.occupiedApprovedPartySize + ctx.partySize;
  if (next > availability.tourCapacityMax) {
    return Object.freeze({
      decision: "deny" as const,
      availability,
      reasonCode: `BOOKING_CAPACITY_REJECTED: occupied=${availability.occupiedApprovedPartySize} partySize=${ctx.partySize} capacityMax=${availability.tourCapacityMax}`,
    });
  }

  // Personal-car seats form a separate, physical pool. They never expand the
  // tour-wide ceiling, and overbooking policy cannot override missing seats.
  if (readCandidateTransportKind(ctx.registrationIntake) === "no_car_dong") {
    const approvedFacts = ctx.approvedTransportFacts ?? [];
    const offeredDongSeats = sumApprovedTransportFacts(
      approvedFacts,
      (kind) => kind === "personal_car",
      (fact) => fact.offeredPassengerSeats ?? 0
    );
    const occupiedDongSeats = sumApprovedTransportFacts(
      approvedFacts,
      (kind) => kind === "no_car_dong",
      (fact) => fact.partySize
    );
    if (occupiedDongSeats + ctx.partySize > offeredDongSeats) {
      return Object.freeze({
        decision: "deny" as const,
        availability,
        reasonCode: `BOOKING_CAPACITY_REJECTED: occupied=${occupiedDongSeats} partySize=${ctx.partySize} capacityMax=${offeredDongSeats} constraint=personal_car_dong`,
      });
    }
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
 * Do not remove an approved car offer when doing so would strand approved dong guests.
 * The host supplies only locked, capacity-only facts; no lifecycle/API types cross the boundary.
 */
export function evaluateDenaliCapacityRelease(
  ctx: BookingCapacityReleasePolicyContext
): BookingCapacityReleaseDecision {
  if (ctx.bookingStatus !== "approved" || ctx.booking.transportKind !== "personal_car") {
    return Object.freeze({ allowed: true as const });
  }

  const confirmedDongSeats = sumApprovedTransportFacts(
    ctx.approvedTransportFacts,
    (kind) => kind === "no_car_dong",
    (fact) => fact.partySize
  );
  const offeredCarSeats = sumApprovedTransportFacts(
    ctx.approvedTransportFacts,
    (kind) => kind === "personal_car",
    (fact) => fact.offeredPassengerSeats ?? 0
  );
  const remainingCarSeats = Math.max(0, offeredCarSeats - (ctx.booking.offeredPassengerSeats ?? 0));

  if (confirmedDongSeats > remainingCarSeats) {
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
