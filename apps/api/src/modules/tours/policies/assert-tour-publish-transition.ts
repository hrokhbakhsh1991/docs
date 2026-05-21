import { BadRequestException } from "@nestjs/common";
import type { TourFormProfile, TourTripDetails as TypesTourTripDetails } from "@repo/types";
import { checkDenaliPilotPublishGeolocationZones } from "@repo/shared-contracts";

import { TourEntity } from "../entities/tour.entity";
import { assertEditRequiredTripDetailsForPublish } from "../utils/assert-edit-required-trip-details-for-publish";
import {
  assertProfileRequiredFieldsForPublish,
  tourEntityToProfileRequiredSubmitShape,
} from "../utils/assert-profile-required-fields-for-submit";
import { assertTripDetailsForFormProfile } from "../utils/assert-create-tour-invariants";
import { assertTourIsPublishable, assertTourOpenReadiness } from "./tour-lifecycle.policy";
import type { TourTripDetails } from "../types/tour-trip-details.types";

function assertPublishProfileAndEditFields(profile: TourFormProfile, tour: TourEntity): void {
  const tripDetails = (tour.details?.tripDetails ?? null) as TourTripDetails | null;
  if (profile === "denali_pilot") {
    const geoViolation = checkDenaliPilotPublishGeolocationZones(
      tripDetails as TypesTourTripDetails | null,
    );
    if (geoViolation != null) {
      throw new BadRequestException({
        error: {
          code: geoViolation.code,
          message: geoViolation.message,
        },
      });
    }
  }
  assertTripDetailsForFormProfile(
    profile,
    tripDetails,
    tour.transportModes ?? [],
  );
  assertProfileRequiredFieldsForPublish(
    profile,
    tourEntityToProfileRequiredSubmitShape(tour),
  );
  assertEditRequiredTripDetailsForPublish(
    profile,
    (tour.details?.tripDetails ?? null) as Record<string, unknown> | null,
  );
  assertTourOpenReadiness({
    title: tour.title,
    totalCapacity: tour.totalCapacity,
    details: tour.details ?? null,
  });
}

/**
 * Pre-merge PATCH gate: tour must still be DRAFT and meet publish readiness on persisted row.
 * Call before applying `lifecycle_status: OPEN` to the entity.
 */
export function assertTourPublishableBeforePatch(tour: TourEntity): void {
  assertTourIsPublishable(tour);
}

/**
 * Post-merge PATCH gate (after strip): profile submit-required + OPEN readiness on merged state.
 * Parity with wizard submit + {@link assertTourOpenReadiness} on create→OPEN.
 */
export function assertTourStateReadyForOpenAfterPatch(
  profile: TourFormProfile,
  tour: TourEntity,
): void {
  assertPublishProfileAndEditFields(profile, tour);
}

/**
 * Create→OPEN gate: wizard submit-required + Edit presets + readiness (no DRAFT lifecycle check).
 */
export function assertTourStateReadyForOpenOnCreate(
  profile: TourFormProfile,
  tour: TourEntity,
): void {
  assertPublishProfileAndEditFields(profile, tour);
}
