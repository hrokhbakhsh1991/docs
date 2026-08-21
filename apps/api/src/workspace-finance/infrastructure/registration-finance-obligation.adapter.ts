import type {
  FinanceObligationPort,
  FinancePaymentCollectionMode,
  FinanceRegistrationObligationOverrideInput,
} from "@app-tour/finance-http-contracts";
import {
  buildObligationOverrideIntakeValue,
  isZeroObligationMinor,
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
  /** Booking intake bag — Denali reads `transport.kind` for dong / organized add-ons. */
  readonly registrationIntake?: unknown;
}) => {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly lines?: readonly { readonly code: string; readonly amountMinor: string }[];
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
      "offline",
    /** Optional gross resolver — preserves list price when payable is waived or overridden. */
    private readonly resolveGrossObligation?: RegistrationObligationResolver
  ) {}

  private resolveGrossPricing(input: {
    readonly tourCanonical: unknown;
    readonly partySize: number;
    readonly registrationIntake?: unknown;
  }) {
    const resolver = this.resolveGrossObligation ?? this.resolveObligation;
    return resolver({
      tourCanonical: input.tourCanonical,
      partySize: input.partySize,
      ...(input.registrationIntake !== undefined
        ? { registrationIntake: input.registrationIntake }
        : {}),
    });
  }

  private resolveDiscountableBaseMinor(
    obligation: ReturnType<RegistrationObligationResolver>
  ): string | undefined {
    const tripLine = obligation?.lines?.find((line) => line.code === "trip");
    return tripLine?.amountMinor;
  }

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
          : this.resolveGrossPricing({
              tourCanonical: tour.canonical,
              partySize: booking.partySize,
              ...(booking.registrationIntake !== undefined
                ? { registrationIntake: booking.registrationIntake }
                : {}),
            });
      const discountableBaseMinor = this.resolveDiscountableBaseMinor(base);
      return {
        currency: base?.currency ?? this.resolveDefaultCurrency(),
        obligationMinor: override.obligationMinor,
        ...(base !== null
          ? {
              grossObligationMinor: base.obligationMinor,
              ...(discountableBaseMinor !== undefined ? { discountableBaseMinor } : {}),
            }
          : {}),
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
      ...(booking.registrationIntake !== undefined
        ? { registrationIntake: booking.registrationIntake }
        : {}),
    });
    if (resolved === null) {
      return null;
    }

    const collectionMode = this.resolvePaymentCollection(tour.canonical);
    if (
      collectionMode === "free" &&
      isZeroObligationMinor(resolved.obligationMinor) &&
      this.resolveGrossObligation !== undefined
    ) {
      const gross = this.resolveGrossPricing({
        tourCanonical: tour.canonical,
        partySize: booking.partySize,
        ...(booking.registrationIntake !== undefined
          ? { registrationIntake: booking.registrationIntake }
          : {}),
      });
      if (gross !== null) {
        const discountableBaseMinor = this.resolveDiscountableBaseMinor(gross);
        return {
          currency: resolved.currency,
          obligationMinor: resolved.obligationMinor,
          grossObligationMinor: gross.obligationMinor,
          ...(discountableBaseMinor !== undefined ? { discountableBaseMinor } : {}),
          source: resolved.source,
        };
      }
    }

    const discountableBaseMinor = this.resolveDiscountableBaseMinor(resolved);
    return {
      currency: resolved.currency,
      obligationMinor: resolved.obligationMinor,
      ...(discountableBaseMinor !== undefined ? { discountableBaseMinor } : {}),
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
