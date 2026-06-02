import type {
  PricingEngineInput,
  PricingEngineQuoteOptions,
  PricingQuoteResult,
} from "../pricing-catalog.types";

export const PRICING_CATALOG_PORT = Symbol("PRICING_CATALOG_PORT");

export interface PricingCatalogPort {
  quote(
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult>;
}

