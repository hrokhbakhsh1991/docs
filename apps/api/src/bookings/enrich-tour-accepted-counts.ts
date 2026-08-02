import type { TourListProjection } from "@app-tour/workspace-sdk";

import { BookingWorkspaceUnsupportedError } from "./bookings.errors";
import { sumApprovedPartySizeByTourIds } from "./create-bookings-service";

/** Operator list/detail — approved `partySize` sum per tour (no guest PII). */
export async function enrichTourListProjectionsWithAcceptedCount(
  tenantId: string,
  items: readonly TourListProjection[]
): Promise<TourListProjection[]> {
  if (items.length === 0) {
    return [];
  }
  let approvedByTour: Readonly<Record<string, number>>;
  try {
    approvedByTour = await sumApprovedPartySizeByTourIds(
      tenantId,
      items.map((item) => item.id)
    );
  } catch (error: unknown) {
    // Tour projection must not cascade Booking workspace gates into HTTP 404/500.
    // Unsupported / unresolved tenants keep acceptedCount=0 (fail-soft read enrichment).
    if (error instanceof BookingWorkspaceUnsupportedError) {
      approvedByTour = {};
    } else {
      throw error;
    }
  }
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
