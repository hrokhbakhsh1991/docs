import type { PublicCatalogCard, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { buildDenaliTouristTripJsonLd } from "./build-denali-tourist-trip-jsonld";
import type { DenaliCatalogPhotoEnrichment } from "./enrich-denali-catalog-photo-urls";
import {
  projectDenaliCatalogItinerary,
  readDenaliCatalogDifficultyLevel,
  readDenaliCatalogFitnessLevel,
  type ProjectDenaliCatalogItineraryOptions,
} from "./project-denali-catalog-itinerary";
import { readDenaliCatalogDetailEgress } from "./read-denali-catalog-detail-egress";
import {
  readDenaliCatalogBirthDateRequired,
  readDenaliCatalogFatherNameRequired,
  readDenaliCatalogTransportSnapshot,
} from "./read-denali-catalog-transport";
import { readDenaliFirstPhotoHttpsUrl } from "../list/read-denali-first-photo";

export type DenaliCatalogCardOptions = ProjectDenaliCatalogItineraryOptions & {
  readonly photoEnrichment?: DenaliCatalogPhotoEnrichment;
};

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

function readCoverImageUrl(
  photos: unknown,
  enrichment: DenaliCatalogPhotoEnrichment | undefined
): string | null {
  const httpsUrl = readDenaliFirstPhotoHttpsUrl(photos);
  if (httpsUrl != null) {
    return httpsUrl;
  }
  return enrichment?.coverImageUrl ?? null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readDenaliCatalogNationalIdRequired(data: Record<string, unknown>): boolean {
  return (
    readBoolean(readCanonicalPath(data, "participantRequirements.nationalIdRequired")) ||
    readBoolean(readCanonicalPath(data, "participants.nationalIdRequired"))
  );
}

function buildBaseCard(
  tour: PublicCatalogTourInput,
  data: Record<string, unknown>,
  options?: DenaliCatalogCardOptions
): PublicCatalogCard {
  const photoUrlById = options?.photoEnrichment?.photoUrlById ?? options?.photoUrlById;
  const itineraryOptions: ProjectDenaliCatalogItineraryOptions | undefined =
    options?.destinationNameById != null || photoUrlById != null
      ? {
          ...(options?.destinationNameById != null
            ? { destinationNameById: options.destinationNameById }
            : {}),
          ...(photoUrlById != null ? { photoUrlById } : {}),
        }
      : undefined;
  const itineraryDays = projectDenaliCatalogItinerary(data, itineraryOptions);
  const category = readString(data.category);
  const shortDescription = readString(readCanonicalPath(data, "program.shortDescription"));
  const priceAmount = readInteger(readCanonicalPath(data, "pricing.basePricePerPerson"));
  const transport = readDenaliCatalogTransportSnapshot(data);
  const nationalIdRequired = readDenaliCatalogNationalIdRequired(data);
  const fatherNameRequired = readDenaliCatalogFatherNameRequired(data);
  const birthDateRequired = readDenaliCatalogBirthDateRequired(data);
  const catalogUpdatedAt = readString(tour.catalogUpdatedAt);
  const coverImageUrl = readCoverImageUrl(data.photos, options?.photoEnrichment);
  const detailEgress = readDenaliCatalogDetailEgress(data, {
    ...(options?.destinationNameById != null
      ? { destinationNameById: options.destinationNameById }
      : {}),
    ...(photoUrlById != null ? { photoUrlById } : {}),
    coverImageUrl,
  });
  return Object.freeze({
    id: tour.id,
    title: readString(data.title) ?? "Untitled tour",
    shortDescription,
    category,
    departureAt: readString(data.startDateTime),
    endAt: readString(data.endDateTime),
    priceAmount,
    priceCurrency: DEFAULT_PRICE_CURRENCY,
    coverImageUrl,
    totalCapacity: readInteger(data.capacityMax),
    difficultyLevel: readDenaliCatalogDifficultyLevel(data),
    fitnessLevel: readDenaliCatalogFitnessLevel(data),
    listSubtitle: category,
    listDescription: shortDescription,
    showListPrice: true,
    ...detailEgress,
    ...(catalogUpdatedAt != null ? { catalogUpdatedAt } : {}),
    ...(itineraryDays != null ? { itineraryDays } : {}),
    policiesText: readString(readCanonicalPath(data, "policies.policiesText")),
    cancellationDeadlineHours: readInteger(
      readCanonicalPath(data, "policies.cancellationDeadlineHours")
    ),
    cancellationPenaltyPercentage: readInteger(
      readCanonicalPath(data, "policies.cancellationPenaltyPercentage")
    ),
    ...(nationalIdRequired ? { nationalIdRequired: true } : {}),
    ...(fatherNameRequired ? { fatherNameRequired: true } : {}),
    ...(birthDateRequired ? { birthDateRequired: true } : {}),
    transport,
  });
}

function attachStructuredData(card: PublicCatalogCard): PublicCatalogCard {
  return Object.freeze({
    ...card,
    structuredData: buildDenaliTouristTripJsonLd(card) as unknown as Readonly<Record<string, unknown>>,
  });
}

/** Rebuild JSON-LD after exposure redaction so offers/image match visible fields. */
export function refreshDenaliCatalogStructuredData(card: PublicCatalogCard): PublicCatalogCard {
  return attachStructuredData(card);
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
        listSubtitle: null,
        listDescription: null,
        showListPrice: true,
        ...(tour.catalogUpdatedAt?.trim() ? { catalogUpdatedAt: tour.catalogUpdatedAt.trim() } : {}),
      })
    );
  }

  return attachStructuredData(buildBaseCard(tour, data, options));
}
