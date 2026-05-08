import { BadRequestException } from "@nestjs/common";
import { TourEntity as Tour, TourLifecycleStatus } from "../../tours/entities/tour.entity";
import { WaitlistItemEntity } from "../waitlist-item.entity";

export function assertTourAllowsWaitlist(tour: Tour): void {
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

export function assertWaitlistPromotionAllowed(tour: Tour): void {
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

export function assertNoDuplicateWaitlist(existingWaitlistItems: WaitlistItemEntity[]): void {
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
