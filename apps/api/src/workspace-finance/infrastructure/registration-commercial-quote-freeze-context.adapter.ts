import type { CommercialQuoteFreezeContextPort } from "@app-tour/finance-core/ports";

import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import { readRegistrantTargetFromIntake } from "../../bookings/read-registrant-target";
import type { TourStorageImplementation } from "../../storage/create-tour-storage";
import { readTourAllowMembershipDiscount } from "./read-tour-membership-discount-gate";

/**
 * Booking + tour canonical context for commercial quote member-discount freeze (CQ-2B).
 */
export class RegistrationCommercialQuoteFreezeContextAdapter implements CommercialQuoteFreezeContextPort {
  constructor(
    private readonly bookings: Pick<BookingRepositoryPort, "getById">,
    private readonly tours: Pick<TourStorageImplementation, "getById">,
    private readonly readAllowMembershipDiscount: (
      tourCanonical: unknown
    ) => boolean = readTourAllowMembershipDiscount
  ) {}

  async resolveRegistrationFreezeContext(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }) {
    const booking = await this.bookings.getById(input.registrationId, input.tenantId);
    if (booking === null) {
      return null;
    }

    const tour = await this.tours.getById(booking.tourId, input.tenantId);
    if (tour === null) {
      return null;
    }

    // The logged-in member may submit a registration for somebody else. In that case
    // the submitter owns the portal session but is not the priced participant; applying
    // their membership discount to the guest creates the BUG-STG-022 final-quote drift.
    const memberUserId =
      readRegistrantTargetFromIntake(booking.registrationIntake) === "self"
        ? booking.submittedByUserId.trim()
        : "";
    return {
      memberUserId: memberUserId.length > 0 ? memberUserId : null,
      allowMembershipDiscount: this.readAllowMembershipDiscount(tour.canonical),
    };
  }
}
