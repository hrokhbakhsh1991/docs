import type { TourListProjection } from "@app-tour/workspace-sdk";

import { sumApprovedPartySizeByTourIds } from "./bookings.service";

/** Operator list/detail — approved `partySize` sum per tour (no guest PII). */
export async function enrichTourListProjectionsWithAcceptedCount(
  tenantId: string,
  items: readonly TourListProjection[]
): Promise<TourListProjection[]> {
  if (items.length === 0) {
    return [];
  }
  const approvedByTour = await sumApprovedPartySizeByTourIds(
    tenantId,
    items.map((item) => item.id)
  );
  return items.map((item) =>
    Object.freeze({
      ...item,
      acceptedCount: approvedByTour[item.id] ?? 0,
    })
  );
}

export async function enrichTourListProjectionWithAcceptedCount(
  tenantId: string,
  item: TourListProjection
): Promise<TourListProjection> {
  const [enriched] = await enrichTourListProjectionsWithAcceptedCount(tenantId, [item]);
  return enriched ?? item;
}
