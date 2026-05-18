import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";

import type { CreateTourDto } from "@/lib/services/tours.service";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";

import { stripTourFormTripDetailsForFormProfile } from "./stripTourFormTripDetailsForProfile";

/**
 * Client mirror of API `stripCreateTourDtoForFormProfile` — run after
 * {@link mapFormValuesToBackendPayload} so incoming urban/cinema payloads pass pre-strip asserts.
 */
export function stripCreateTourDtoForFormProfile(
  profile: TourFormProfile,
  dto: CreateTourDto,
): CreateTourDto {
  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null &&
    !strip.clearsRootTransportModes
  ) {
    return dto;
  }

  const next: CreateTourDto = { ...dto };
  if (next.tripDetails != null) {
    next.tripDetails = stripTourFormTripDetailsForFormProfile(
      profile,
      next.tripDetails as TourTripDetails,
    );
  }
  if (strip.clearsRootTransportModes) {
    delete next.transportModes;
  }
  return next;
}
