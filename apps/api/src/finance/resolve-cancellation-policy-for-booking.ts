/**
 * DP-6 — resolve tour cancellation policy from canonical document.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { createTourStorageRepository } from "../storage/create-tour-storage.ts";

function readPolicyNumber(
  canonical: Readonly<Record<string, unknown>> | null,
  path: string
): number | null {
  if (canonical === null) {
    return null;
  }
  const policies = canonical.policies;
  if (typeof policies !== "object" || policies === null) {
    return null;
  }
  const key = path.replace(/^policies\./, "");
  const raw = (policies as Record<string, unknown>)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

export async function resolveCancellationPolicyForBooking(input: {
  readonly tenantId: string;
  readonly bookingId: string;
}): Promise<{
  readonly cancellationDeadlineHours: number | null;
  readonly cancellationPenaltyPercentage: number | null;
}> {
  const booking = await getBookingsRepository().getById(input.bookingId, input.tenantId);
  if (booking === null) {
    return { cancellationDeadlineHours: null, cancellationPenaltyPercentage: null };
  }
  const tourStore = createTourStorageRepository();
  const tour = await tourStore.getById(booking.tourId, input.tenantId);
  const canonical =
    (tour?.canonical as Readonly<Record<string, unknown>> | undefined) ?? null;
  return {
    cancellationDeadlineHours: readPolicyNumber(canonical, "policies.cancellationDeadlineHours"),
    cancellationPenaltyPercentage: readPolicyNumber(
      canonical,
      "policies.cancellationPenaltyPercentage"
    ),
  };
}
