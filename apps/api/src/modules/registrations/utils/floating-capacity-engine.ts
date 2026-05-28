/**
 * Effective tour capacity for registration guards.
 *
 * FIXED: effective limit === `totalCapacity` (legacy).
 * FLOATING: effective limit === `totalCapacity` + Σ `vehicleSeatCapacity` for accepted private-car drivers.
 */

export type TourCapacityStrategy = "FIXED" | "FLOATING";

export interface EffectiveCapacityTourInput {
  totalCapacity: number;
  capacityStrategy?: TourCapacityStrategy | null;
}

export interface AcceptedDriverSeat {
  vehicleSeatCapacity: number;
}

export interface EffectiveCapacityContext {
  /** Accepted registrations that are private-car drivers (used for FLOATING bonus). */
  acceptedDrivers?: readonly AcceptedDriverSeat[];
}

export type PublicRegistrationCapacityBranch = "registration" | "waitlist";

/** Sum of driver seat capacities that extend FLOATING headroom beyond the bus baseline. */
export function sumAcceptedDriverSeatBonus(
  drivers: readonly AcceptedDriverSeat[] | undefined,
): number {
  if (drivers == null || drivers.length === 0) {
    return 0;
  }
  return drivers.reduce((sum, driver) => {
    const seats = driver.vehicleSeatCapacity;
    if (!Number.isFinite(seats) || seats <= 0) {
      return sum;
    }
    return sum + Math.floor(seats);
  }, 0);
}

export function resolveEffectiveCapacity(
  tour: EffectiveCapacityTourInput,
  context: EffectiveCapacityContext = {},
): number {
  const baseline = tour.totalCapacity;
  if (tour.capacityStrategy !== "FLOATING") {
    return baseline;
  }
  return baseline + sumAcceptedDriverSeatBonus(context.acceptedDrivers);
}

export function isTourAtEffectiveCapacity(
  acceptedCount: number,
  tour: EffectiveCapacityTourInput,
  context: EffectiveCapacityContext = {},
  resolve: (
    _t: EffectiveCapacityTourInput,
    _c?: EffectiveCapacityContext,
  ) => number = resolveEffectiveCapacity,
): boolean {
  const effective = resolve(tour, context);
  return acceptedCount >= effective;
}

/** Mirrors the public registration pre-check before waitlist vs registration branches. */
export function shouldPublicRegistrationRouteToWaitlist(
  input: {
    acceptedCount: number;
    tour: EffectiveCapacityTourInput;
    context?: EffectiveCapacityContext;
  },
  resolve: (
    _t: EffectiveCapacityTourInput,
    _c?: EffectiveCapacityContext,
  ) => number = resolveEffectiveCapacity,
): boolean {
  return isTourAtEffectiveCapacity(
    input.acceptedCount,
    input.tour,
    input.context ?? {},
    resolve,
  );
}

export function resolvePublicRegistrationCapacityBranch(
  input: {
    acceptedCount: number;
    tour: EffectiveCapacityTourInput;
    context?: EffectiveCapacityContext;
  },
  resolve: (
    _t: EffectiveCapacityTourInput,
    _c?: EffectiveCapacityContext,
  ) => number = resolveEffectiveCapacity,
): PublicRegistrationCapacityBranch {
  return shouldPublicRegistrationRouteToWaitlist(input, resolve)
    ? "waitlist"
    : "registration";
}
