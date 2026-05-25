import { BadRequestException } from "@nestjs/common";
import type { TourFormProfile, TourTripDetails as TypesTourTripDetails } from "@repo/types";
import { checkDenaliPilotPublishGeolocationZones } from "@repo/shared-contracts";

import { TourEntity } from "../entities/tour.entity";
import { buildPublishPolicy } from "../strategies/workspace.strategy.builders";
import type { WorkspacePublishPolicy } from "../strategies/workspace.strategy.interface";
import {
  isDenaliStrategyProfile,
  WorkspaceStrategyRegistry,
} from "../strategies/workspace.strategy.registry";
import { assertEditRequiredTripDetailsForPublish } from "../utils/assert-edit-required-trip-details-for-publish";
import {
  assertProfileRequiredFieldsForPublish,
  tourEntityToProfileRequiredSubmitShape,
} from "../utils/assert-profile-required-fields-for-submit";
import { assertTripDetailsForFormProfile } from "../utils/assert-create-tour-invariants";
import { assertTourIsPublishable, assertTourOpenReadiness } from "./tour-lifecycle.policy";
import type { TourTripDetails } from "../types/tour-trip-details.types";

function loadPublishPolicy(profile: TourFormProfile): WorkspacePublishPolicy {
  try {
    return WorkspaceStrategyRegistry.resolve(profile).getPublishPolicy();
  } catch {
    return buildPublishPolicy(profile, {
      publishGeolocationCheck:
        isDenaliStrategyProfile(profile) && profile === "denali_pilot"
          ? (tripDetails: unknown) => {
              const details = tripDetails as TypesTourTripDetails | null | undefined;
              return checkDenaliPilotPublishGeolocationZones(details);
            }
          : null,
    });
  }
}

function throwWorkspaceViolationFromPublish(
  violation: { code: string; message: string },
): never {
  throw new BadRequestException({
    error: {
      code: violation.code,
      message: violation.message,
    },
  });
}

function assertPublishGeolocationIfRequired(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null,
): void {
  const { publishGeolocationCheck } = loadPublishPolicy(profile);
  if (publishGeolocationCheck == null) {
    return;
  }
  const geoViolation = publishGeolocationCheck(tripDetails as TypesTourTripDetails | null);
  if (geoViolation != null) {
    throwWorkspaceViolationFromPublish(geoViolation);
  }
}

function assertPublishProfileAndEditFields(profile: TourFormProfile, tour: TourEntity): void {
  const tripDetails = (tour.details?.tripDetails ?? null) as TourTripDetails | null;
  assertPublishGeolocationIfRequired(profile, tripDetails);
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
 * Call only when {@link isTourDraftToOpenPublishTransition} is true (not on every PATCH).
 */
export function assertTourPublishableBeforePatch(tour: TourEntity): void {
  const profile = tour.formProfileSnapshot ?? "general";
  const { requiresDraftBeforePublish } = loadPublishPolicy(profile);
  if (requiresDraftBeforePublish) {
    assertTourIsPublishable(tour);
  } else {
    assertTourOpenReadiness({
      title: tour.title,
      totalCapacity: tour.totalCapacity,
      details: tour.details ?? null,
    });
  }
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
