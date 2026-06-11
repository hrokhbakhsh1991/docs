import {
  buildTourListProjection,
  type TourListProjection,
  type TourListProjectionFields,
  type TourListStatus,
  type TourUiStatus,
} from "@app-tour/workspace-sdk";
import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { ApiAbility } from "../casl/api-ability";
import { ScopedTourRepository } from "../db/scoped-tour.repository";
import type { TourRecord } from "../db/tour-record";
import { enrichTourListProjectionsWithAcceptedCount } from "../bookings/enrich-tour-accepted-counts";
import type { TourStorageRepository } from "../db/tour.repository";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

export type OperatorListSortBy = "created_at" | "title" | "price";
export type OperatorListSortDir = "asc" | "desc";
export type OperatorListStatusFilter = "active" | "completed" | "archived";

export type OperatorListToursQuery = {
  readonly search?: string;
  readonly status?: OperatorListStatusFilter;
  readonly category?: string;
  readonly page: number;
  readonly limit: number;
  readonly sortBy: OperatorListSortBy;
  readonly sortDir: OperatorListSortDir;
  readonly includeTotal: boolean;
};

export type OperatorTourListResult = {
  readonly items: readonly TourListProjection[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};

const STATUS_BUCKET: Record<
  OperatorListStatusFilter,
  readonly { listStatus: TourListStatus; uiStatus?: TourUiStatus }[]
> = {
  active: [{ listStatus: "draft", uiStatus: "draft" }],
  completed: [
    { listStatus: "open", uiStatus: "active" },
    { listStatus: "published", uiStatus: "active" },
  ],
  archived: [
    { listStatus: "closed" },
    { listStatus: "cancelled" },
    { listStatus: "archived", uiStatus: "archived" },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readStarterTitle(canonical: CanonicalDocument): string {
  const data = canonical.data;
  if (!isRecord(data)) {
    return "Untitled tour";
  }
  const basics = data.basics;
  if (isRecord(basics) && typeof basics.title === "string" && basics.title.trim().length > 0) {
    return basics.title.trim();
  }
  if (typeof data.title === "string" && data.title.trim().length > 0) {
    return data.title.trim();
  }
  return "Untitled tour";
}

function defaultExtractTourListProjection(canonical: CanonicalDocument): TourListProjectionFields {
  return Object.freeze({
    title: readStarterTitle(canonical),
    shortDescription: null,
    listStatus: "draft",
    uiStatus: "draft",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    departureAt: null,
  });
}

function toRowMeta(record: TourRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    rowVersion: record.rowVersion,
  };
}

function matchesStatusFilter(
  projection: TourListProjectionFields,
  status: OperatorListStatusFilter | undefined
): boolean {
  if (status === undefined) {
    return true;
  }
  const buckets = STATUS_BUCKET[status];
  return buckets.some((bucket) => {
    if (bucket.uiStatus !== undefined) {
      return projection.listStatus === bucket.listStatus && projection.uiStatus === bucket.uiStatus;
    }
    return projection.listStatus === bucket.listStatus;
  });
}

function matchesSearch(projection: TourListProjectionFields, search: string | undefined): boolean {
  if (search === undefined || search.length === 0) {
    return true;
  }
  const needle = search.toLocaleLowerCase();
  const haystacks = [projection.title, projection.shortDescription ?? ""];
  return haystacks.some((value) => value.toLocaleLowerCase().includes(needle));
}

function matchesCategoryFilter(
  projection: TourListProjectionFields,
  category: string | undefined
): boolean {
  if (category === undefined || category.length === 0) {
    return true;
  }
  return projection.category === category;
}

function compareProjections(
  left: TourListProjection,
  right: TourListProjection,
  sortBy: OperatorListSortBy,
  sortDir: OperatorListSortDir
): number {
  let delta = 0;
  if (sortBy === "title") {
    delta = left.title.localeCompare(right.title);
  } else if (sortBy === "price") {
    const leftPrice = left.priceAmount ?? Number.NEGATIVE_INFINITY;
    const rightPrice = right.priceAmount ?? Number.NEGATIVE_INFINITY;
    delta = leftPrice - rightPrice;
  } else {
    delta = left.createdAt.localeCompare(right.createdAt);
  }
  return sortDir === "asc" ? delta : -delta;
}

export async function listToursOperator(
  store: TourStorageRepository,
  ability: ApiAbility,
  tenantId: string,
  query: OperatorListToursQuery
): Promise<OperatorTourListResult> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = resolveWorkspacePluginForType(workspaceType);
  const extract =
    plugin.tourList?.extractTourListProjection ?? defaultExtractTourListProjection;

  const scopedRepo = new ScopedTourRepository(store, ability);
  const records = await scopedRepo.findMany();

  const projected = records.map((record) =>
    buildTourListProjection(toRowMeta(record), record.canonical, extract)
  );

  const filtered = projected.filter(
    (row) =>
      matchesSearch(row, query.search) &&
      matchesStatusFilter(row, query.status) &&
      matchesCategoryFilter(row, query.category)
  );
  filtered.sort((left, right) => compareProjections(left, right, query.sortBy, query.sortDir));

  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;
  const pageItems = filtered.slice(offset, offset + query.limit);
  const items = await enrichTourListProjectionsWithAcceptedCount(tenantId, pageItems);

  return {
    items,
    total: query.includeTotal ? total : items.length,
    page: query.page,
    limit: query.limit,
  };
}
