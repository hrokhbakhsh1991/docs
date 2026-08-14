import type { BookingPublicPort } from "./ports/public-booking.port";

export type DenaliForTourRegistrationResult = {
  readonly self: { readonly id: string; readonly status: string } | null;
};

/**
 * Member gate for catalog register — active self registration on this tour, if any.
 */
export async function getDenaliRegistrationForTour(params: {
  readonly tenantId: string;
  readonly guestUserId: string;
  readonly tourId: string;
  readonly bookingPort: BookingPublicPort;
}): Promise<DenaliForTourRegistrationResult> {
  const self = await params.bookingPort.findDuplicateByTourGuest(
    params.tenantId,
    params.tourId,
    params.guestUserId
  );
  return { self };
}
