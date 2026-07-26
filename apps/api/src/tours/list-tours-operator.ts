import {
  buildTourListProjection,
  type TourListProjection,
  type TourListProjectionFields,
} from "@app-tour/workspace-sdk";
import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { ApiAbility } from "../casl/api-ability";
import { ScopedTourRepository } from "../db/scoped-tour.repository";
import type { TourRecord } from "../db/tour-record";
import { enrichTourListProjectionsWithAcceptedCount } from "../bookings/enrich-tour-accepted-counts";
import { enrichTourListProjectionsCoverImageUrls } from "./enrich-tour-list-cover-image-url";
import type { TourStorageRepository } from "../db/tour.repository";
import { ensureDevMemoryTourSeedForTenant } from "../storage/create-tour-storage";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

import type {
  OperatorListSortBy,
  OperatorListSortDir,
  OperatorListStatusFilter,
} from "./operator-tour-list-types";

export type { OperatorListSortBy, OperatorListSortDir, OperatorListStatusFilter } from "./operator-tour-list-types";

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
    coverImageStorageKey: null,
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

function matchesCategoryFilter(
  projection: TourListProjectionFields,
  category: string | undefined
): boolean {
  if (category === undefined || category.length === 0) {
    return true;
  }
  return projection.category === category;
}

export async function listToursOperator(
  store: TourStorageRepository,
  ability: ApiAbility,
  tenantId: string,
  query: OperatorListToursQuery
): Promise<OperatorTourListResult> {
  ensureDevMemoryTourSeedForTenant(tenantId, store);
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = await resolveWorkspacePluginForType(workspaceType);
  const extract =
    plugin.tourList?.extractTourListProjection ?? defaultExtractTourListProjection;

  const scopedRepo = new ScopedTourRepository(store, ability);
  const pageResult = await scopedRepo.listOperatorToursPage(tenantId, query);
  const records = pageResult.items;

  const projected = records.map((record) =>
    buildTourListProjection(toRowMeta(record), record.canonical, extract)
  );

  const filtered = projected.filter((row) => matchesCategoryFilter(row, query.category));
  const recordsById = new Map(records.map((record) => [record.id, record] as const));
  const pageItemsWithCover = await enrichTourListProjectionsCoverImageUrls(
    filtered,
    recordsById,
    tenantId,
    workspaceType
  );
  const items = await enrichTourListProjectionsWithAcceptedCount(tenantId, pageItemsWithCover);

  return {
    items,
    total: query.includeTotal ? pageResult.total : items.length,
    page: query.page,
    limit: query.limit,
  };
}
