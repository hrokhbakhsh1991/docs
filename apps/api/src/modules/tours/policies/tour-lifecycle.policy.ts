import { BadRequestException } from "@nestjs/common";
import { TourEntity as Tour, TourLifecycleStatus } from "../entities/tour.entity";

/** Shape used to validate title/capacity/details before setting lifecycle to OPEN (create or transition). */
export type TourOpenReadinessInput = {
  title: string;
  totalCapacity: number;
  details?: { durationDays?: number | null } | null;
};

/**
 * Content rules required for a tour to be OPEN (no lifecycle checks).
 * Centralizes publish readiness so create and update paths stay aligned.
 */
export function assertTourOpenReadiness(snapshot: TourOpenReadinessInput): void {
  if (!snapshot.title || snapshot.title.trim() === "") {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour title is required before publishing"
      }
    });
  }

  if (!Number.isFinite(snapshot.totalCapacity) || snapshot.totalCapacity <= 0) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour total capacity must be greater than zero before publishing"
      }
    });
  }

  const durationDays = snapshot.details?.durationDays;
  if (
    durationDays !== undefined &&
    durationDays !== null &&
    durationDays <= 0
  ) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Tour details durationDays must be greater than zero when provided"
      }
    });
  }
}

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

/**
 * Validates that a persisted DRAFT tour may transition to OPEN (draft gate + readiness).
 */
export function assertTourIsPublishable(tour: Tour): void {
  assertTourOpenReadiness({
    title: tour.title,
    totalCapacity: tour.totalCapacity,
    details: tour.details ?? null
  });

  if (tour.lifecycleStatus !== TourLifecycleStatus.DRAFT) {
    throw new BadRequestException({
      error: {
        code: "TOUR_NOT_PUBLISHABLE",
        message: "Only draft tours can be published"
      }
    });
  }
}
