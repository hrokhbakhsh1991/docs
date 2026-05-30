import { CapacityExceededException } from "../../src/common/errors/capacity-exceeded.exception";
import type { TourCapacityReservationPort } from "../../src/modules/tours/domain/ports/tour-capacity-reservation.port";
import type { TourCatalogPortTestDoubleState } from "./stub-registrations-tour-catalog.port";

export function createNoOpTourCapacityReservationPortTestDouble(): TourCapacityReservationPort {
  return {
    async reserveTicket() {},
    async releaseTicket() {},
    async syncRemainingFromSnapshot() {},
  };
}

export function createTourCapacityReservationPortTestDouble(
  tour: TourCatalogPortTestDoubleState
): TourCapacityReservationPort {
  let virtualRemaining: number | null = null;

  const remainingFromTour = (): number =>
    Math.max(0, tour.totalCapacity - tour.acceptedCount);

  const getRemaining = (): number =>
    virtualRemaining ?? remainingFromTour();

  return {
    async reserveTicket(input) {
      if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
        throw new CapacityExceededException();
      }
      const rem = getRemaining();
      if (rem <= 0) {
        throw new CapacityExceededException();
      }
      virtualRemaining = rem - 1;
    },
    async releaseTicket(input) {
      if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
        return;
      }
      const rem = getRemaining();
      virtualRemaining = Math.min(input.totalCapacity, rem + 1);
    },
    async syncRemainingFromSnapshot(input) {
      if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
        return;
      }
      virtualRemaining = Math.max(0, input.totalCapacity - input.acceptedCount);
    },
  };
}
