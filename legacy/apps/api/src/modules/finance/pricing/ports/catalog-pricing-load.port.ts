import type { EntityManager } from "typeorm";
import type { CatalogPricingSnapshot } from "../contracts/catalog-pricing-snapshot.dto";
import type { PricingContext } from "../pricing-context";

export const CATALOG_PRICING_LOAD_PORT = Symbol("CATALOG_PRICING_LOAD_PORT");

/**
 * I/O port: loads {@link CatalogPricingSnapshot} for a quote. **Pricing engines do not implement this** —
 * they consume an already-loaded snapshot. Keeps finance free of tour ORM imports.
 */
export interface CatalogPricingLoadPort {
  loadSnapshot(_manager: EntityManager, _context: PricingContext): Promise<CatalogPricingSnapshot>;
}
