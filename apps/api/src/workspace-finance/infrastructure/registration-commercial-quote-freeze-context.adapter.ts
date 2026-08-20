import type { CommercialQuoteFreezeContextPort } from "@app-tour/finance-core/ports";

import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type { TourStorageImplementation } from "../../storage/create-tour-storage";
import { readTourAllowMembershipDiscount } from "./read-tour-membership-discount-gate";

/**
 * Booking + tour canonical context for commercial quote member-discount freeze (CQ-2B).
 */
export class RegistrationCommercialQuoteFreezeContextAdapter
  implements CommercialQuoteFreezeContextPort
{
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

    const memberUserId = booking.submittedByUserId.trim();
    return {
      memberUserId: memberUserId.length > 0 ? memberUserId : null,
      allowMembershipDiscount: this.readAllowMembershipDiscount(tour.canonical),
    };
  }
}
