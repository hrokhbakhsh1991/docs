import { BadRequestException } from "@nestjs/common";
import { TourLifecycleStatus } from "@repo/domain-contracts";

import type { TourCapacityPolicySnapshot } from "../domain/registration-policy.types";
import type { WaitlistItemPolicySnapshot } from "../domain/registration-policy.types";

export function assertTourAllowsWaitlist(tour: TourCapacityPolicySnapshot): void {
  if (
    tour.lifecycleStatus === TourLifecycleStatus.OPEN &&
    tour.acceptedCount >= tour.totalCapacity
  ) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "WAITLIST_NOT_ALLOWED",
      message: "Waitlist is only allowed when the tour is full and open"
    }
  });
}

export function assertWaitlistPromotionAllowed(tour: TourCapacityPolicySnapshot): void {
  if (
    tour.lifecycleStatus === TourLifecycleStatus.OPEN &&
    tour.acceptedCount < tour.totalCapacity
  ) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "WAITLIST_PROMOTION_NOT_ALLOWED",
      message: "Waitlist promotion is not allowed for this tour state"
    }
  });
}

export function assertNoDuplicateWaitlist(existingWaitlistItems: WaitlistItemPolicySnapshot[]): void {
  const hasDuplicate = existingWaitlistItems.some((item) => {
    const normalized = String(item.status ?? "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase();
    return normalized === "WAITING" || normalized === "PENDINGCONVERSION";
  });

  if (!hasDuplicate) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "USER_ALREADY_IN_WAITLIST",
      message: "User already exists in waitlist for this tour"
    }
  });
}
