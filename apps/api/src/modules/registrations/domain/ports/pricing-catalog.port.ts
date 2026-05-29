import type { EntityManager } from "typeorm";

import type {
  PricingEngineInput,
  PricingEngineQuoteOptions,
  PricingQuoteResult,
} from "../../../pricing/pricing.types";

export const PRICING_CATALOG_PORT = Symbol("PRICING_CATALOG_PORT");

/**
 * Mediates finance/pricing quotes for registration flows without importing {@link PricingEngineService}.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces — see MAP §61.
 */
export interface PricingCatalogPort {
  quote(
    manager: EntityManager,
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult>;
}
