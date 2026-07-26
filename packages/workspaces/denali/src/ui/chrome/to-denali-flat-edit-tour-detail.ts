import type { DenaliFlatEditTourDetail } from "./use-flat-edit-page-core";

/**
 * Minimal operator list/detail projection fields needed for flat-edit chrome.
 * Host may pass a richer TourListProjection; only these fields are read.
 */
export type TourProjectionForFlatEditDetail = {
  readonly title: string;
  readonly uiStatus: string;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly departureAt: string | null;
  readonly acceptedCount: number;
  readonly totalCapacity: number | null;
};

/**
 * Maps operator tour detail projection → Denali flat-edit chrome detail
 * (`acceptedCount` → `acceptedSeats`, `totalCapacity` → `capacity`).
 */
export function toDenaliFlatEditTourDetail(detail: {
  readonly projection: TourProjectionForFlatEditDetail;
}): DenaliFlatEditTourDetail {
  return {
    projection: {
      title: detail.projection.title,
      uiStatus: detail.projection.uiStatus,
      priceAmount: detail.projection.priceAmount,
      priceCurrency: detail.projection.priceCurrency,
      departureAt: detail.projection.departureAt,
      acceptedSeats: detail.projection.acceptedCount,
      capacity: detail.projection.totalCapacity,
    },
  };
}
