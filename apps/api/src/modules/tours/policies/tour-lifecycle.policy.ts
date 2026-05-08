import { BadRequestException } from "@nestjs/common";
import { TourEntity as Tour, TourLifecycleStatus } from "../entities/tour.entity";

export function assertValidLifecycleTransition(
  current: TourLifecycleStatus,
  next: TourLifecycleStatus
): void {
  if (current === next) {
    return;
  }

  const allowed =
    (current === TourLifecycleStatus.DRAFT &&
      (next === TourLifecycleStatus.OPEN || next === TourLifecycleStatus.CANCELLED)) ||
    (current === TourLifecycleStatus.OPEN &&
      (next === TourLifecycleStatus.CLOSED || next === TourLifecycleStatus.CANCELLED)) ||
    (current === TourLifecycleStatus.CLOSED && next === TourLifecycleStatus.CANCELLED);

  if (allowed) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Invalid lifecycle transition from ${current} to ${next}`
    }
  });
}

export function assertTourIsOpenForRegistration(tour: Tour): void {
  if (tour.lifecycleStatus === TourLifecycleStatus.OPEN) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "TOUR_NOT_OPEN",
      message: "Tour is not open for registrations"
    }
  });
}

export function assertTourIsPublishable(tour: Tour): void {
  if (!tour.title || tour.title.trim() === "") {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour title is required before publishing"
      }
    });
  }

  if (!Number.isFinite(tour.totalCapacity) || tour.totalCapacity <= 0) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour total capacity must be greater than zero before publishing"
      }
    });
  }

  const startDate = (tour as unknown as { startDate?: Date | string | null }).startDate;
  if (!startDate) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour start date is required before publishing"
      }
    });
  }

  if (tour.lifecycleStatus !== TourLifecycleStatus.DRAFT) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Only draft tours can be published"
      }
    });
  }

  if (
    tour.details?.durationDays !== undefined &&
    tour.details?.durationDays !== null &&
    tour.details.durationDays <= 0
  ) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour details durationDays must be greater than zero when provided"
      }
    });
  }
}
