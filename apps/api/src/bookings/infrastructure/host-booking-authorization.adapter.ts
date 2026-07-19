import { BookingsOpsForbiddenError } from "../bookings.errors";
import type { BookingActorContext } from "../ports/booking-actor-context";
import type { BookingAuthorizationPort } from "../ports/booking-authorization.port";

/**
 * Host adapter — admin | owner ops gate (same rules as former inline assertAdminOrOwner).
 */
export class HostBookingAuthorizationAdapter implements BookingAuthorizationPort {
  assertOpsAccess(auth: BookingActorContext): void {
    if (auth.role !== "admin" && auth.role !== "owner") {
      throw new BookingsOpsForbiddenError();
    }
  }
}
