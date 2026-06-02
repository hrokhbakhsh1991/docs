import {
  gatheringPickupStationToPersisted,
  normalizeGatheringPickupStation,
} from "@repo/types";

import {
  catalogRegistry,
  type CatalogReferenceKey,
  type CatalogRegistry,
} from "./catalog-registry";
import { generateUuid } from "../utils/crypto";

export type RegistryWalkContext = {
  readonly registry: CatalogRegistry;
  readonly remintUuid: () => string;
  readonly photoIdRemap: Map<string, string>;
};

type TripDetailsLocationData = {
  id?: string;
  addressText?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type TripDetailsDayPlanPhoto = {
  id: string;
  url?: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

type TripDetailsDayPlan = {
  day: number;
  title?: string;
  description?: string;
  distanceKm?: number;
  elevationGainM?: number;
  photos?: TripDetailsDayPlanPhoto[];
  location?: TripDetailsLocationData;
};

type TripDetailsGatheringPickupStation = {
  id?: string;
  title: string;
  time?: string;
  location: TripDetailsLocationData;
};

function remintTourInstanceId(
  registry: CatalogRegistry,
  referenceKey: CatalogReferenceKey,
  remintUuid: () => string,
): string {
  if (!registry.shouldRemintOnClone(referenceKey)) {
    throw new Error(`clone remint requested for non-instance reference: ${referenceKey}`);
  }
  return remintUuid();
}

/** Copies global catalog FK arrays verbatim (theme, leader, gear ids). */
export function copyCatalogReferenceArray(
  values: string[] | undefined,
  containerField: string,
  registry: CatalogRegistry,
): string[] | undefined {
  if (!values?.length) {
    return undefined;
  }
  const referenceKey = registry.resolveReferenceKey({
    propertyName: "[]",
    parentPath: containerField,
    containerField,
  });
  if (!referenceKey || !registry.isGlobalCatalogReference(referenceKey)) {
    return [...values];
  }
  return values.map((id) => {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed) {
      return id;
    }
    if (registry.shouldRemintOnClone(referenceKey)) {
      throw new Error(`global catalog reference must not be reminted: ${referenceKey}`);
    }
    return trimmed;
  });
}

export function remintLocation(
  loc: TripDetailsLocationData | undefined,
  registry: CatalogRegistry,
  parentPath: string,
  remintUuid: () => string,
): TripDetailsLocationData | undefined {
  if (!loc) {
    return undefined;
  }
  const referenceKey = registry.resolveReferenceKey({
    propertyName: "id",
    parentPath,
  });
  let id: string | undefined;
  if (referenceKey && registry.shouldRemintOnClone(referenceKey)) {
    id = remintTourInstanceId(registry, referenceKey, remintUuid);
  } else if (typeof loc.id === "string" && loc.id.trim()) {
    id = loc.id.trim();
  }
  return {
    ...(id ? { id } : {}),
    ...(loc.addressText !== undefined ? { addressText: loc.addressText } : {}),
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
  };
}

export function remintPhoto(
  photo: TripDetailsDayPlanPhoto,
  photoIdRemap: Map<string, string>,
  registry: CatalogRegistry,
  parentPath: string,
  remintUuid: () => string,
): TripDetailsDayPlanPhoto {
  const referenceKey = registry.resolveReferenceKey({
    propertyName: "id",
    parentPath,
  });
  if (referenceKey !== "mediaId") {
    throw new Error("photo clone requires mediaId tour-instance reference");
  }
  const { url: _url, ...rest } = photo;
  const nextId = remintTourInstanceId(registry, referenceKey, remintUuid);
  photoIdRemap.set(photo.id, nextId);
  return { ...rest, id: nextId };
}

function copyScalarFields(
  source: Record<string, unknown>,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      next[key] = source[key];
    }
  }
  return next;
}

const OVERVIEW_SCALAR_KEYS = [
  "denaliTourKind",
  "shortIntro",
  "longIntro",
  "difficultyLevel",
  "localGuideName",
  "maxAltitudeMeters",
  "elevationGainMeters",
  "nonAttendanceDetails",
  "bestFor",
  "fitnessLevel",
  "minimumAge",
  "sportsInsuranceRequired",
  "fuelShareToman",
] as const;

function walkOverview(
  overview: Record<string, unknown>,
  ctx: RegistryWalkContext,
): Record<string, unknown> {
  const next = copyScalarFields(overview, OVERVIEW_SCALAR_KEYS);

  const themeIds = copyCatalogReferenceArray(
    Array.isArray(overview.tourThemeIds) ? (overview.tourThemeIds as string[]) : undefined,
    "tourThemeIds",
    ctx.registry,
  );
  if (themeIds) {
    next.tourThemeIds = themeIds;
  }

  const leaderIds = copyCatalogReferenceArray(
    Array.isArray(overview.leaderUserIds) ? (overview.leaderUserIds as string[]) : undefined,
    "leaderUserIds",
    ctx.registry,
  );
  if (leaderIds) {
    next.leaderUserIds = leaderIds;
  }

  for (const pinField of ["startPoint", "summitPoint", "campPoint", "endPoint"] as const) {
    const pin = overview[pinField];
    if (pin && typeof pin === "object") {
      const cloned = remintLocation(
        pin as TripDetailsLocationData,
        ctx.registry,
        `overview.${pinField}`,
        ctx.remintUuid,
      );
      if (cloned) {
        next[pinField] = cloned;
      }
    }
  }

  return next;
}

function walkParticipation(
  participation: Record<string, unknown>,
  ctx: RegistryWalkContext,
): Record<string, unknown> {
  const next = copyScalarFields(participation, [
    "fitnessLevel",
    "minimumAge",
    "maximumAge",
    "nationalIdRequired",
    "sportsInsuranceRequired",
    "minRequiredPeaks",
    "fitnessPrerequisiteText",
    "groupSizeMax",
  ]);

  const gearRequired = copyCatalogReferenceArray(
    Array.isArray(participation.gearRequiredIds)
      ? (participation.gearRequiredIds as string[])
      : undefined,
    "gearRequiredIds",
    ctx.registry,
  );
  if (gearRequired) {
    next.gearRequiredIds = gearRequired;
  }

  const gearOptional = copyCatalogReferenceArray(
    Array.isArray(participation.gearOptionalIds)
      ? (participation.gearOptionalIds as string[])
      : undefined,
    "gearOptionalIds",
    ctx.registry,
  );
  if (gearOptional) {
    next.gearOptionalIds = gearOptional;
  }

  return next;
}

function walkGatheringPoints(
  logistics: Record<string, unknown>,
  ctx: RegistryWalkContext,
): TripDetailsGatheringPickupStation[] | undefined {
  if (!Array.isArray(logistics.gatheringPoints) || logistics.gatheringPoints.length === 0) {
    return undefined;
  }

  const rows = (logistics.gatheringPoints as unknown[])
    .map((raw, index) => {
      const normalized = normalizeGatheringPickupStation(raw);
      if (!normalized) {
        return null;
      }
      const persisted = gatheringPickupStationToPersisted(normalized);
      const stationPath = `logistics.gatheringPoints[${index}]`;
      const clonedLoc = remintLocation(
        persisted.location,
        ctx.registry,
        `${stationPath}.location`,
        ctx.remintUuid,
      );
      if (!clonedLoc) {
        return null;
      }
      const gatheringReference = ctx.registry.resolveReferenceKey({
        propertyName: "id",
        parentPath: stationPath,
      });
      if (gatheringReference !== "gatheringPointId") {
        throw new Error("gathering point clone requires gatheringPointId tour-instance reference");
      }
      const row: TripDetailsGatheringPickupStation = {
        id: remintTourInstanceId(ctx.registry, gatheringReference, ctx.remintUuid),
        title: persisted.title,
        ...(persisted.time ? { time: persisted.time } : {}),
        location: clonedLoc,
      };
      return row;
    })
    .filter((row): row is TripDetailsGatheringPickupStation => row != null);

  return rows.length > 0 ? rows : undefined;
}

function walkDayPlan(
  row: TripDetailsDayPlan,
  dayPlanIndex: number,
  ctx: RegistryWalkContext,
): TripDetailsDayPlan {
  const basePath = `itinerary.dayPlans[${dayPlanIndex}]`;
  return {
    day: row.day,
    ...(row.title != null ? { title: row.title } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.distanceKm != null ? { distanceKm: row.distanceKm } : {}),
    ...(row.elevationGainM != null ? { elevationGainM: row.elevationGainM } : {}),
    ...(row.location
      ? { location: remintLocation(row.location, ctx.registry, `${basePath}.location`, ctx.remintUuid) }
      : {}),
    ...(row.photos?.length
      ? {
          photos: row.photos.map((photo, photoIndex) =>
            remintPhoto(photo, ctx.photoIdRemap, ctx.registry, `${basePath}.photos[${photoIndex}]`, ctx.remintUuid),
          ),
        }
      : {}),
  };
}

function walkSegmentActivityDay(
  row: Record<string, unknown>,
  dayIndex: number,
  ctx: RegistryWalkContext,
): Record<string, unknown> {
  const basePath = `itinerary.segmentActivities[${dayIndex}]`;
  const next = copyScalarFields(row, ["day", "title", "description", "distanceKm", "elevationGainM"]);
  const photos = row.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    next.photos = photos.map((raw, photoIndex) =>
      remintPhoto(
        raw as TripDetailsDayPlanPhoto,
        ctx.photoIdRemap,
        ctx.registry,
        `${basePath}.photos[${photoIndex}]`,
        ctx.remintUuid,
      ),
    );
  }
  return next;
}

function walkItinerary(
  itinerary: Record<string, unknown>,
  ctx: RegistryWalkContext,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if (Array.isArray(itinerary.dayPlans) && itinerary.dayPlans.length > 0) {
    next.dayPlans = (itinerary.dayPlans as TripDetailsDayPlan[]).map((row, index) =>
      walkDayPlan(row, index, ctx),
    );
  }

  if (Array.isArray(itinerary.segmentActivities) && itinerary.segmentActivities.length > 0) {
    next.segmentActivities = (itinerary.segmentActivities as Record<string, unknown>[]).map((row, index) =>
      walkSegmentActivityDay(row, index, ctx),
    );
  }

  return next;
}

const LOGISTICS_SCALAR_KEYS = ["transportMode", "groupSizeMax", "fuelShareToman"] as const;

/**
 * Registry walk: copies only known `trip_details` slices; catalog FKs verbatim, tour-instance ids reminted.
 * Does not spread clone JSON — smuggled keys from the source document are dropped.
 */
export function safeRemintTripDetailsRegistryWalk(
  source: Record<string, unknown>,
  ctx: RegistryWalkContext,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  if (typeof source.schemaVersion === "number") {
    output.schemaVersion = source.schemaVersion;
  }

  const overview = source.overview;
  if (overview && typeof overview === "object" && !Array.isArray(overview)) {
    output.overview = walkOverview(overview as Record<string, unknown>, ctx);
  }

  const participation = source.participation;
  if (participation && typeof participation === "object" && !Array.isArray(participation)) {
    output.participation = walkParticipation(participation as Record<string, unknown>, ctx);
  }

  const logistics = source.logistics;
  if (logistics && typeof logistics === "object" && !Array.isArray(logistics)) {
    const logisticsRecord = logistics as Record<string, unknown>;
    const nextLogistics = copyScalarFields(logisticsRecord, LOGISTICS_SCALAR_KEYS);
    const gatheringPoints = walkGatheringPoints(logisticsRecord, ctx);
    if (gatheringPoints) {
      nextLogistics.gatheringPoints = gatheringPoints;
    }
    if (Object.keys(nextLogistics).length > 0) {
      output.logistics = nextLogistics;
    }
  }

  const itinerary = source.itinerary;
  if (itinerary && typeof itinerary === "object" && !Array.isArray(itinerary)) {
    const walked = walkItinerary(itinerary as Record<string, unknown>, ctx);
    if (Object.keys(walked).length > 0) {
      output.itinerary = walked;
    }
  }

  if (Array.isArray(source.photos) && source.photos.length > 0) {
    output.photos = (source.photos as TripDetailsDayPlanPhoto[]).map((photo, index) =>
      remintPhoto(photo, ctx.photoIdRemap, ctx.registry, `photos[${index}]`, ctx.remintUuid),
    );
  }

  return output;
}

export function createRegistryWalkContext(
  options?: {
    registry?: CatalogRegistry;
    remintUuid?: () => string;
  },
): RegistryWalkContext {
  return {
    registry: options?.registry ?? catalogRegistry,
    remintUuid: options?.remintUuid ?? (() => generateUuid()),
    photoIdRemap: new Map<string, string>(),
  };
}
