import type { TourEntity } from "../entities/tour.entity";
import { currencyCodeFromCostContext, listPriceMinorFromCostContext } from "../utils/commercial-fields";

/**
 * Canonical list-price quote from tour state (denormalized columns + cost_context).
 * Future rule-based pricing can wrap or replace this without touching registration paths.
 */
export function quoteListPriceForTour(tour: TourEntity): {
  listPriceMinor?: string;
  currencyCode: string;
} {
  const cost = tour.costContext as Record<string, unknown> | undefined;
  const minor = listPriceMinorFromCostContext(cost);
  return {
    ...(minor ? { listPriceMinor: minor } : {}),
    currencyCode: currencyCodeFromCostContext(cost)
  };
}
