import type { PublicCatalogCard, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

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

/** Map Denali canonical tour row to public marketing card (egress-safe). */
export function toDenaliCatalogCard(tour: PublicCatalogTourInput): PublicCatalogCard {
  const data = tour.canonical.data;
  if (!isRecord(data)) {
    return Object.freeze({
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
    });
  }

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
  });
}
