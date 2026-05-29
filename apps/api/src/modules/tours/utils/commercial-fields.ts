import type { TourTripDetails } from "../types/tour-trip-details.types";
import type { TourDetailsPolicySnapshot } from "../domain/tour-policy.types";

export function extractTripLogisticsDates(details: TourDetailsPolicySnapshot | undefined | null): {
  startsOn: string | null;
  endsOn: string | null;
} {
  const td = details?.tripDetails as TourTripDetails | undefined;
  const dep = td?.logistics?.departureDate;
  const ret = td?.logistics?.returnDate;
  const ymd = (s: unknown): string | null =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  return { startsOn: ymd(dep), endsOn: ymd(ret) };
}

export function currencyCodeFromCostContext(cost: Record<string, unknown> | undefined): string {
  const c = cost?.currency;
  if (typeof c === "string" && c.trim()) {
    return c.trim().toUpperCase().slice(0, 3);
  }
  return "USD";
}

/** Minor units as decimal string for TypeORM `bigint` columns. */
export function listPriceMinorFromCostContext(
  cost: Record<string, unknown> | undefined
): string | null {
  if (!cost || typeof cost.totalCost !== "number" || !Number.isFinite(cost.totalCost)) {
    return null;
  }
  return String(Math.round(cost.totalCost * 100));
}
