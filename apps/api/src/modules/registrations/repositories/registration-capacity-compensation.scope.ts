import { AsyncLocalStorage } from "node:async_hooks";

import type { TourCapacityReleaseInput } from "../../tours/domain/ports/tour-capacity-reservation.port";

const capacityCompensationStorage = new AsyncLocalStorage<TourCapacityReleaseInput[]>();

export function runWithRegistrationCapacityCompensation<T>(fn: () => Promise<T>): Promise<T> {
  return capacityCompensationStorage.run([], fn);
}

/** Register a Redis slot to release if the enclosing DB transaction aborts. */
export function registerRegistrationCapacityCompensation(input: TourCapacityReleaseInput): void {
  const store = capacityCompensationStorage.getStore();
  if (!store) {
    return;
  }
  store.push({
    tenantId: input.tenantId,
    tourId: input.tourId,
    totalCapacity: input.totalCapacity,
  });
}

export function takePendingRegistrationCapacityCompensations(): TourCapacityReleaseInput[] {
  const store = capacityCompensationStorage.getStore();
  if (!store || store.length === 0) {
    return [];
  }
  return store.splice(0, store.length);
}

export function clearRegistrationCapacityCompensations(): void {
  const store = capacityCompensationStorage.getStore();
  if (store) {
    store.length = 0;
  }
}
