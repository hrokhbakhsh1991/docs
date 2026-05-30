import {
  denaliLocationFromApi,
  gatheringPickupStationIsConcrete,
  isDenaliEventTourKind,
  isDenaliTourKind,
  normalizeGatheringPickupStations,
  type TourTripDetails,
} from "@repo/types";

export interface WorkspaceInvariantViolation {
  code: string;
  message: string;
}

const DENALI_DONG_PRIVATE_CAR_MODES = new Set(["car_share_fixed_dong", "driver_gets_dong"]);
const DENALI_PARTICIPATION_FITNESS_LEVELS = new Set(["easy", "moderate", "hard", "technical"]);
const DENALI_MOUNTAIN_TOUR_KINDS = new Set(["mountain_day", "mountain_multi"]);

function overviewHasNumericValue(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

function isDenaliMountainTourKind(kind: unknown): boolean {
  return typeof kind === "string" && DENALI_MOUNTAIN_TOUR_KINDS.has(kind);
}

function isDenaliTourKindProvided(kindRaw: unknown): kindRaw is string {
  return typeof kindRaw === "string" && kindRaw.trim() !== "";
}

function participationFitnessLevelPresent(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && DENALI_PARTICIPATION_FITNESS_LEVELS.has(value);
}

function participationMinimumAgePresent(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function checkDenaliPilotCapacity(capacity: number): WorkspaceInvariantViolation | null {
  if (!isPositiveInteger(capacity)) {
    return {
      code: "WORKSPACE_RULE_DENALI_TOTAL_CAPACITY_INVALID",
      message: "total_capacity must be a positive integer for denali_pilot create.",
    };
  }
  return null;
}

export function checkDenaliPilotTripDetails(
  tripDetails: TourTripDetails | null | undefined,
  rootTransportModes?: readonly string[] | null,
): WorkspaceInvariantViolation | null {
  if (tripDetails == null) {
    return {
      code: "WORKSPACE_RULE_DENALI_TRIP_DETAILS_REQUIRED",
      message: "tripDetails is required for denali_pilot create.",
    };
  }

  const overview = tripDetails.overview as Record<string, unknown> | undefined;
  const kindRaw = overview?.denaliTourKind;

  if (!isDenaliTourKindProvided(kindRaw)) {
    return {
      code: "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED",
      message: "overview.denaliTourKind is required when tripDetails is present for denali_pilot create.",
    };
  }

  if (!isDenaliTourKind(kindRaw)) {
    return {
      code: "WORKSPACE_RULE_DENALI_TOUR_KIND_INVALID",
      message: `overview.denaliTourKind must be one of the Denali tour kind slugs (got ${String(kindRaw)}).`,
    };
  }

  if (typeof kindRaw === "string" && isDenaliTourKind(kindRaw) && isDenaliEventTourKind(kindRaw)) {
    if (overviewHasNumericValue(overview?.difficultyLevel)) {
      return {
        code: "WORKSPACE_RULE_DENALI_EVENT_DIFFICULTY_FORBIDDEN",
        message:
          "overview.difficultyLevel must not be set for event_reading / event_cinema Denali tour kinds.",
      };
    }
    if (overviewHasNumericValue(overview?.elevationGainMeters)) {
      return {
        code: "WORKSPACE_RULE_DENALI_EVENT_ELEVATION_FORBIDDEN",
        message:
          "overview.elevationGainMeters must not be set for event_reading / event_cinema Denali tour kinds.",
      };
    }
  }

  const log = tripDetails.logistics as
    | (TourTripDetails["logistics"] & {
        privateCarMode?: string;
        fuelShareToman?: number | null;
        primaryTransportMode?: string;
        groupSizeMax?: number | null;
      })
    | undefined;

  const privateCarMode = log?.privateCarMode;
  if (privateCarMode != null && DENALI_DONG_PRIVATE_CAR_MODES.has(privateCarMode)) {
    const modes = rootTransportModes ?? [];
    const usesPrivateCar =
      modes.includes("private_car") || log?.primaryTransportMode === "private_car";
    if (usesPrivateCar && log?.fuelShareToman == null) {
      return {
        code: "WORKSPACE_RULE_DENALI_DONG_AMOUNT_REQUIRED",
        message:
          "logistics.fuelShareToman is required when privateCarMode is car_share_fixed_dong or driver_gets_dong and the tour uses private_car.",
      };
    }
  }

  if (log?.groupSizeMax != null && !isPositiveInteger(log.groupSizeMax)) {
    return {
      code: "WORKSPACE_RULE_DENALI_GROUP_SIZE_MAX_INVALID",
      message: "logistics.groupSizeMax must be a positive integer when provided.",
    };
  }

  if (isDenaliMountainTourKind(kindRaw)) {
    const part = tripDetails.participation;
    if (!participationMinimumAgePresent(part?.minimumAge)) {
      return {
        code: "WORKSPACE_RULE_DENALI_PARTICIPATION_MINIMUM_AGE_REQUIRED",
        message:
          "participation.minimumAge is required for mountain_day and mountain_multi Denali tour kinds.",
      };
    }
    if (!participationFitnessLevelPresent(part?.fitnessLevel)) {
      return {
        code: "WORKSPACE_RULE_DENALI_PARTICIPATION_FITNESS_LEVEL_REQUIRED",
        message:
          "participation.fitnessLevel is required for mountain_day and mountain_multi Denali tour kinds.",
      };
    }
  }

  return null;
}

function isLocationConcrete(locRaw: unknown): boolean {
  const loc = denaliLocationFromApi(locRaw);
  if (loc == null) {
    return false;
  }
  if (loc.addressText.trim() === "") {
    return false;
  }
  return (
    typeof loc.latitude === "number" &&
    Number.isFinite(loc.latitude) &&
    typeof loc.longitude === "number" &&
    Number.isFinite(loc.longitude)
  );
}

/**
 * Publish gate (OPEN): outdoor Denali pilot tours must pin gathering and start locations with text + coordinates.
 * Event tours (`event_reading` / `event_cinema`) hide logistics location fields in the wizard — skip this gate.
 */
export function checkDenaliPilotPublishGeolocationZones(
  tripDetails: TourTripDetails | null | undefined,
): WorkspaceInvariantViolation | null {
  const overview = tripDetails?.overview as Record<string, unknown> | undefined;
  const logistics = tripDetails?.logistics as Record<string, unknown> | undefined;

  const kindRaw = overview?.denaliTourKind;
  if (
    typeof kindRaw === "string" &&
    isDenaliTourKind(kindRaw) &&
    isDenaliEventTourKind(kindRaw)
  ) {
    return null;
  }

  const gatheringPoints = normalizeGatheringPickupStations(logistics?.gatheringPoints);
  if (gatheringPoints.length === 0) {
    return {
      code: "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message: "logistics.gatheringPoints must include at least one station for denali_pilot publish.",
    };
  }

  const incompleteStation = gatheringPoints.find((station) => !gatheringPickupStationIsConcrete(station));
  if (incompleteStation) {
    return {
      code: "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message:
        "Each logistics.gatheringPoints station must have title, non-empty addressText, and finite latitude/longitude for denali_pilot publish.",
    };
  }

  if (!isLocationConcrete(overview?.startPoint)) {
    return {
      code: "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message:
        "overview.startPoint must include non-empty addressText and finite latitude/longitude for denali_pilot publish.",
    };
  }

  return null;
}
