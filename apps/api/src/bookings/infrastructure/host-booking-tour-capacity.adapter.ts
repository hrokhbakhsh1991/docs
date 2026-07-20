/**
 * Host adapter — tour canonical `capacityMax` via tour storage (Prisma or memory).
 */
import { createTourStorageRepository } from "../../storage/create-tour-storage";
import type { BookingTourCapacityPort } from "../ports/booking-tour-capacity.port";

function readCapacityMaxFromTourData(data: unknown): number | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const capacityMax = (data as Record<string, unknown>).capacityMax;
  if (typeof capacityMax !== "number" || !Number.isFinite(capacityMax)) {
    return null;
  }
  const truncated = Math.trunc(capacityMax);
  return truncated >= 1 ? truncated : null;
}

export class HostBookingTourCapacityAdapter implements BookingTourCapacityPort {
  readonly kind = "host-booking-tour-capacity";

  async resolveTourCapacityMax(tenantId: string, tourId: string): Promise<number | null> {
    const id = tourId.trim();
    const tenant = tenantId.trim();
    if (id.length === 0 || tenant.length === 0) {
      return null;
    }
    const tour = await createTourStorageRepository().getById(id, tenant);
    if (tour === null) {
      return null;
    }
    return readCapacityMaxFromTourData(tour.canonical.data);
  }
}
