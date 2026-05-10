import { BadRequestException } from "@nestjs/common";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import { computeTourDurationDays } from "./tour-duration";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  td: TourTripDetails | null | undefined
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

    if (log.primaryTransportMode === "private_car" && log.fuelShareToman == null) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "fuelShareToman is required when primaryTransportMode is private_car"
        }
      });
    }

    const depM = minutesFromHhmm(log.departureMeetingTime);
    const retM = minutesFromHhmm(log.returnMeetingTime);
    if (depM != null && retM != null && retM <= depM) {
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
 * Domain rules aligned with the web wizard Zod schema (`tourCreateSchema` / `mapCreateTourDto`),
 * applied after class-validator DTO parsing so invalid cross-field combinations return 400.
 */
export function assertCreateTourInvariants(dto: CreateTourDto): void {
  validateTripDetailsCanonical(dto.tripDetails as TourTripDetails | undefined);
}
