import type { DenaliTourRecord } from "../http/ports/tour-store.port";
import type { BookingPublicPort } from "../http/ports/public-booking.port";
import { matchesDenaliCatalogCategoryFilter } from "../marketing/catalog-filter-config";
import {
  readDenaliCatalogDifficultyLevel,
  readDenaliCatalogFitnessLevel,
} from "./project-denali-catalog-itinerary";

export type DenaliCatalogListSort =
  | "newest"
  | "departure_asc"
  | "departure_desc"
  | "price_asc"
  | "price_desc"
  | "difficulty_asc";

export type DenaliCatalogListQuery = {
  readonly q?: string;
  readonly category?: string;
  readonly difficulty?: number;
  readonly fitness?: string;
  readonly availability?: "open";
  readonly sort?: DenaliCatalogListSort;
};

const DENALI_CATALOG_LIST_SORTS: readonly DenaliCatalogListSort[] = [
  "newest",
  "departure_asc",
  "departure_desc",
  "price_asc",
  "price_desc",
  "difficulty_asc",
];

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

function readTourData(tour: DenaliTourRecord): Record<string, unknown> | null {
  const data = tour.canonical.data;
  return isRecord(data) ? data : null;
}

export function parseDenaliCatalogListSort(value: string | undefined): DenaliCatalogListSort {
  const normalized = value?.trim();
  if (normalized != null && (DENALI_CATALOG_LIST_SORTS as readonly string[]).includes(normalized)) {
    return normalized as DenaliCatalogListSort;
  }
  return "newest";
}

export function parseDenaliCatalogListQuery(input: {
  readonly q?: string;
  readonly category?: string;
  readonly difficulty?: string;
  readonly fitness?: string;
  readonly availability?: string;
  readonly sort?: string;
}): DenaliCatalogListQuery {
  const difficultyRaw = input.difficulty?.trim();
  const difficulty =
    difficultyRaw != null && difficultyRaw.length > 0 && Number.isFinite(Number(difficultyRaw))
      ? Number(difficultyRaw)
      : undefined;
  const fitness = input.fitness?.trim();
  const availability = input.availability?.trim() === "open" ? "open" : undefined;

  return {
    ...(input.q?.trim() ? { q: input.q.trim() } : {}),
    ...(input.category?.trim() ? { category: input.category.trim() } : {}),
    ...(difficulty != null ? { difficulty } : {}),
    ...(fitness != null && fitness.length > 0 ? { fitness } : {}),
    ...(availability != null ? { availability } : {}),
    sort: parseDenaliCatalogListSort(input.sort),
  };
}

function readSearchHaystack(data: Record<string, unknown>): string {
  return [
    readString(data.title),
    readString(data.category),
    readString(readCanonicalPath(data, "program.shortDescription")),
  ]
    .filter((part): part is string => part != null)
    .join(" ")
    .toLowerCase();
}

function readDepartureTimestamp(data: Record<string, unknown>): number | null {
  const departureAt = readString(data.startDateTime);
  if (departureAt == null) {
    return null;
  }
  const parsed = Date.parse(departureAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableNumbers(a: number | null, b: number | null): number {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  return a - b;
}

/** Canonical-field filters before card egress (PR-22). */
export function filterDenaliCatalogTourRecords(
  tours: readonly DenaliTourRecord[],
  query: Pick<DenaliCatalogListQuery, "q" | "category" | "difficulty" | "fitness">
): readonly DenaliTourRecord[] {
  let filtered = tours;

  const category = query.category?.trim();
  if (category != null && category.length > 0) {
    filtered = filtered.filter((tour) => {
      const data = readTourData(tour);
      return data != null && matchesDenaliCatalogCategoryFilter(readString(data.category), category);
    });
  }

  if (query.difficulty != null) {
    filtered = filtered.filter((tour) => {
      const data = readTourData(tour);
      return data != null && readDenaliCatalogDifficultyLevel(data) === query.difficulty;
    });
  }

  const fitness = query.fitness?.trim();
  if (fitness != null && fitness.length > 0) {
    filtered = filtered.filter((tour) => {
      const data = readTourData(tour);
      return data != null && readDenaliCatalogFitnessLevel(data) === fitness;
    });
  }

  const q = query.q?.trim().toLowerCase();
  if (q != null && q.length > 0) {
    filtered = filtered.filter((tour) => {
      const data = readTourData(tour);
      return data != null && readSearchHaystack(data).includes(q);
    });
  }

  return filtered;
}

export async function filterDenaliCatalogTourAvailability(
  tours: readonly DenaliTourRecord[],
  params: {
    readonly tenantId: string;
    readonly availability: DenaliCatalogListQuery["availability"];
    readonly bookingPort?: BookingPublicPort;
  }
): Promise<readonly DenaliTourRecord[]> {
  if (params.availability !== "open") {
    return tours;
  }
  if (params.bookingPort === undefined || tours.length === 0) {
    return tours;
  }

  const approvedByTour = await params.bookingPort.sumApprovedPartySizeByTourIds(
    params.tenantId,
    tours.map((tour) => tour.id)
  );

  return tours.filter((tour) => {
    const data = readTourData(tour);
    if (data == null) {
      return true;
    }
    const totalCapacity = readInteger(data.capacityMax);
    if (totalCapacity == null) {
      return true;
    }
    const occupied = approvedByTour[tour.id] ?? 0;
    return Math.max(0, totalCapacity - occupied) > 0;
  });
}

export function sortDenaliCatalogTourRecords(
  tours: readonly DenaliTourRecord[],
  sort: DenaliCatalogListSort
): readonly DenaliTourRecord[] {
  if (sort === "newest") {
    return [...tours].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const sorted = [...tours];
  switch (sort) {
    case "departure_asc":
      sorted.sort((left, right) => {
        const leftData = readTourData(left);
        const rightData = readTourData(right);
        return compareNullableNumbers(
          leftData != null ? readDepartureTimestamp(leftData) : null,
          rightData != null ? readDepartureTimestamp(rightData) : null
        );
      });
      break;
    case "departure_desc":
      sorted.sort((left, right) => {
        const leftData = readTourData(left);
        const rightData = readTourData(right);
        return compareNullableNumbers(
          rightData != null ? readDepartureTimestamp(rightData) : null,
          leftData != null ? readDepartureTimestamp(leftData) : null
        );
      });
      break;
    case "price_asc":
      sorted.sort((left, right) => {
        const leftData = readTourData(left);
        const rightData = readTourData(right);
        return compareNullableNumbers(
          leftData != null
            ? readInteger(readCanonicalPath(leftData, "pricing.basePricePerPerson"))
            : null,
          rightData != null
            ? readInteger(readCanonicalPath(rightData, "pricing.basePricePerPerson"))
            : null
        );
      });
      break;
    case "price_desc":
      sorted.sort((left, right) => {
        const leftData = readTourData(left);
        const rightData = readTourData(right);
        return compareNullableNumbers(
          rightData != null
            ? readInteger(readCanonicalPath(rightData, "pricing.basePricePerPerson"))
            : null,
          leftData != null
            ? readInteger(readCanonicalPath(leftData, "pricing.basePricePerPerson"))
            : null
        );
      });
      break;
    case "difficulty_asc":
      sorted.sort((left, right) => {
        const leftData = readTourData(left);
        const rightData = readTourData(right);
        return compareNullableNumbers(
          leftData != null ? readDenaliCatalogDifficultyLevel(leftData) : null,
          rightData != null ? readDenaliCatalogDifficultyLevel(rightData) : null
        );
      });
      break;
    default:
      break;
  }

  return sorted;
}

export { matchesDenaliCatalogCategoryFilter } from "../marketing/catalog-filter-config";
