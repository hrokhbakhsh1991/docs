import {
  buildTourListProjection,
  type TourListProjection,
  type TourListProjectionFields,
} from "@app-tour/workspace-sdk";

import type { ApiAbility } from "../casl/api-ability";
import { ScopedTourRepository } from "../db/scoped-tour.repository";
import type { TourRecord } from "../db/tour-record";
import { enrichTourListProjectionsWithAcceptedCount } from "../bookings/enrich-tour-accepted-counts";
import { enrichTourListProjectionsCoverImageUrls } from "./enrich-tour-list-cover-image-url";
import type { TourStorageRepository } from "../db/tour.repository";
import { ensureDevMemoryTourSeedForTenant } from "../storage/create-tour-storage";
import { getActiveWorkspaceType } from "../tenant/tenant-request-context";
import { resolveTourListProjectionExtractorForWorkspace } from "./workspace-tour-list-projection-dispatch";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import {
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
  const activeWorkspaceType = getActiveWorkspaceType()?.trim();
  const workspaceType =
    activeWorkspaceType !== undefined && activeWorkspaceType.length > 0
      ? activeWorkspaceType
      : await resolveWorkspaceTypeForTenant(tenantId);
  const extract = resolveTourListProjectionExtractorForWorkspace(workspaceType);

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
