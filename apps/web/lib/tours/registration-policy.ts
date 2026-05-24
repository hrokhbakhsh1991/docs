import {
  resolveTourAllowPrivateCar,
  type TourAllowPrivateCarInput,
  type TourRegistrationPolicyDto,
} from "@repo/types";

export { resolveTourAllowPrivateCar, type TourAllowPrivateCarInput };

export function mergeRegistrationPolicyIntoTour(tour: Record<string, unknown>): void {
  const allowPrivateCar = resolveTourAllowPrivateCar(tour as TourAllowPrivateCarInput);
  const policy: TourRegistrationPolicyDto = { allowPrivateCar };
  tour.registrationPolicy = policy;
}
