import type { Prisma } from "@prisma/client";

import type {
  OperatorListSortBy,
  OperatorListSortDir,
  OperatorListStatusFilter,
} from "./list-tours-operator";

export const OPERATOR_TOUR_LIST_SELECT = {
  id: true,
  tenantId: true,
  canonical: true,
  createdAt: true,
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
    return [{ startDate: sortDir }, { id: sortDir }];
  }
  if (sortBy === "price") {
    return [{ createdAt: sortDir }, { id: sortDir }];
  }
  return [{ createdAt: sortDir }, { id: sortDir }];
}

export function buildOperatorTourWhere(input: {
  readonly tenantId: string;
  readonly search?: string;
  readonly status?: OperatorListStatusFilter;
}): Prisma.TourWhereInput {
  const search = input.search?.trim();
  return {
    tenantId: input.tenantId,
    ...(search !== undefined && search.length > 0
      ? { title: { contains: search, mode: "insensitive" } }
      : {}),
    ...(input.status !== undefined
      ? { publishStatus: { in: [...publishStatusesForOperatorFilter(input.status)] } }
      : {}),
  };
}
