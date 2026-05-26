import type { CreateTourDto } from "@/lib/services/tours.service";

import type { SocialLink, TourLocationSectionModel } from "../models/tourCreateModel";
import {
  compactTripDetailsForApi,
  filterUuidV4Strings,
} from "../models/tourTripDetails.schema";
import type { TourTripDetails } from "../models/tourTripDetails.schema";
import { computeTourDurationDays } from "./computeTourDurationDays";

/**
 * Fields accepted by {@link mapCreateTourDto}.
 * Optional API fields use `Partial` so alternate create entry points (e.g. tour form mappers) stay loose.
 *
 * Note: `durationDays` is intentionally **not** part of the input — it is derived from
 * `tripDetails.logistics.departureDate` / `returnDate` by this mapper to keep the form
 * and the API contract in sync (server re-derives it as well).
 */
export type MapCreateTourDtoInput = Pick<
  CreateTourDto,
  "title" | "capacity" | "price" | "lifecycle_status"
> &
  Partial<
    Pick<
      CreateTourDto,
      | "autoAcceptRegistrations"
      | "tripDetails"
      | "tourType"
      | "transportModes"
      | "destinationId"
      | "requiresPayment"
      | "paymentMode"
      | "sourcePresetId"
      | "sourceTourId"
      | "customServiceLabels"
    >
  > & {
    description?: string;
    /** Maps to `cost_context.location` when trimmed non-empty. */
    location?: string;
    communicationLink?: string;
    socialLinks?: SocialLink[];
    locationSection?: TourLocationSectionModel;
  };

export type CreateTourDtoPrepared = CreateTourDto & {
  /** Prepared for future backend support; currently ignored by API serializer. */
  socialLinks?: SocialLink[];
};

/**
 * Strips legacy `overview.tourTheme` and refreshes `tourThemeLabels` from the catalog
 * (and previous labels) for ids listed in `tourThemeIds`.
 */
export function applyTourThemeOverviewEnrichment(
  tripDetails: TourTripDetails | undefined | null,
  themeCatalog?: readonly { id: string; name: string }[],
): TourTripDetails | undefined {
  if (tripDetails == null || typeof tripDetails !== "object") {
    return tripDetails ?? undefined;
  }
  if (!tripDetails.overview || typeof tripDetails.overview !== "object" || Array.isArray(tripDetails.overview)) {
    return tripDetails;
  }
  const overview = { ...(tripDetails.overview as Record<string, unknown>) };
  delete overview.tourTheme;
  const ids = filterUuidV4Strings(overview.tourThemeIds);
  const prev: Record<string, string> = {};
  if (
    overview.tourThemeLabels != null &&
    typeof overview.tourThemeLabels === "object" &&
    !Array.isArray(overview.tourThemeLabels)
  ) {
    for (const [k, v] of Object.entries(overview.tourThemeLabels as Record<string, unknown>)) {
      if (typeof v !== "string") {
        continue;
      }
      const t = v.trim().slice(0, 120);
      if (t) {
        prev[k.trim()] = t;
      }
    }
  }
  const byId = new Map((themeCatalog ?? []).map((r) => [r.id, r.name]));
  if (ids.length === 0) {
    delete overview.tourThemeLabels;
    return { ...tripDetails, overview: overview as TourTripDetails["overview"] };
  }
  const labels: Record<string, string> = {};
  for (const id of ids) {
    const fromCat = byId.get(id)?.trim();
    const fromPrev = prev[id]?.trim();
    const text = (fromCat ?? fromPrev ?? "").trim();
    if (text) {
      labels[id] = text.slice(0, 120);
    }
  }
  overview.tourThemeLabels = Object.keys(labels).length > 0 ? labels : undefined;
  return { ...tripDetails, overview: overview as TourTripDetails["overview"] };
}

export function injectLocationSectionIntoTripDetails(
  tripDetails: TourTripDetails | undefined | null,
  locationSection: TourLocationSectionModel | undefined,
): TourTripDetails | undefined {
  if (!locationSection?.regionId?.trim() || !locationSection.mainDestinationId?.trim()) {
    return tripDetails ?? undefined;
  }
  const base =
    tripDetails && typeof tripDetails === "object" && !Array.isArray(tripDetails)
      ? ({ ...tripDetails } as TourTripDetails)
      : ({} as TourTripDetails);
  const overview = {
    ...(typeof base.overview === "object" && base.overview !== null && !Array.isArray(base.overview)
      ? { ...base.overview }
      : {}),
    settingsRegionId: locationSection.regionId.trim(),
    settingsMainDestinationId: locationSection.mainDestinationId.trim(),
  } as Record<string, unknown>;
  const raw = locationSection.secondaryDestinationIdsRaw?.trim();
  if (raw) {
    overview.secondaryDestinationIdsRaw = raw;
  }
  return { ...base, overview } as TourTripDetails;
}

/**
 * Single mapping from domain/UI inputs → {@link CreateTourDto} for `POST /api/v2/tours`.
 * Trimming and optional `description` / `location` behavior must stay aligned across all create flows.
 */
export function mapCreateTourDto(
  payload: MapCreateTourDtoInput,
  options?: { themeCatalog?: readonly { id: string; name: string }[] },
): CreateTourDtoPrepared {
  const primarySocialLink = payload.socialLinks?.[0]?.url?.trim();
  const fallbackCommunicationLink = payload.communicationLink?.trim();
  const communicationLink = primarySocialLink || fallbackCommunicationLink;
  /** Wire-safe `tripDetails` (trimmed strings, filtered arrays, valid `dayPlans`, no `undefined` keys). */
  const tripDetailsWithLocations = injectLocationSectionIntoTripDetails(
    payload.tripDetails ?? undefined,
    payload.locationSection,
  );
  const tripDetailsEnriched = applyTourThemeOverviewEnrichment(
    tripDetailsWithLocations,
    options?.themeCatalog,
  );
  const tripDetailsCompact = compactTripDetailsForApi(tripDetailsEnriched) as TourTripDetails | undefined;
  const derivedDurationDays = computeTourDurationDays(
    tripDetailsCompact?.logistics?.departureDate,
    tripDetailsCompact?.logistics?.returnDate,
  );

  return {
    title: payload.title.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.locationSection?.displayLocationOverride?.trim()
      ? { location: payload.locationSection.displayLocationOverride.trim() }
      : payload.location?.trim()
        ? { location: payload.location.trim() }
        : {}),
    ...(communicationLink ? { communicationLink } : {}),
    autoAcceptRegistrations: payload.autoAcceptRegistrations ?? true,
    ...(payload.tourType ? { tourType: payload.tourType } : {}),
    ...(payload.transportModes && payload.transportModes.length > 0
      ? { transportModes: [...new Set(payload.transportModes)].sort() as CreateTourDto["transportModes"] }
      : {}),
    ...(typeof derivedDurationDays === "number" ? { durationDays: derivedDurationDays } : {}),
    ...(tripDetailsCompact ? { tripDetails: tripDetailsCompact } : {}),
    ...(payload.socialLinks && payload.socialLinks.length > 0 ? { socialLinks: payload.socialLinks } : {}),
    capacity: payload.capacity,
    price: payload.price,
    lifecycle_status: payload.lifecycle_status,
    ...(payload.destinationId != null && payload.destinationId !== ""
      ? { destinationId: payload.destinationId }
      : {}),
    ...(payload.requiresPayment === true ? { requiresPayment: true } : {}),
    ...(payload.paymentMode === "offline_receipt" ? { paymentMode: "offline_receipt" } : {}),
    ...(payload.sourcePresetId ? { sourcePresetId: payload.sourcePresetId } : {}),
    ...(payload.sourceTourId ? { sourceTourId: payload.sourceTourId } : {}),
    ...(payload.customServiceLabels && payload.customServiceLabels.length > 0
      ? { customServiceLabels: [...payload.customServiceLabels] }
      : {}),
  };
}
