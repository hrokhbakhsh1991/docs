import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  normalizeGatheringPickupStation,
  gatheringPickupStationToPersisted,
} from "@repo/types";

import type {
  TripDetailsDayPlan,
  TripDetailsDayPlanPhoto,
  TripDetailsGatheringPickupStation,
  TripDetailsItinerary,
  TripDetailsOverview,
  TripDetailsLocationData,
  TourTripDetails,
} from "../types/tour-trip-details.types";

/** Keys that must survive clone / template persistence for Denali pilot tours. */
export const DENALI_CLONE_TRIP_DETAILS_WHITELIST = [
  "overview.leaderUserIds",
  "overview.localGuideName",
  "logistics.gatheringPoints",
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

function cloneLocation(
  loc: TripDetailsLocationData | undefined,
  options?: { remintId?: boolean }
): TripDetailsLocationData | undefined {
  if (!loc) return undefined;
  return {
    ...(options?.remintId ? { id: randomUUID() } : loc.id ? { id: loc.id } : {}),
    addressText: loc.addressText,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
  };
}

/** Clone isolation: new primary key per photo; URL/metadata unchanged. */
function clonePhoto(photo: TripDetailsDayPlanPhoto): TripDetailsDayPlanPhoto {
  return { ...photo, id: randomUUID() };
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
        ...(overview.startPoint ? { startPoint: cloneLocation(overview.startPoint) } : {}),
        ...(overview.summitPoint ? { summitPoint: cloneLocation(overview.summitPoint) } : {}),
        ...(overview.campPoint ? { campPoint: cloneLocation(overview.campPoint) } : {}),
        ...(overview.endPoint ? { endPoint: cloneLocation(overview.endPoint) } : {}),
        ...(overview.leaderUserIds ? { leaderUserIds: [...overview.leaderUserIds] } : {}),
      };
    }
    const logistics = cloned.logistics;
    if (logistics?.gatheringPoints?.length) {
      cloned.logistics = {
        ...logistics,
        gatheringPoints: logistics.gatheringPoints
          .map((raw) => {
            const normalized = normalizeGatheringPickupStation(raw);
            if (!normalized) {
              return null;
            }
            const persisted = gatheringPickupStationToPersisted(normalized);
            const clonedLoc = cloneLocation(persisted.location, { remintId: true });
            if (!clonedLoc) {
              return null;
            }
            const row: TripDetailsGatheringPickupStation = {
              id: randomUUID(),
              title: persisted.title,
              ...(persisted.time ? { time: persisted.time } : {}),
              location: clonedLoc,
            };
            return row;
          })
          .filter((row): row is TripDetailsGatheringPickupStation => row != null),
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
    const logistics = (td.logistics ?? {}) as Record<string, unknown> & {
      gatheringPoints?: TripDetailsGatheringPickupStation[];
    };
    const participation = td.participation ?? {};
    const policies = td.policies ?? {};
    const defaults: Record<string, unknown> = {
      basicInfo: {
        startPoint: overview.startPoint,
        summitPoint: overview.summitPoint,
        campPoint: overview.campPoint,
        endPoint: overview.endPoint,
        leaderUserIds: overview.leaderUserIds,
        localGuideName: overview.localGuideName,
        tourType: overview.denaliTourKind,
      },
      tripDetails: {
        logistics: {
          gatheringPoints: logistics.gatheringPoints ?? [],
        },
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
