import type {
  FinanceObligationPort,
  FinancePaymentCollectionMode,
  FinanceRegistrationObligationOverrideInput,
} from "@app-tour/finance-http-contracts";
import {
  buildObligationOverrideIntakeValue,
  OBLIGATION_OVERRIDE_INTAKE_KEY,
  readObligationOverrideFromIntake,
} from "@app-tour/finance-core";

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

/** Pure payment-collection bind — defaults to offline when omitted. */
export type RegistrationPaymentCollectionResolver = (
  tourCanonical: unknown
) => FinancePaymentCollectionMode;

/**
 * Commercial registration-obligation adapter — booking snapshot + injected pricing resolver (FC-2 / P3.5).
 * Host composition wires workspace-specific resolvers via codegen; this module stays workspace-agnostic.
 *
 * Override persistence uses booking `registrationIntake` as a host bag only — commercial SoT remains
 * this Finance-owned port (not the booking payment projection port).
 */
export class RegistrationFinanceObligationAdapter implements FinanceObligationPort {
  constructor(
    private readonly bookings: Pick<BookingRepositoryPort, "getById" | "mergeRegistrationIntake">,
    private readonly tours: Pick<TourStorageImplementation, "getById">,
    private readonly resolveObligation: RegistrationObligationResolver,
    /** Fallback currency when tour pricing cannot resolve (receipt-defaults / workspace commerce). */
    private readonly resolveDefaultCurrency: () => string,
    private readonly resolvePaymentCollection: RegistrationPaymentCollectionResolver = () =>
      "offline"
  ) {}

  private async loadTourCanonical(
    tenantId: string,
    registrationId: string
  ): Promise<unknown | null> {
    const booking = await this.bookings.getById(registrationId, tenantId);
    if (booking === null) {
      return null;
    }
    const tour = await this.tours.getById(booking.tourId, tenantId);
    if (tour === null) {
      return null;
    }
    return tour.canonical;
  }

  async resolveRegistrationObligation(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }) {
    const booking = await this.bookings.getById(input.registrationId, input.tenantId);
    if (booking === null) {
      return null;
    }

    const override = readObligationOverrideFromIntake(booking.registrationIntake);
    if (override !== null) {
      const tour = await this.tours.getById(booking.tourId, input.tenantId);
      const base =
        tour === null
          ? null
          : this.resolveObligation({
              tourCanonical: tour.canonical,
              partySize: booking.partySize,
            });
      return {
        currency: base?.currency ?? this.resolveDefaultCurrency(),
        obligationMinor: override.obligationMinor,
        source: "operator_override" as const,
      };
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

  async resolveRegistrationPaymentCollection(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<FinancePaymentCollectionMode> {
    const canonical = await this.loadTourCanonical(input.tenantId, input.registrationId);
    if (canonical === null) {
      return "offline";
    }
    return this.resolvePaymentCollection(canonical);
  }

  async setRegistrationObligationOverride(
    input: FinanceRegistrationObligationOverrideInput
  ): Promise<boolean> {
    const override = buildObligationOverrideIntakeValue({
      obligationMinor: input.obligationMinor,
      setAt: input.setAt,
      setByUserId: input.setByUserId,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    });
    const updated = await this.bookings.mergeRegistrationIntake({
      bookingId: input.registrationId.trim(),
      tenantId: input.tenantId.trim(),
      patch: { [OBLIGATION_OVERRIDE_INTAKE_KEY]: override },
    });
    return updated !== null;
  }
}
