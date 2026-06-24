import type { PublicCatalogCard, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { buildDenaliTouristTripJsonLd } from "./build-denali-tourist-trip-jsonld";
import {
  projectDenaliCatalogItinerary,
  readDenaliCatalogDifficultyLevel,
  readDenaliCatalogFitnessLevel,
  type ProjectDenaliCatalogItineraryOptions,
} from "./project-denali-catalog-itinerary";

export type DenaliCatalogCardOptions = ProjectDenaliCatalogItineraryOptions;

const DEFAULT_PRICE_CURRENCY = "IRR";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number.isInteger(value) ? value : Math.trunc(value);
}

function readCoverImageUrl(photos: unknown): string | null {
  if (Array.isArray(photos)) {
    const first = photos[0];
    return isRecord(first) ? readString(first.url) : null;
  }
  if (!isRecord(photos)) {
    return null;
  }
  const items = photos.items ?? photos.entries ?? photos.photos;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const first = items[0];
  return isRecord(first) ? readString(first.url) : null;
}

function buildBaseCard(
  tour: PublicCatalogTourInput,
  data: Record<string, unknown>,
  options?: DenaliCatalogCardOptions
): PublicCatalogCard {
  const itineraryDays = projectDenaliCatalogItinerary(data, options);
  return Object.freeze({
    id: tour.id,
    title: readString(data.title) ?? "Untitled tour",
    shortDescription: readString(readCanonicalPath(data, "program.shortDescription")),
    category: readString(data.category),
    departureAt: readString(data.startDateTime),
    endAt: readString(data.endDateTime),
    priceAmount: readInteger(readCanonicalPath(data, "pricing.basePricePerPerson")),
    priceCurrency: DEFAULT_PRICE_CURRENCY,
    coverImageUrl: readCoverImageUrl(data.photos),
    totalCapacity: readInteger(data.capacityMax),
    difficultyLevel: readDenaliCatalogDifficultyLevel(data),
    fitnessLevel: readDenaliCatalogFitnessLevel(data),
    ...(itineraryDays != null ? { itineraryDays } : {}),
    policiesText: readString(readCanonicalPath(data, "policies.policiesText")),
    cancellationDeadlineHours: readInteger(
      readCanonicalPath(data, "policies.cancellationDeadlineHours")
    ),
    cancellationPenaltyPercentage: readInteger(
      readCanonicalPath(data, "policies.cancellationPenaltyPercentage")
    ),
  });
}

function attachStructuredData(card: PublicCatalogCard): PublicCatalogCard {
  return Object.freeze({
    ...card,
    structuredData: buildDenaliTouristTripJsonLd(card) as unknown as Readonly<Record<string, unknown>>,
  });
}

/** Map Denali canonical tour row to public marketing card (egress-safe). */
export function toDenaliCatalogCard(
  tour: PublicCatalogTourInput,
  options?: DenaliCatalogCardOptions
): PublicCatalogCard {
  const data = tour.canonical.data;
  if (!isRecord(data)) {
    return attachStructuredData(
      Object.freeze({
        id: tour.id,
        title: "Untitled tour",
        shortDescription: null,
        category: null,
        departureAt: null,
        endAt: null,
        priceAmount: null,
        priceCurrency: DEFAULT_PRICE_CURRENCY,
        coverImageUrl: null,
        totalCapacity: null,
      })
    );
  }

  return attachStructuredData(buildBaseCard(tour, data, options));
}
