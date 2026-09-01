/**
 * Harbor G1 Event catalog card projection (PSR-6c2).
 * Thin mapper — no Denali/Urban catalog.service clone.
 */
import type {
  CanonicalDocument,
  PublicCatalogCard,
  PublicCatalogTourInput,
} from "@app-tour/workspace-sdk";

import { buildHarborEventJsonLd } from "./build-harbor-event-jsonld";
import type { HarborSmokeCatalogCard } from "./harbor-smoke-catalog";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Prefer nested `data.tour` (Urban-like) then flat `data` (smoke-like). */
function resolveHarborTourFields(
  canonical: CanonicalDocument,
): Record<string, unknown> {
  const data = asRecord(canonical.data) ?? {};
  const nested = asRecord(data.tour);
  return nested ?? data;
}

function readString(
  fields: Record<string, unknown>,
  key: string,
): string | null {
  const value = fields[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(
  fields: Record<string, unknown>,
  key: string,
): number | null {
  const value = fields[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isHarborTourPublished(canonical: CanonicalDocument): boolean {
  const fields = resolveHarborTourFields(canonical);
  const status = fields.publishStatus ?? fields.status;
  return status === "published";
}

/**
 * Map a published tour record to Harbor public Event card (city filter field included).
 */
export function toHarborCatalogCard(
  tour: PublicCatalogTourInput,
): HarborSmokeCatalogCard {
  const fields = resolveHarborTourFields(tour.canonical);
  const city = readString(fields, "city") ?? "";
  const title = readString(fields, "title") ?? tour.id;
  const shortDescription =
    readString(fields, "shortDescription") ??
    readString(fields, "catalogSummary");
  const category = readString(fields, "category");
  const departureAt =
    readString(fields, "departureAt") ?? readString(fields, "startDate");
  const endAt = readString(fields, "endAt") ?? readString(fields, "endDate");
  const priceAmount = readNumber(fields, "priceAmount");
  const priceCurrency = readString(fields, "priceCurrency") ?? "IRR";
  const coverImageUrl = readString(fields, "coverImageUrl");
  const totalCapacity =
    readNumber(fields, "totalCapacity") ?? readNumber(fields, "capacity");
  const policiesText = readString(fields, "policiesText");
  const cancellationDeadlineHours = readNumber(
    fields,
    "cancellationDeadlineHours",
  );
  const cancellationPenaltyPercentage = readNumber(
    fields,
    "cancellationPenaltyPercentage",
  );
  const catalogUpdatedAt =
    tour.catalogUpdatedAt ??
    readString(fields, "catalogUpdatedAt") ??
    readString(fields, "publishedAt");

  const card: PublicCatalogCard = Object.freeze({
    id: tour.id,
    title,
    shortDescription,
    category,
    departureAt,
    endAt,
    priceAmount,
    priceCurrency,
    coverImageUrl,
    totalCapacity,
    catalogUpdatedAt,
    listSubtitle: city.length > 0 ? city : null,
    policiesText,
    cancellationDeadlineHours,
    cancellationPenaltyPercentage,
  });

  return Object.freeze({
    ...card,
    city,
    structuredData: buildHarborEventJsonLd(card) as unknown as Readonly<
      Record<string, unknown>
    >,
  });
}
