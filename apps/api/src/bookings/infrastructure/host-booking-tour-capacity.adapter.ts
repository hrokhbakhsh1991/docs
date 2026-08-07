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
    const many = await this.resolveTourCapacityMaxMany(tenantId, [tourId]);
    return many[tourId.trim()] ?? null;
  }

  async resolveTourCapacityMaxMany(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number | null>>> {
    const tenant = tenantId.trim();
    const unique = [
      ...new Set(tourIds.map((id) => id.trim()).filter((id) => id.length > 0)),
    ];
    if (tenant.length === 0 || unique.length === 0) {
      return {};
    }
    const tours = await createTourStorageRepository().getByIds(unique, tenant);
    const byId = new Map(tours.map((tour) => [tour.id, tour] as const));
    const out: Record<string, number | null> = {};
    for (const id of unique) {
      const tour = byId.get(id);
      out[id] =
        tour === undefined ? null : readCapacityMaxFromTourData(tour.canonical.data);
    }
    return out;
  }
}
