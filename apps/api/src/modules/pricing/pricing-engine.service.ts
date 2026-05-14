import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { PricingContext } from "../finance/pricing/pricing-context";
import { calculateQuote } from "../finance/pricing/calculate-quote";
import { normalizeDiscountCode } from "../finance/pricing/internal/parity-helpers";
import { logPricingShadowDiff } from "../finance/pricing/pricing-shadow-log";
import { CATALOG_PRICING_LOAD_PORT } from "../finance/pricing/ports/catalog-pricing-load.port";
import type { CatalogPricingLoadPort } from "../finance/pricing/ports/catalog-pricing-load.port";
import type { PricingQuote } from "../finance/pricing/pricing-quote";
import { CatalogPricingLoadAdapter } from "../tours/pricing/catalog-pricing-load.adapter";
import { computeLegacyCatalogQuote } from "./pure/compute-legacy-catalog-quote";
import type { PricingEngineInput, PricingEngineQuoteOptions, PricingQuoteResult } from "./pricing.types";

/**
 * Nest façade: **loads catalog via TypeORM** (port/adapter), then runs the **finance** {@link calculateQuote}
 * pipeline (bounded-context {@link PricingEngine}). Legacy {@link computeLegacyCatalogQuote} is retained only
 * for optional shadow diagnostics. No pricing rules query the DB directly.
 */
@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  private readonly catalogPricingLoad: CatalogPricingLoadPort;

  constructor(
    @Optional() @Inject(CATALOG_PRICING_LOAD_PORT) catalogPricingLoad?: CatalogPricingLoadPort
  ) {
    this.catalogPricingLoad = catalogPricingLoad ?? new CatalogPricingLoadAdapter();
  }

  private toPricingContext(input: PricingEngineInput): PricingContext {
    return {
      tenantId: input.tenantId,
      tourId: input.tourId,
      departureId: input.departureId,
      userRole: input.userRole,
      discountCode: input.discountCode
    };
  }

  /** Maps finance {@link PricingQuote} into the persisted registration/API {@link PricingQuoteResult} shape. */
  private financeQuoteToResult(fq: PricingQuote): PricingQuoteResult {
    return {
      line_items: fq.line_items,
      total: fq.total_minor,
      currency_code: fq.currency_code,
      pricing_version: fq.pricing_rule_version,
      pricing_rule_version: fq.pricing_rule_version
    };
  }

  /**
   * Authoritative quote for a bookable tour departure. I/O: loads catalog with the caller's
   * `EntityManager` (transaction alignment). Computation: finance {@link calculateQuote} (rules engine).
   */
  async quote(
    manager: EntityManager,
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult> {
    const context = this.toPricingContext(input);
    const catalog = await this.catalogPricingLoad.loadSnapshot(manager, context);
    const financeQuote = calculateQuote(context, catalog);
    const result = this.financeQuoteToResult(financeQuote);

    if (options?.shadowLogOnly) {
      const discountCode = normalizeDiscountCode(input.discountCode);
      this.logger.log(
        JSON.stringify({
          tag: "PRICING_SHADOW",
          input: { ...input, discountCode },
          result
        })
      );
    }

    if (options?.financeShadowCompare) {
      try {
        const legacyResult = computeLegacyCatalogQuote(input, catalog);
        logPricingShadowDiff(this.logger, {
          tenant_id: input.tenantId,
          tour_id: input.tourId,
          departure_id: input.departureId,
          legacy: legacyResult,
          finance: financeQuote
        });
      } catch (error: unknown) {
        this.logger.warn(
          JSON.stringify({
            event: "PRICING_SHADOW_DIFF_ERROR",
            tenant_id: input.tenantId,
            tour_id: input.tourId,
            departure_id: input.departureId,
            message: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }

    return result;
  }
}
