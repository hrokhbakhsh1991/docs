import { createDefaultFinancePricingEngine } from "./pricing-engine";
import type { CatalogPricingSnapshot } from "./contracts/catalog-pricing-snapshot.dto";
import type { PricingContext } from "./pricing-context";
import type { PricingQuote } from "./pricing-quote";

export type CalculateQuoteInput = PricingContext;

/**
 * Pure finance quote: **catalog snapshot + context → quote**. No database or ports — load the snapshot
 * in an adapter/service, then call this.
 */
export function calculateQuote(input: CalculateQuoteInput, catalog: CatalogPricingSnapshot): PricingQuote {
  return createDefaultFinancePricingEngine().evaluate(input, catalog);
}
