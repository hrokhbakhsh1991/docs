/**
 * Denali availability + create/approve capacity decisions (pure).
 */

import type { BookingCreatePolicyContext } from "@app-cloud/booking-http-contracts";
import { BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE } from "@app-cloud/booking-http-contracts";

import {
  DEFAULT_DENALI_CAPACITY_RULE,
  type DenaliCapacityRule,
} from "./capacity-rule";

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
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
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

  if (rule.overbookAllowed !== true) {
    const next = availability.occupiedApprovedPartySize + ctx.partySize;
    if (next > availability.tourCapacityMax) {
      return Object.freeze({
        decision: "deny" as const,
        availability,
        reasonCode: `BOOKING_CAPACITY_REJECTED: occupied=${availability.occupiedApprovedPartySize} partySize=${ctx.partySize} capacityMax=${availability.tourCapacityMax}`,
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
    throw new Error(
      evaluation.reasonCode ?? "BOOKING_CAPACITY_REJECTED: capacity decision deny"
    );
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

export function denaliWaitlistAllowed(
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): boolean {
  return rule.waitlistEnabled === true;
}
