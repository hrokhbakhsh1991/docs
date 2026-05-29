import type { PricingLineItem, PricingQuoteResult } from "./pricing-catalog.types";

export type RegistrationQuoteSnapshot = {
  quotedListPriceMinor: string;
  quotedCurrencyCode: string;
  quotedTotalMinor: string;
  quotedPricingVersion: string;
  quotedLineItemsJson: PricingLineItem[];
};

/** Pure projection: pricing engine quote → registration persisted quote columns. */
export function mapPricingQuoteToRegistrationQuoteSnapshot(
  quote: PricingQuoteResult
): RegistrationQuoteSnapshot {
  const base = quote.line_items.find((l) => l.kind === "base");
  const quotedListPriceMinor = base?.amount_minor ?? quote.total;
  return {
    quotedListPriceMinor,
    quotedCurrencyCode: quote.currency_code,
    quotedTotalMinor: quote.total,
    quotedPricingVersion: quote.pricing_version,
    quotedLineItemsJson: quote.line_items
  };
}
