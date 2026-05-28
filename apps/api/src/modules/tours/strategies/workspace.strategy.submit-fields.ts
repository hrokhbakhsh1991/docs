import {
  getRequiredSubmitFieldPathsForProfile,
  type TourFormProfile,
  type WizardSubmitRequiredFieldPath,
} from "@repo/types";

import type { ProfileRequiredSubmitShape } from "../utils/profile-required-submit-shape";
import type { WorkspaceRequiredSubmitFields } from "./workspace.strategy.interface";

/** Default wizard-path reads (no Denali primary-transport synthesis). */
export function readDefaultSubmitFieldValue(
  dto: ProfileRequiredSubmitShape,
  path: WizardSubmitRequiredFieldPath,
): unknown {
  switch (path) {
    case "overview.title":
      return dto.title;
    case "pricing.basePrice":
      return dto.cost_context?.totalCost;
    case "itinerary.days": {
      const itinerary = dto.tripDetails?.itinerary as
        | {
            segmentActivities?: unknown[];
            dayPlans?: unknown[];
          }
        | undefined;
      if (itinerary == null) {
        return [];
      }
      const segmentActivities = itinerary.segmentActivities;
      if (Array.isArray(segmentActivities) && segmentActivities.length > 0) {
        return segmentActivities;
      }
      const dayPlans = itinerary.dayPlans;
      if (Array.isArray(dayPlans) && dayPlans.length > 0) {
        return dayPlans;
      }
      return [];
    }
    case "logistics.primaryTransportMode": {
      const logistics = dto.tripDetails?.logistics as
        | { primaryTransportMode?: string | null }
        | undefined;
      return logistics?.primaryTransportMode;
    }
    default: {
      const _exhaustive: never = path;
      return _exhaustive;
    }
  }
}

export function buildRequiredSubmitFields(profile: TourFormProfile): WorkspaceRequiredSubmitFields {
  return {
    profile,
    requiredPaths: getRequiredSubmitFieldPathsForProfile(profile),
    readSubmitFieldValue: (dto, path) => readDefaultSubmitFieldValue(dto, path),
  };
}
