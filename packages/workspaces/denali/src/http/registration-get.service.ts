import type { RegistrationCommercialPricingDisplay } from "@app-tour/finance-http-contracts";

import { resolveDenaliRegistrationDueBreakdown } from "../finance/resolve-denali-registration-obligation";
import type { DenaliRegistrationDueLine } from "../finance/resolve-denali-registration-obligation";
import { DenaliRegistrationNotFoundError } from "./errors/denali-registration-not-found.error";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { RegistrationCommercialPricingPort } from "./ports/registration-commercial-pricing.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

export type DenaliOwnedTransportKind =
  | "primary"
  | "personal_car"
  | "no_car_dong"
  | "no_car_acquaintance";

const OWNED_TRANSPORT_KINDS = new Set<string>([
  "primary",
  "personal_car",
  "no_car_dong",
  "no_car_acquaintance",
]);

export type DenaliOwnedTransportScalars = {
  readonly transportKind?: DenaliOwnedTransportKind;
  readonly personalCarOccupants?: 1 | 2 | 3;
};

/**
 * Safe transport scalars for member BFF owned detail (BK-SAFE-01).
 * Never return the raw `registrationIntake` blob to portal.
 */
export function readDenaliOwnedTransport(intake: unknown): DenaliOwnedTransportScalars {
  if (intake === null || typeof intake !== "object") {
    return {};
  }
  const transport = (intake as Record<string, unknown>).transport;
  if (transport === null || typeof transport !== "object") {
    return {};
  }
  const rec = transport as Record<string, unknown>;
  const kind = rec.kind;
  if (typeof kind !== "string" || !OWNED_TRANSPORT_KINDS.has(kind)) {
    return {};
  }
  const transportKind = kind as DenaliOwnedTransportKind;
  if (transportKind !== "personal_car") {
    return { transportKind };
  }
  const occupants = rec.personalCarOccupants;
  if (occupants === 1 || occupants === 2 || occupants === 3) {
    return { transportKind, personalCarOccupants: occupants };
  }
  return { transportKind };
}

export type DenaliRegistrationOwnedDetail = {
  readonly id: string;
  readonly status: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly registrantTarget: "self" | "other";
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly partySize: number;
  readonly transportKind?: DenaliOwnedTransportKind;
  readonly personalCarOccupants?: 1 | 2 | 3;
  readonly dueCurrency?: string;
  readonly dueTotalMinor?: string;
  readonly dueLines?: readonly DenaliRegistrationDueLine[];
  readonly commercialPricing?: RegistrationCommercialPricingDisplay;
  readonly paymentDueAt?: string | null;
  readonly cancelSource?: string | null;
};

/**
 * Member-owned registration detail — deep link `/me/registrations/{id}` SSR.
 * Does not require scanning GET /bookings?view=mine.
 * When tour pricing resolves, includes transport-aware due total + lines for receipt UX.
 */
export async function getDenaliRegistrationOwned(params: {
  readonly tenantId: string;
  readonly guestUserId: string;
  readonly registrationId: string;
  readonly bookingPort: BookingPublicPort;
  readonly store: DenaliTourStorePort;
  readonly commercialPricingPort?: RegistrationCommercialPricingPort;
}): Promise<DenaliRegistrationOwnedDetail> {
  const owned = await params.bookingPort.findOwnedBooking(
    params.tenantId,
    params.registrationId,
    params.guestUserId
  );
  if (owned === null) {
    throw new DenaliRegistrationNotFoundError();
  }

  const transportScalars = readDenaliOwnedTransport(owned.registrationIntake);

  const base: DenaliRegistrationOwnedDetail = {
    id: owned.id,
    status: owned.status,
    tourId: owned.tourId,
    tourTitle: owned.tourTitle,
    guestLabel: owned.guestLabel,
    registrantTarget: owned.registrantTarget,
    paymentStatus: owned.paymentStatus,
    departureAt: owned.departureAt,
    submittedAt: owned.submittedAt,
    partySize: owned.partySize,
    ...(owned.paymentDueAt !== undefined ? { paymentDueAt: owned.paymentDueAt } : {}),
    ...(owned.cancelSource !== undefined ? { cancelSource: owned.cancelSource } : {}),
    ...transportScalars,
  };

  const tour = await params.store.findFirst({
    tenantId: params.tenantId,
    id: owned.tourId,
  });
  if (tour === null) {
    return base;
  }

  const due = resolveDenaliRegistrationDueBreakdown({
    tourCanonical: tour.canonical,
    partySize: owned.partySize,
    ...(owned.registrationIntake !== undefined
      ? { registrationIntake: owned.registrationIntake }
      : {}),
  });
  if (due === null || due.obligationMinor === "0") {
    return base;
  }

  const commercialPricing =
    params.commercialPricingPort === undefined
      ? null
      : await params.commercialPricingPort.resolveRegistrationCommercialPricing({
          tenantId: params.tenantId,
          registrationId: params.registrationId,
        });

  return {
    ...base,
    dueCurrency: commercialPricing?.currency ?? due.currency,
    dueTotalMinor: commercialPricing?.payableMinor ?? due.obligationMinor,
    dueLines: due.lines,
    ...(commercialPricing !== null ? { commercialPricing } : {}),
  };
}
