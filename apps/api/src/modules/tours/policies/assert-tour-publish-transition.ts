import type { TourFormProfile } from "@repo/types";

import { TourEntity } from "../entities/tour.entity";
import { assertEditRequiredTripDetailsForPublish } from "../utils/assert-edit-required-trip-details-for-publish";
import {
  assertProfileRequiredFieldsForPublish,
  tourEntityToProfileRequiredSubmitShape,
} from "../utils/assert-profile-required-fields-for-submit";
import { assertTourIsPublishable, assertTourOpenReadiness } from "./tour-lifecycle.policy";

function assertPublishProfileAndEditFields(profile: TourFormProfile, tour: TourEntity): void {
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
