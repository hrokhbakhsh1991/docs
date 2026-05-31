import type { TourWriteRecord } from "../domain/tour-write-record.types";
import { currencyCodeFromCostContext, listPriceMinorFromCostContext } from "../utils/commercial-fields";

/**
 * Canonical list-price quote from tour state (denormalized columns + cost_context).
 * Future rule-based pricing can wrap or replace this without touching registration paths.
 */
export function quoteListPriceForTour(tour: TourWriteRecord): {
  listPriceMinor?: string;
  currencyCode: string;
} {
  const cost = tour.costContext ?? undefined;
  const currency = currencyCodeFromCostContext(cost, { tourCurrencyCode: tour.currencyCode });
  const minor = listPriceMinorFromCostContext(cost, { currencyCode: currency });
  return {
    ...(minor ? { listPriceMinor: minor } : {}),
    currencyCode: currency,
  };
}
