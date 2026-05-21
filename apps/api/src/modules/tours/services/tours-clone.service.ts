import { Injectable } from "@nestjs/common";

import type {
  TripDetailsDayPlan,
  TripDetailsDayPlanPhoto,
  TripDetailsItinerary,
  TripDetailsOverview,
  TripDetailsLocationData,
  TourTripDetails,
} from "../types/tour-trip-details.types";

/** Keys that must survive clone / template persistence for Denali pilot tours. */
export const DENALI_CLONE_TRIP_DETAILS_WHITELIST = [
  "overview.leaderUserIds",
  "overview.localGuideName",
  "overview.gatheringPoint",
  "overview.startPoint",
  "overview.summitPoint",
  "overview.campPoint",
  "overview.endPoint",
  "overview.difficultyLevel",
  "overview.denaliTourKind",
  "itinerary.dayPlans",
  "photos",
] as const;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneLocation(loc: TripDetailsLocationData | undefined): TripDetailsLocationData | undefined {
  if (!loc) return undefined;
  return {
    addressText: loc.addressText,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
  };
}

function clonePhoto(photo: TripDetailsDayPlanPhoto): TripDetailsDayPlanPhoto {
  return { ...photo };
}

function cloneDayPlan(row: TripDetailsDayPlan): TripDetailsDayPlan {
  return {
    day: row.day,
    ...(row.title != null ? { title: row.title } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.distanceKm != null ? { distanceKm: row.distanceKm } : {}),
    ...(row.elevationGainM != null ? { elevationGainM: row.elevationGainM } : {}),
    ...(row.location ? { location: cloneLocation(row.location) } : {}),
    ...(row.photos?.length ? { photos: row.photos.map(clonePhoto) } : {}),
  };
}

/**
 * Deep-clones `trip_details` JSON for wizard clone / template hydration without
 * stripping Denali-specific nested keys (5-zone pins, itinerary geo, media).
 */
@Injectable()
export class ToursCloneService {
  cloneTripDetailsForWizard(source: TourTripDetails | null | undefined): TourTripDetails | undefined {
    if (!source || typeof source !== "object") {
      return undefined;
    }
    const cloned = cloneJson(source) as TourTripDetails;
    const overview = cloned.overview as TripDetailsOverview | undefined;
    if (overview) {
      cloned.overview = {
        ...overview,
        ...(overview.gatheringPoint ? { gatheringPoint: cloneLocation(overview.gatheringPoint) } : {}),
        ...(overview.startPoint ? { startPoint: cloneLocation(overview.startPoint) } : {}),
        ...(overview.summitPoint ? { summitPoint: cloneLocation(overview.summitPoint) } : {}),
        ...(overview.campPoint ? { campPoint: cloneLocation(overview.campPoint) } : {}),
        ...(overview.endPoint ? { endPoint: cloneLocation(overview.endPoint) } : {}),
        ...(overview.leaderUserIds ? { leaderUserIds: [...overview.leaderUserIds] } : {}),
      };
    }
    const itinerary = cloned.itinerary as TripDetailsItinerary | undefined;
    if (itinerary?.dayPlans?.length) {
      cloned.itinerary = {
        ...itinerary,
        dayPlans: itinerary.dayPlans.map(cloneDayPlan),
      };
    }
    if (cloned.photos?.length) {
      cloned.photos = cloned.photos.map(clonePhoto);
    }
    return cloned;
  }

  /** Maps persisted trip details → Denali 6-tab preset `defaults` blob (template ingestion). */
  tripDetailsToDenaliPresetDefaults(tripDetails: TourTripDetails): Record<string, unknown> {
    const td = this.cloneTripDetailsForWizard(tripDetails);
    if (!td) {
      return {};
    }
    const overview = (td.overview ?? {}) as TripDetailsOverview & Record<string, unknown>;
    const itinerary = td.itinerary ?? {};
    const logistics = (td.logistics ?? {}) as Record<string, unknown>;
    const participation = td.participation ?? {};
    const policies = td.policies ?? {};
    const defaults: Record<string, unknown> = {
      basicInfo: {
        gatheringPoint: overview.gatheringPoint,
        startPoint: overview.startPoint,
        summitPoint: overview.summitPoint,
        campPoint: overview.campPoint,
        endPoint: overview.endPoint,
        leaderUserIds: overview.leaderUserIds,
        localGuideName: overview.localGuideName,
        tourType: overview.denaliTourKind,
      },
      programNature: {
        themeIds: overview.tourThemeIds ?? [],
        shortDescription: overview.shortIntro,
        itinerary: itinerary.dayPlans?.map((row) => ({
          day: row.day,
          locationText: row.title,
          activities: row.description ?? "",
          ...(row.location ? { location: row.location } : {}),
          ...(row.photos?.length ? { photos: row.photos } : {}),
        })),
      },
      participantRequirements: {
        minimumAge: participation.minimumAge,
        maximumAge: participation.maximumAge,
        fitnessLevel: participation.fitnessLevel,
        nationalIdRequired: participation.registrationNationalIdRequired,
        sportsInsuranceRequired: participation.sportsInsuranceRequired,
        fitnessPrerequisiteText: participation.fitnessPrerequisiteText,
      },
      policies: {
        policiesText: policies.cancellationPolicy,
      },
      photosData: {
        photos: td.photos ?? [],
      },
    };
    const transportMode = logistics.primaryTransportMode;
    if (typeof transportMode === "string" && transportMode.trim()) {
      defaults.transport = {
        transportMode,
        transportNotes: logistics.transportationNotes,
      };
    }
    return defaults;
  }
}
