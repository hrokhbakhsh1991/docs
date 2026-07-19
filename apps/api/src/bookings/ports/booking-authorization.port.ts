import type { BookingActorContext } from "./booking-actor-context";

/**
 * Role authorization for booking operator use-cases (B0.2 / B0.5).
 * Throws BookingsOpsForbiddenError when ops access is denied.
 */
export interface BookingAuthorizationPort {
  assertOpsAccess(auth: BookingActorContext): void;
}
