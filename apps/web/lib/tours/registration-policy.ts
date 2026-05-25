import {
  resolveTourAllowPrivateCar,
  type TourAllowPrivateCarInput,
  type TourRegistrationPolicyDto,
} from "@repo/types";

import type { TourDto } from "@repo/types";

export { resolveTourAllowPrivateCar, type TourAllowPrivateCarInput };

/** Maps tour row fields into the narrow shape used by {@link resolveTourAllowPrivateCar}. */
export function toTourAllowPrivateCarInput(
  tour: Pick<TourDto, "transportModes" | "details">,
): TourAllowPrivateCarInput {
  const tripDetails = tour.details?.tripDetails;
  if (!tripDetails || typeof tripDetails !== "object") {
    return { transportModes: tour.transportModes };
  }
  const td = tripDetails as {
    transport?: { allowPersonalCar?: boolean };
    logistics?: { primaryTransportMode?: string };
  };
  return {
    transportModes: tour.transportModes,
    details: {
      tripDetails: {
        transport: td.transport,
        logistics: td.logistics,
      },
    },
  };
}

export function mergeRegistrationPolicyIntoTour(tour: Record<string, unknown>): void {
  const allowPrivateCar = resolveTourAllowPrivateCar(tour as TourAllowPrivateCarInput);
  const policy: TourRegistrationPolicyDto = { allowPrivateCar };
  tour.registrationPolicy = policy;
}
