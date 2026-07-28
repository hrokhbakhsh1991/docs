/**
 * Denali create validation — base-shape + product limits.
 */

import {
  assertBookingBaseCreateShape,
  type BookingCreatePolicyContext,
} from "@app-tour/booking-http-contracts";

import {
  DEFAULT_DENALI_CAPACITY_RULE,
  type DenaliCapacityRule,
} from "./capacity-rule";

export function assertDenaliCreateValid(
  ctx: BookingCreatePolicyContext,
  rule: DenaliCapacityRule = DEFAULT_DENALI_CAPACITY_RULE
): void {
  assertBookingBaseCreateShape(ctx);

  if (!Number.isInteger(ctx.partySize)) {
    throw new Error("BOOKING_VALIDATION_REJECTED: partySize must be an integer");
  }

  if (ctx.partySize > rule.maxPartySize) {
    throw new Error(
      `BOOKING_VALIDATION_REJECTED: partySize must be <= ${rule.maxPartySize}`
    );
  }

  if (ctx.departureAt.trim().length === 0) {
    throw new Error("BOOKING_VALIDATION_REJECTED: departureAt is required");
  }

  if (ctx.tourId.trim().length === 0) {
    throw new Error("BOOKING_VALIDATION_REJECTED: tourId is required");
  }
}
