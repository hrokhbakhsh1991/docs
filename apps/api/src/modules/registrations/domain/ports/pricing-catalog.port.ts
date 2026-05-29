import type { EntityManager } from "typeorm";

import type {
  PricingEngineInput,
  PricingEngineQuoteOptions,
  PricingQuoteResult,
} from "../pricing-catalog.types";

export const PRICING_CATALOG_PORT = Symbol("PRICING_CATALOG_PORT");

export interface PricingCatalogPort {
  quote(
    manager: EntityManager,
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult>;
}
