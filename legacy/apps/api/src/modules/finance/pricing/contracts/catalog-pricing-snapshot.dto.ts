/**
 * Read-only catalog inputs for the finance pricing pipeline.
 * Populated by {@link CatalogPricingLoadPort} implementations outside `modules/finance`.
 */
export type CatalogTourPricingSnapshot = {
  readonly id: string;
  readonly tenantId: string;
  readonly tourDepartureId: string | null;
  readonly tourProductId: string | null;
  readonly listPriceMinor: string | null;
  readonly currencyCode: string | null;
  /** Precomputed list price from tour cost context (legacy `quoteListPriceForTour` semantics). */
  readonly quoteListFallbackMinor: string | null;
  readonly quoteListFallbackCurrency: string;
};

export type CatalogDeparturePricingSnapshot = {
  readonly id: string;
  readonly tenantId: string;
  readonly tourProductId: string | null;
  readonly listPriceMinor: string | null;
  readonly currencyCode: string | null;
};

/** One `tour_prices` row projected for finance rules (no TypeORM types). */
export type CatalogTourPriceRowSnapshot = {
  readonly id: string;
  readonly tourDepartureId: string;
  /** Lowercase slug aligned with `TourPriceType` in tours module (e.g. `base`). */
  readonly priceType: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly conditionsJson: Record<string, unknown> | null;
};

export type CatalogPricingSnapshot = {
  readonly tour: CatalogTourPricingSnapshot;
  readonly departure: CatalogDeparturePricingSnapshot;
  readonly prices: readonly CatalogTourPriceRowSnapshot[];
};
