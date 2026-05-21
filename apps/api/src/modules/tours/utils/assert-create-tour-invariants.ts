import { BadRequestException } from "@nestjs/common";

import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";
import { getTourWorkspaceDefinition, type WorkspaceInvariantViolation } from "@repo/shared-contracts";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourTransportMode } from "../tour-transport-modes";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import { URBAN_LOGISTICS_WHITELIST } from "./create-tour-form-profile-strip";
import { computeTourDurationDays } from "./tour-duration";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ignore DTO class-transformer placeholders; only keys with a material value count as "sent". */
function logisticsObjectKeysWithMaterialValues(log: Record<string, unknown>): string[] {
  return Object.keys(log).filter((key) => {
    const value = log[key];
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === "string" && value.trim() === "") {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  });
}

function profileUsesTripDetailsStrip(profile: TourFormProfile): boolean {
  const { strip } = getTourFormProfileDescriptor(profile);
  return (
    strip.clearsTripDetailsRoots.length > 0 ||
    strip.itineraryKeysToDelete.length > 0 ||
    strip.logisticsWhitelist != null ||
    strip.clearsRootTransportModes
  );
}

function minutesFromHhmm(s: string | undefined): number | undefined {
  if (s == null || typeof s !== "string") {
    return undefined;
  }
  const t = s.trim();
  if (t === "" || !HHMM.test(t)) {
    return undefined;
  }
  const [h, m] = t.split(":").map((x) => Number(x));
  return h * 60 + m;
}

/**
 * Cross-field rules on the persisted trip JSON shape (after merge on PATCH).
 * Shared by create and update so PATCH cannot introduce invalid combinations.
 */
export function validateTripDetailsCanonical(
  td: TourTripDetails | null | undefined,
  /** When set (e.g. from `tours.transport_modes`), fuel rules apply if this list includes `private_car`. */
  rootTransportModes?: readonly TourTransportMode[] | null,
): void {
  if (td == null) {
    return;
  }
  const log = td.logistics as
    | (TourTripDetails["logistics"] & {
        primaryTransportMode?: string;
        fuelShareToman?: number | null;
        returnMeetingTime?: string;
      })
    | undefined;

  if (log) {
    if (
      log.groupSizeMin != null &&
      log.groupSizeMax != null &&
      log.groupSizeMax < log.groupSizeMin
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "logistics.groupSizeMax must be greater than or equal to logistics.groupSizeMin"
        }
      });
    }

    const modes = rootTransportModes ?? [];
    const hasPrivateCarInModes = modes.includes("private_car");
    const primaryIsPrivateCar = log.primaryTransportMode === "private_car";
    const requiresFuelShare = hasPrivateCarInModes || primaryIsPrivateCar;
    if (requiresFuelShare && log.fuelShareToman == null) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message:
            "fuelShareToman is required when the tour uses private_car (root transportModes and/or primaryTransportMode)"
        }
      });
    }

    const depM = minutesFromHhmm(log.departureMeetingTime);
    const retM = minutesFromHhmm(log.returnMeetingTime);
    const depDate =
      typeof log.departureDate === "string" ? log.departureDate.trim() : "";
    const retDate = typeof log.returnDate === "string" ? log.returnDate.trim() : "";
    const sameCalendarDay =
      depDate !== "" && retDate !== "" && depDate === retDate;
    if (sameCalendarDay && depM != null && retM != null && retM <= depM) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "returnMeetingTime must be after departureMeetingTime when both are set"
        }
      });
    }
  }

  const part = td.participation;
  if (
    part &&
    part.minimumAge != null &&
    part.maximumAge != null &&
    part.maximumAge < part.minimumAge
  ) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "participation.maximumAge must be greater than or equal to participation.minimumAge"
      }
    });
  }

  const dur =
    log != null ? computeTourDurationDays(log.departureDate, log.returnDate) : undefined;

  const itineraryExt = td.itinerary as
    | (TourTripDetails["itinerary"] & {
        segmentActivities?: Array<{ dayNumber: number }>;
      })
    | undefined;

  if (dur != null && itineraryExt?.segmentActivities?.length) {
    const maxDay = Math.max(...itineraryExt.segmentActivities.map((d) => d.dayNumber));
    if (maxDay > dur) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: `Itinerary has days beyond the scheduled date range (${maxDay} > ${dur} day(s)).`
        }
      });
    }
  }

  if (dur != null && itineraryExt?.dayPlans?.length) {
    const maxDp = Math.max(...itineraryExt.dayPlans.map((d) => d.day));
    if (maxDp > dur) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: `Day plans exceed the scheduled date range (day ${maxDp} > ${dur} day(s)).`
        }
      });
    }
  }
}

/**
 * After `stripTripDetailsForFormProfile`, cinema/urban must not carry inactive groups or stripped
 * itinerary rails (server mirror of web ghost-data policy).
 */
function assertStripShapeForSlimProfiles(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
): void {
  if (!profileUsesTripDetailsStrip(profile)) {
    return;
  }
  if (tripDetails == null) {
    return;
  }

  const { strip } = getTourFormProfileDescriptor(profile);

  if (strip.clearsTripDetailsRoots.includes("participation") && tripDetails.participation != null) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_PROFILE_PHANTOM_PARTICIPATION",
        message:
          `participation must be omitted for ${profile} after profile strip (inactive group).`,
      },
    });
  }

  const rawIt = tripDetails.itinerary;
  if (rawIt != null && typeof rawIt === "object") {
    const it = rawIt as Record<string, unknown>;
    const dp = it.dayPlans;
    const sa = it.segmentActivities;
    if (strip.itineraryKeysToDelete.includes("dayPlans") && Array.isArray(dp) && dp.length > 0) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_PHANTOM_ITINERARY",
          message: `itinerary.dayPlans must be empty for ${profile} after profile strip.`,
        },
      });
    }
    if (
      strip.itineraryKeysToDelete.includes("segmentActivities") &&
      Array.isArray(sa) &&
      sa.length > 0
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_PHANTOM_ITINERARY",
          message:
            `itinerary.segmentActivities must be empty for ${profile} after profile strip.`,
        },
      });
    }
  }
}

/**
 * Rejects **incoming** create payloads that still carry inactive groups for `cinema_event` / `urban_event`
 * before the server mutates them via `stripCreateTourDtoForFormProfile` (strict pre-strip).
 */
export function assertIncomingTripDetailsBeforeFormProfileStrip(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
  rootTransportModes?: readonly TourTransportMode[] | null,
): void {
  if (!profileUsesTripDetailsStrip(profile)) {
    return;
  }
  if (tripDetails == null) {
    return;
  }

  const { strip } = getTourFormProfileDescriptor(profile);

  if (strip.clearsTripDetailsRoots.includes("participation") && tripDetails.participation != null) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_PROFILE_INCOMING_PHANTOM_PARTICIPATION",
        message:
          `participation must not be sent for ${profile} on create (inactive group); omit the key.`,
      },
    });
  }

  const rawIt = tripDetails.itinerary;
  if (rawIt != null && typeof rawIt === "object") {
    const it = rawIt as Record<string, unknown>;
    const dp = it.dayPlans;
    const sa = it.segmentActivities;
    if (strip.itineraryKeysToDelete.includes("dayPlans") && Array.isArray(dp) && dp.length > 0) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY",
          message:
            `itinerary.dayPlans must be empty or omitted for ${profile} on create before profile strip.`,
        },
      });
    }
    if (
      strip.itineraryKeysToDelete.includes("segmentActivities") &&
      Array.isArray(sa) &&
      sa.length > 0
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY",
          message:
            `itinerary.segmentActivities must be empty or omitted for ${profile} on create before profile strip.`,
        },
      });
    }
  }

  if (strip.clearsRootTransportModes) {
    const modes = rootTransportModes ?? [];
    if (modes.length > 0) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_TRANSPORT_NOT_ALLOWED",
          message:
            `transportModes must be empty or omitted for ${profile} on create (city-format tours do not use root transport modes).`,
        },
      });
    }
  }

  if (strip.logisticsWhitelist != null) {
    if (tripDetails.logistics != null && typeof tripDetails.logistics === "object") {
      const log = tripDetails.logistics as Record<string, unknown>;
      for (const key of logisticsObjectKeysWithMaterialValues(log)) {
        if (!URBAN_LOGISTICS_WHITELIST.has(key)) {
          throw new BadRequestException({
            error: {
              code: "VALIDATION_PROFILE_INCOMING_LOGISTICS_EXTRA",
              message: `logistics.${key} is not allowed for ${profile} on create before profile strip.`,
            },
          });
        }
      }
    }
  }
}

/**
 * PATCH pre-strip: rejects only **keys present in this request's** `tripDetails` patch (merged DB
 * phantoms are still handled by strip + post-assert).
 */
export function assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
  profile: TourFormProfile,
  patchPlain: Record<string, unknown>,
  transportModesInRequest: readonly TourTransportMode[] | undefined,
): void {
  if (!profileUsesTripDetailsStrip(profile)) {
    return;
  }

  const { strip } = getTourFormProfileDescriptor(profile);

  if (
    strip.clearsTripDetailsRoots.includes("participation") &&
    "participation" in patchPlain &&
    patchPlain.participation != null
  ) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_PROFILE_INCOMING_PHANTOM_PARTICIPATION",
        message:
          `participation must not be set in tripDetails patch for ${profile} (inactive group).`,
      },
    });
  }

  if ("itinerary" in patchPlain && patchPlain.itinerary != null && typeof patchPlain.itinerary === "object") {
    const it = patchPlain.itinerary as Record<string, unknown>;
    if (
      strip.itineraryKeysToDelete.includes("dayPlans") &&
      "dayPlans" in it &&
      Array.isArray(it.dayPlans) &&
      it.dayPlans.length > 0
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY",
          message:
            `itinerary.dayPlans must be empty or omitted in tripDetails patch for ${profile}.`,
        },
      });
    }
    if (
      strip.itineraryKeysToDelete.includes("segmentActivities") &&
      "segmentActivities" in it &&
      Array.isArray(it.segmentActivities) &&
      it.segmentActivities.length > 0
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY",
          message:
            `itinerary.segmentActivities must be empty or omitted in tripDetails patch for ${profile}.`,
        },
      });
    }
  }

  if (strip.clearsRootTransportModes) {
    if (transportModesInRequest !== undefined && transportModesInRequest.length > 0) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_INCOMING_TRANSPORT_NOT_ALLOWED",
          message:
            `transportModes must be empty in patch for ${profile} (city-format tours do not use root transport modes).`,
        },
      });
    }
  }

  if (strip.logisticsWhitelist != null) {
    if ("logistics" in patchPlain && patchPlain.logistics != null && typeof patchPlain.logistics === "object") {
      const log = patchPlain.logistics as Record<string, unknown>;
      for (const key of logisticsObjectKeysWithMaterialValues(log)) {
        if (!URBAN_LOGISTICS_WHITELIST.has(key)) {
          throw new BadRequestException({
            error: {
              code: "VALIDATION_PROFILE_INCOMING_LOGISTICS_EXTRA",
              message: `logistics.${key} is not allowed in tripDetails patch for ${profile} before profile strip.`,
            },
          });
        }
      }
    }
  }
}

export function assertIncomingCreateTourDtoBeforeFormProfileStrip(
  profile: TourFormProfile,
  dto: CreateTourDto,
): void {
  assertIncomingTripDetailsBeforeFormProfileStrip(
    profile,
    dto.tripDetails as TourTripDetails | undefined,
    dto.transportModes ?? undefined,
  );
}

/**
 * Phase 4 — `prompt.md` **assertTripDetailsForProfile** hook: canonical cross-field checks on the
 * trip JSON + root transport list **after** profile strip (cinema/urban) has been applied on create/update.
 *
 * Runs {@link validateTripDetailsCanonical} first, then profile-specific rules (e.g. `urban_event` must
 * not retain root `transportModes` after strip; cinema/urban must not retain stripped itinerary/participation rails).
 */
function throwWorkspaceViolation(violation: WorkspaceInvariantViolation): never {
  throw new BadRequestException({
    error: {
      code: violation.code,
      message: violation.message,
    },
  });
}

/** Root DTO checks for workspace invariants (defense in depth vs web submit gate). */
export function assertWorkspaceCapacity(profile: TourFormProfile, capacity: number): void {
  const workspace = getTourWorkspaceDefinition(profile);
  if (workspace) {
    const violation = workspace.validation.checkCapacity(capacity);
    if (violation != null) {
      throwWorkspaceViolation(violation);
    }
  }
}

/** @deprecated Use {@link assertWorkspaceCapacity}. */
export const assertDenaliPilotCapacity = (capacity: number) => assertWorkspaceCapacity("denali_pilot", capacity);

function assertWorkspaceCreateDto(profile: TourFormProfile, dto: CreateTourDto): void {
  assertWorkspaceCapacity(profile, dto.total_capacity);
}

/**
 * Workspace rules (map.md §B): `overview.denaliTourKind` required when tripDetails
 * is present; event kinds must not carry outdoor difficulty; fixed-dong modes require `fuelShareToman`
 * when private car is in play; mountain kinds require participation fields.
 */
export function assertWorkspaceTripDetails(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
  rootTransportModes?: readonly TourTransportMode[] | null,
): void {
  const workspace = getTourWorkspaceDefinition(profile);
  if (workspace) {
    const violation = workspace.validation.checkTripDetails(tripDetails, rootTransportModes);
    if (violation != null) {
      throwWorkspaceViolation(violation);
    }
  }
}

/** @deprecated Use {@link assertWorkspaceTripDetails}. */
export const assertDenaliPilotTripDetails = (
  tripDetails: TourTripDetails | null | undefined,
  rootTransportModes?: readonly TourTransportMode[] | null,
) => assertWorkspaceTripDetails("denali_pilot", tripDetails, rootTransportModes);

export function assertTripDetailsForFormProfile(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
  rootTransportModes?: readonly TourTransportMode[] | null,
): void {
  assertWorkspaceTripDetails(profile, tripDetails, rootTransportModes);

  validateTripDetailsCanonical(tripDetails, rootTransportModes ?? undefined);

  const { strip } = getTourFormProfileDescriptor(profile);
  if (strip.clearsRootTransportModes) {
    const modes = rootTransportModes ?? [];
    if (modes.length > 0) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_PROFILE_TRANSPORT_NOT_ALLOWED",
          message:
            `transportModes must be empty for ${profile} after profile strip (city-format tours do not use root transport modes).`,
        },
      });
    }
  }

  assertStripShapeForSlimProfiles(profile, tripDetails);
}

/**
 * Domain rules aligned with the web wizard Zod schema (`tourCreateSchema` / `mapCreateTourDto`),
 * applied after class-validator DTO parsing so invalid cross-field combinations return 400.
 *
 * @param resolvedFormProfile — theme-derived profile used after strip (defaults to `general` for tests).
 */
export function assertCreateTourInvariants(
  dto: CreateTourDto,
  resolvedFormProfile: TourFormProfile = "general",
): void {
  assertWorkspaceCreateDto(resolvedFormProfile, dto);

  assertTripDetailsForFormProfile(
    resolvedFormProfile,
    dto.tripDetails as TourTripDetails | undefined,
    dto.transportModes ?? undefined,
  );
}
