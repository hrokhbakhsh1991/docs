import { resolveDenaliRegistrationDueBreakdown } from "../finance/resolve-denali-registration-obligation";
import type { DenaliRegistrationDueLine } from "../finance/resolve-denali-registration-obligation";
import { DenaliRegistrationNotFoundError } from "./errors/denali-registration-not-found.error";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

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
  readonly dueCurrency?: string;
  readonly dueTotalMinor?: string;
  readonly dueLines?: readonly DenaliRegistrationDueLine[];
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
}): Promise<DenaliRegistrationOwnedDetail> {
  const owned = await params.bookingPort.findOwnedBooking(
    params.tenantId,
    params.registrationId,
    params.guestUserId
  );
  if (owned === null) {
    throw new DenaliRegistrationNotFoundError();
  }

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

  return {
    ...base,
    dueCurrency: due.currency,
    dueTotalMinor: due.obligationMinor,
    dueLines: due.lines,
  };
}
