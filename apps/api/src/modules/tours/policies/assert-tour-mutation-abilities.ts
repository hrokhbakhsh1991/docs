import { ForbiddenException } from "@nestjs/common";
import type { AppAbility } from "@repo/shared";

import { AbilityAction } from "../../../common/casl/ability-actions";
import type { CreateTourDto } from "../dto/create-tour.dto";
import type { UpdateTourDto } from "../dto/update-tour.dto";
import { TourLifecycleStatus } from "../entities/tour.entity";

/** DTO keys that require `tour.update.core` / CASL `update TourCore`. */
const CORE_PATCH_KEYS = new Set<keyof UpdateTourDto>([
  "title",
  "description",
  "total_capacity",
  "lifecycle_status",
  "chat_link",
  "cost_context",
  "autoAcceptRegistrations",
  "tourType",
  "formProfile",
]);

/** DTO keys that require `tour.update.tripDetails` / CASL `update TourTripDetails`. */
const TRIP_DETAILS_PATCH_KEYS = new Set<keyof UpdateTourDto>([
  "transportModes",
  "destinationId",
  "destinationName",
  "elevationM",
  "difficulty",
  "durationDays",
  "meetingPoint",
  "itinerary",
  "tripDetails",
]);

function forbidCapability(capability: string): never {
  throw new ForbiddenException({
    error: {
      code: "AUTH_FORBIDDEN_ABILITY",
      message: `Insufficient permissions for capability: ${capability}`,
    },
  });
}

function presentPatchKeys(dto: UpdateTourDto): (keyof UpdateTourDto)[] {
  return (Object.keys(dto) as (keyof UpdateTourDto)[]).filter((key) => dto[key] !== undefined);
}

/**
 * Body-aware CASL checks for `PATCH /tours/:id` (Phase 3 slice 2).
 * Coarse `@CheckAbilities(Update, Tour)` must still pass on the handler.
 */
export function assertTourPatchAbilities(ability: AppAbility, dto: UpdateTourDto): void {
  if (!ability.can(AbilityAction.Update, "Tour")) {
    forbidCapability("tour.update");
  }

  const keys = presentPatchKeys(dto);
  const usesCore = keys.some((k) => CORE_PATCH_KEYS.has(k));
  const usesTripDetails = keys.some((k) => TRIP_DETAILS_PATCH_KEYS.has(k));
  const publishes = dto.lifecycle_status === TourLifecycleStatus.OPEN;

  if (usesCore && !ability.can(AbilityAction.Update, "TourCore")) {
    forbidCapability("tour.update.core");
  }
  if (usesTripDetails && !ability.can(AbilityAction.Update, "TourTripDetails")) {
    forbidCapability("tour.update.tripDetails");
  }
  if (publishes && !ability.can(AbilityAction.Publish, "Tour")) {
    forbidCapability("tour.publish");
  }
}

/**
 * Body-aware publish check for `POST /tours` when creating directly as OPEN.
 */
export function assertTourCreateAbilities(ability: AppAbility, dto: CreateTourDto): void {
  if (!ability.can(AbilityAction.Create, "Tour")) {
    forbidCapability("tour.create");
  }
  if (
    dto.lifecycle_status === TourLifecycleStatus.OPEN &&
    !ability.can(AbilityAction.Publish, "Tour")
  ) {
    forbidCapability("tour.publish");
  }
}
