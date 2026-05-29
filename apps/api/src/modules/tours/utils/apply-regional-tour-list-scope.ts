import type { SelectQueryBuilder } from "typeorm";

import type { TourEntity } from "../entities/tour.entity";
import type { TourWriteRecord } from "../domain/tour-write-record.types";

export type { RegionalTourListScope } from "../../../common/rbac/capability-grant-context-from-request";
import type { RegionalTourListScope } from "../../../common/rbac/capability-grant-context-from-request";

/**
 * Applies regional leader tour filtering (Phase 6).
 * No-op unless `restrictToRegions` is true (actor has `tour.regional.manage`).
 */
export function applyRegionalTourListScope(
  qb: SelectQueryBuilder<TourEntity>,
  scope: RegionalTourListScope,
): void {
  if (!scope.restrictToRegions) {
    return;
  }

  const regionIds = scope.allowedRegionIds.filter((id) => id.trim().length > 0);
  if (regionIds.length === 0) {
    qb.andWhere("1 = 0");
    return;
  }

  qb.andWhere("destinationRegion.id IN (:...regionalScopeIds)", {
    regionalScopeIds: regionIds,
  });
}

export function tourDestinationRegionId(tour: TourWriteRecord): string | null {
  const regionId = tour.destination?.region?.id ?? tour.destination?.regionId;
  return typeof regionId === "string" && regionId.trim() !== "" ? regionId.trim() : null;
}

export function assertTourVisibleInRegionalScope(
  tour: TourWriteRecord,
  scope: RegionalTourListScope,
): boolean {
  if (!scope.restrictToRegions) {
    return true;
  }
  const regionId = tourDestinationRegionId(tour);
  if (!regionId) {
    return false;
  }
  return scope.allowedRegionIds.includes(regionId);
}

export function assertDestinationRegionInRegionalScope(
  regionId: string | null | undefined,
  scope: RegionalTourListScope,
): boolean {
  if (!scope.restrictToRegions) {
    return true;
  }
  if (!regionId || regionId.trim() === "") {
    return false;
  }
  return scope.allowedRegionIds.includes(regionId.trim());
}
