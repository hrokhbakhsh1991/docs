import { BadRequestException } from "@nestjs/common";
import { isTourLifecycleTransitionAllowed } from "@repo/shared";
import { TourLifecycleStatus } from "@repo/domain-contracts";

import type { TourCapacityPolicySnapshot } from "../domain/tour-policy.types";
import { TOUR_DURATION_DAYS_MAX, TOUR_DURATION_DAYS_MIN } from "../utils/tour-duration";

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
  if (durationDays !== undefined && durationDays !== null) {
    if (
      !Number.isInteger(durationDays) ||
      durationDays < TOUR_DURATION_DAYS_MIN ||
      durationDays > TOUR_DURATION_DAYS_MAX
    ) {
      throw new BadRequestException({
        error: {
          code: "TOUR_NOT_PUBLISHABLE",
          message: `Tour details durationDays must be an integer between ${TOUR_DURATION_DAYS_MIN} and ${TOUR_DURATION_DAYS_MAX} when provided`
        }
      });
    }
  }
}

export function assertValidLifecycleTransition(
  current: TourLifecycleStatus,
  next: TourLifecycleStatus
): void {
  if (
    isTourLifecycleTransitionAllowed(
      current as "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED",
      next as "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED",
    )
  ) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Invalid lifecycle transition from ${current} to ${next}`
    }
  });
}

export function assertTourIsOpenForRegistration(tour: TourCapacityPolicySnapshot): void {
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
 * True when PATCH explicitly requests DRAFT → OPEN (publish), not a no-op or field-only save.
 */
export function isTourDraftToOpenPublishTransition(
  current: TourLifecycleStatus,
  requestedLifecycle: TourLifecycleStatus | undefined,
): boolean {
  return (
    requestedLifecycle === TourLifecycleStatus.OPEN &&
    current === TourLifecycleStatus.DRAFT
  );
}

/**
 * Validates that a persisted DRAFT tour may transition to OPEN (draft gate + readiness).
 */
export function assertTourIsPublishable(tour: TourCapacityPolicySnapshot & TourOpenReadinessInput): void {
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
