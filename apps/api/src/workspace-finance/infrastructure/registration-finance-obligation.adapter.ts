import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type { TourStorageImplementation } from "../../storage/create-tour-storage";

/** Pure pricing bind injected by composition root (workspace host stays out of this module). */
export type RegistrationObligationResolver = (input: {
  readonly tourCanonical: unknown;
  readonly partySize: number;
  readonly currency?: string;
}) => {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly source: "tour_canonical" | "schedule" | "operator_override" | "unknown";
} | null;

/**
 * Commercial registration-obligation adapter — booking snapshot + injected pricing resolver (FC-2 / P3.5).
 * Host composition wires workspace-specific resolvers via codegen; this module stays workspace-agnostic.
 */
export class RegistrationFinanceObligationAdapter implements FinanceObligationPort {
  constructor(
    private readonly bookings: Pick<BookingRepositoryPort, "getById">,
    private readonly tours: Pick<TourStorageImplementation, "getById">,
    private readonly resolveObligation: RegistrationObligationResolver
  ) {}

  async resolveRegistrationObligation(input: {
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
    const resolved = this.resolveObligation({
      tourCanonical: tour.canonical,
      partySize: booking.partySize,
    });
    if (resolved === null) {
      return null;
    }
    return {
      currency: resolved.currency,
      obligationMinor: resolved.obligationMinor,
      source: resolved.source,
    };
  }
}
