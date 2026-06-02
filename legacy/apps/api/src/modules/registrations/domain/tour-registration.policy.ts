import { BadRequestException } from "@nestjs/common";
import { TourLifecycleStatus } from "@repo/domain-contracts";

import type { TourCapacityPolicySnapshot } from "./registration-policy.types";

export function assertTourIsOpenForRegistration(tour: TourCapacityPolicySnapshot): void {
  if (tour.lifecycleStatus === TourLifecycleStatus.OPEN) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "TOUR_NOT_OPEN",
      message: "Tour is not open for registrations",
    },
  });
}
