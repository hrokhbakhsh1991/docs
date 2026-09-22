import type { Prisma } from "@prisma/client";

import type {
  OperatorListSortBy,
  OperatorListSortDir,
  OperatorListStatusFilter,
} from "./operator-tour-list-types";

export const OPERATOR_TOUR_LIST_SELECT = {
  id: true,
  tenantId: true,
  canonical: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
  title: true,
  publishStatus: true,
  startDate: true,
} as const satisfies Prisma.TourSelect;

export function publishStatusesForOperatorFilter(
  status: OperatorListStatusFilter
): readonly string[] {
  switch (status) {
    case "active":
      return ["draft"];
    case "completed":
      return ["active", "published", "open"];
    case "archived":
      return ["closed", "cancelled", "archived"];
    default:
      return [];
  }
}

export function buildOperatorTourOrderBy(
  sortBy: OperatorListSortBy,
  sortDir: OperatorListSortDir
): Prisma.TourOrderByWithRelationInput[] {
  if (sortBy === "title") {
    return [{ title: sortDir }, { id: sortDir }];
  }
  if (sortBy === "departure_at") {
    return [{ startDate: { sort: sortDir, nulls: "last" } }, { id: sortDir }];
  }
  if (sortBy === "price") {
    // Price is workspace-canonical JSON and is not a Prisma scalar column.
    // The repository must use the canonical-price comparator for this mode;
    // falling back to createdAt makes the UI label lie about the result.
    return [{ createdAt: "asc" }, { id: "asc" }];
  }
  return [{ createdAt: sortDir }, { id: sortDir }];
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Reads the shared tour price contract without introducing a workspace-specific
 * projection. Missing prices sort last in either direction.
 */
export function readOperatorTourPrice(canonical: unknown): number | null {
  if (canonical === null || typeof canonical !== "object") {
    return null;
  }
  const data = (canonical as { data?: unknown }).data;
  if (data === null || typeof data !== "object") {
    return null;
  }
  const pricing = (data as Record<string, unknown>).pricing;
  if (pricing === null || typeof pricing !== "object") {
    return null;
  }
  const row = pricing as Record<string, unknown>;
  return (
    readFiniteNumber(row.basePricePerPerson) ??
    readFiniteNumber(row.priceAmount) ??
    readFiniteNumber(row.amount)
  );
}

export function compareOperatorTourPrices(
  left: unknown,
  right: unknown,
  leftId: string,
  rightId: string,
  sortDir: OperatorListSortDir
): number {
  const leftPrice = readOperatorTourPrice(left);
  const rightPrice = readOperatorTourPrice(right);
  let delta: number;
  if (leftPrice === null && rightPrice === null) {
    delta = 0;
  } else if (leftPrice === null) {
    return 1;
  } else if (rightPrice === null) {
    return -1;
  } else {
    delta = leftPrice - rightPrice;
  }
  if (delta === 0) {
    delta = leftId.localeCompare(rightId);
  }
  return sortDir === "asc" ? delta : -delta;
}

export function buildOperatorTourWhere(input: {
  readonly tenantId: string;
  readonly search?: string;
  readonly status?: OperatorListStatusFilter;
  readonly category?: string;
}): Prisma.TourWhereInput {
  const search = input.search?.trim();
  const conditions: Prisma.TourWhereInput[] = [];

  if (search !== undefined && search.length > 0) {
    conditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        {
          canonical: {
            path: ["data", "basics", "title"],
            string_contains: search,
            mode: "insensitive",
          },
        },
      ],
    });
  }
  if (input.status !== undefined) {
    conditions.push({
      OR: publishStatusesForOperatorFilter(input.status).map((publishStatus) => ({
        canonical: {
          path: ["data", "publishStatus"],
          equals: publishStatus,
        },
      })),
    });
  }
  if (input.category !== undefined && input.category.length > 0) {
    conditions.push({
      canonical: { path: ["data", "category"], equals: input.category },
    });
  }

  return {
    tenantId: input.tenantId,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
}
