/**
 * DP1-B — resolve payment deadline policy hours for a booking's tour context.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { createTourStorageRepository } from "../storage/create-tour-storage.ts";
import { resolveDenaliPaymentDeadlineHours } from "../workspace/denali-host-legacy-bindings.generated.ts";

export async function resolvePaymentHoldPolicyHoursForBooking(input: {
  readonly tenantId: string;
  readonly bookingId: string;
}): Promise<number | null> {
  const booking = await getBookingsRepository().getById(input.bookingId, input.tenantId);
  if (booking === null) {
    return resolveDenaliPaymentDeadlineHours({ tourCanonical: null });
  }

  const tourStore = createTourStorageRepository();
  const tour = await tourStore.getById(booking.tourId, input.tenantId);
  return resolveDenaliPaymentDeadlineHours({
    tourCanonical: (tour?.canonical as Readonly<Record<string, unknown>> | undefined) ?? null,
  });
}
